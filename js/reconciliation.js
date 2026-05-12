/**
 * reconciliation.js — Matching Engine & Recon Run Controller
 * Trade Reconciliation Exception Tracker
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  await loadComponents([
    { id: 'sidebar-container',    path: 'components/sidebar.html' },
    { id: 'navbar-container',     path: 'components/navbar.html'  },
    { id: 'loader-container',     path: 'components/loader.html'  },
    { id: 'modal-container',      path: 'components/modal.html'   },
    { id: 'toast-container-wrap', path: 'components/toast.html'   },
  ]);
  Recon.init();
});

const Recon = (() => {

  // ── Exception type definitions ─────────────────────────────────────────────
  const EXCEPTION_TEMPLATES = [
    {
      type: 'Price Mismatch',
      check: t => t.status === 'Exception' && t.assetClass !== 'FX',
      buildException: t => ({
        internalValue:     parseFloat(t.price),
        counterpartyValue: parseFloat(t.price) * (1 + (Math.random() * 0.004 - 0.002) + 0.001),
        severity: parseFloat(t.notional) > 1000000 ? 'High' : 'Medium',
        description: `Internal price ${t.price} does not match counterparty confirmed price for ${t.instrument}. Variance detected during automated matching.`,
      }),
    },
    {
      type: 'Counterparty Mismatch',
      check: t => t.status === 'Exception' && t.assetClass === 'FX',
      buildException: t => ({
        internalValue:     parseFloat(t.quantity),
        counterpartyValue: parseFloat(t.quantity) * 0.99,
        severity: 'Critical',
        description: `Counterparty confirmation for ${t.instrument} shows quantity discrepancy of 1% vs internal trade book.`,
      }),
    },
    {
      type: 'Missing Counterparty Confirmation',
      check: t => t.status === 'Pending' && Math.random() > 0.5,
      buildException: t => ({
        internalValue:     null,
        counterpartyValue: null,
        severity: 'High',
        description: `No confirmation received from ${t.counterparty} within T+1 deadline for ${t.instrument}. Notional exposure: ${Utils.formatCurrency(t.notional, t.currency)}.`,
      }),
    },
  ];

  // ── Public Init ────────────────────────────────────────────────────────────
  function init() {
    _renderRunHistory();
    _renderTradeStats();

    document.getElementById('trigger-recon-btn')?.addEventListener('click', () => {
      Modal.show({
        title:       'Confirm Reconciliation Run',
        body:        `<p>This will process <strong>${Storage.Trades.getAll().length} trades</strong> against counterparty data and update all exception records.</p><p style="margin-top:.75rem;color:var(--color-text-muted);font-size:.875rem;">Estimated completion time: 3 seconds.</p>`,
        confirmText: 'Run Now',
        cancelText:  'Cancel',
        type:        'default',
        onConfirm:   () => _executRun(),
      });
    });
  }

  // ── Execution ──────────────────────────────────────────────────────────────
  async function _executRun() {
    // 3-second animated loader with step indicators
    await Loader.runRecon(3000);

    const trades     = Storage.Trades.getAll();
    if (!trades.length) {
      Toast.warning('No trades found. Upload trade data first.');
      return;
    }

    // Run matching logic
    const result = _runMatchingEngine(trades);

    // Save trades back with updated statuses
    Storage.Trades.save(result.updatedTrades);

    // Merge new exceptions (preserve existing, add new ones)
    const existingExceptions = Storage.Exceptions.getAll();
    const newExceptions = result.exceptions.filter(
      ne => !existingExceptions.find(ee => ee.tradeId === ne.tradeId && ee.exceptionType === ne.exceptionType)
    );
    Storage.Exceptions.save([...existingExceptions, ...newExceptions]);

    // Save recon run record
    const run = Storage.ReconRuns.save({
      total:      trades.length,
      matched:    result.matched,
      exceptions: result.exceptionsCount,
      pending:    result.pending,
      newExceptions: newExceptions.length,
    });

    // Audit
    Storage.AuditLog.append('RECONCILIATION_RUN', {
      total: trades.length,
      matched: result.matched,
      exceptions: result.exceptionsCount,
      pending: result.pending,
    });

    Notifications.reconCompleted(run);
    Toast.success(`Recon complete — ${result.matched} matched, ${result.exceptionsCount} exceptions, ${result.pending} pending.`);

    _renderRunHistory();
    _renderTradeStats();
    _showRunSummary(run, newExceptions.length);
  }

  // ── Matching Engine ────────────────────────────────────────────────────────
  function _runMatchingEngine(trades) {
    let matched = 0, exceptionsCount = 0, pending = 0;
    const exceptions = [];

    const updatedTrades = trades.map(trade => {
      let newStatus = trade.status;

      // Keep already-resolved states; re-evaluate Pending
      if (trade.status === 'Matched') { matched++; return trade; }

      // Apply probabilistic matching (simulates counterparty feed)
      const roll = Math.random();
      if (trade.status === 'Exception') {
        newStatus = 'Exception';
        exceptionsCount++;
        // Generate exception record
        const template = EXCEPTION_TEMPLATES.find(t => t.check(trade));
        if (template) {
          const extra = template.buildException(trade);
          const variance = extra.internalValue && extra.counterpartyValue
            ? Math.abs(extra.counterpartyValue - extra.internalValue)
            : parseFloat(trade.notional) || 0;
          exceptions.push({
            id:               `EXC-RUN-${Utils.uid()}`,
            tradeId:          trade.id || trade.tradeId,
            exceptionType:    template.type,
            description:      extra.description,
            internalValue:    extra.internalValue,
            counterpartyValue:extra.counterpartyValue,
            varianceAmount:   parseFloat(variance.toFixed(2)),
            variancePct:      extra.internalValue ? parseFloat(((Math.abs(extra.counterpartyValue - extra.internalValue) / extra.internalValue) * 100).toFixed(3)) : null,
            severity:         extra.severity,
            status:           'Open',
            instrument:       trade.instrument,
            isin:             trade.isin || 'N/A',
            assetClass:       trade.assetClass,
            counterparty:     trade.counterparty,
            portfolio:        trade.portfolio,
            tradeDate:        trade.tradeDate,
            detectedAt:       new Date().toISOString(),
            assignedTo:       Storage.Session.get()?.fullName || 'System',
            resolvedAt:       null,
            resolvedBy:       null,
            comments:         [],
            reconRunId:       `run_${Date.now()}`,
          });
        }
      } else if (trade.status === 'Pending') {
        if (roll > 0.4) { newStatus = 'Matched'; matched++; }
        else            { newStatus = 'Pending';  pending++;  }
      } else {
        matched++;
      }
      return { ...trade, status: newStatus };
    });

    return { updatedTrades, exceptions, matched, exceptionsCount, pending };
  }

  // ── UI Renderers ──────────────────────────────────────────────────────────
  function _renderRunHistory() {
    const tbody = document.getElementById('run-history-tbody');
    if (!tbody) return;
    const runs = Storage.ReconRuns.getAll();

    if (!runs.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">⚡</div><p>No reconciliation runs yet. Click <strong>Trigger Recon Run</strong> to begin.</p></td></tr>`;
      return;
    }
    tbody.innerHTML = runs.slice(0, 10).map(r => {
      const rate = r.total ? ((r.matched / r.total) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td class="cell-id">${Utils.escapeHtml(r.id)}</td>
          <td class="cell-muted">${Utils.formatDateTime(r.timestamp)}</td>
          <td class="cell-num" style="color:var(--color-text-primary);font-weight:600;">${r.total}</td>
          <td class="cell-num" style="color:var(--color-success);font-weight:600;">${r.matched}</td>
          <td class="cell-num" style="color:var(--color-danger);font-weight:600;">${r.exceptions}</td>
          <td><span class="badge ${parseFloat(rate) >= 80 ? 'badge-success' : parseFloat(rate) >= 60 ? 'badge-warning' : 'badge-danger'}">${rate}%</span></td>
        </tr>`;
    }).join('');
  }

  function _renderTradeStats() {
    const stats = Storage.Trades.getStats();
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('rs-total',      stats.total);
    setText('rs-matched',    stats.matched);
    setText('rs-exceptions', stats.exceptions);
    setText('rs-pending',    stats.pending);
    setText('rs-matchrate',  stats.matchRate + '%');
    setText('rs-notional',   Utils.formatCompact(stats.totalNotional));
  }

  function _showRunSummary(run, newExcCount) {
    const el = document.getElementById('run-summary-banner');
    if (!el) return;
    const rate = run.total ? ((run.matched / run.total) * 100).toFixed(1) : 0;
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;flex-wrap:wrap;">
        <span style="font-size:1.25rem;">✅</span>
        <div>
          <div style="font-weight:700;color:var(--color-text-primary);">Reconciliation run complete</div>
          <div style="font-size:.8125rem;color:var(--color-text-secondary);">
            ${run.total} trades processed · ${run.matched} matched (${rate}%) · ${run.exceptions} exceptions · ${newExcCount} new exceptions created
          </div>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-3);">
        <a href="exceptions.html" class="btn btn-danger btn-sm">View Exceptions (${run.exceptions})</a>
        <button class="btn btn-ghost btn-sm" onclick="this.parentElement.parentElement.style.display='none'">Dismiss</button>
      </div>
    `;
  }

  return { init };
})();

window.Recon = Recon;
