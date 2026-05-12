/**
 * dashboard.js — Dashboard Page Controller
 * Trade Reconciliation Exception Tracker
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadComponents([
    { id: 'sidebar-container', path: 'components/sidebar.html' },
    { id: 'navbar-container',  path: 'components/navbar.html'  },
    { id: 'loader-container',  path: 'components/loader.html'  },
    { id: 'modal-container',   path: 'components/modal.html'   },
    { id: 'toast-container-wrap', path: 'components/toast.html' },
  ]);

  _renderKPIs();
  _renderMatchRateDonut();
  _renderSeverityBars();
  _renderRecentExceptions();
  _renderActivity();
  _renderLastReconRun();
});

// ── KPI Cards ─────────────────────────────────────────────────
function _renderKPIs() {
  const stats  = Storage.Trades.getStats();
  const excSt  = Storage.Exceptions.getStats();
  const latRun = Storage.ReconRuns.getLatest();

  _setKPI('kpi-total',      stats.total,                       null);
  _setKPI('kpi-matched',    stats.matched,                     null);
  _setKPI('kpi-exceptions', excSt.open,                        null);
  _setKPI('kpi-matchrate',  stats.matchRate + '%',             null);
  _setText('kpi-notional',  Utils.formatCompact(stats.totalNotional));
  _setText('kpi-run-time',  latRun ? Utils.timeAgo(latRun.timestamp) : 'Never run');
}

function _setKPI(id, value, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  _animateCount(el, typeof value === 'string' ? parseFloat(value) || 0 : value,
    typeof value === 'string' && value.includes('%') ? '%' : '');
}

function _animateCount(el, target, suffix = '', duration = 1000) {
  if (isNaN(target)) { el.textContent = target + suffix; return; }
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = (Number.isInteger(target) ? Math.floor(start) : start.toFixed(1)) + suffix;
    if (start >= target) clearInterval(timer);
  }, 16);
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Match Rate Donut ──────────────────────────────────────────
function _renderMatchRateDonut() {
  const stats = Storage.Trades.getStats();
  const pct   = parseFloat(stats.matchRate) || 0;
  const r     = 50; const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  const fill  = document.getElementById('donut-fill');
  const label = document.getElementById('donut-pct-label');
  if (fill) {
    fill.setAttribute('stroke-dasharray', circ);
    fill.setAttribute('stroke-dashoffset', circ); // start at 0
    setTimeout(() => fill.setAttribute('stroke-dashoffset', offset), 100);
  }
  if (label) { label.textContent = pct + '%'; }
}

// ── Severity Bars ─────────────────────────────────────────────
function _renderSeverityBars() {
  const exceptions = Storage.Exceptions.getAll();
  const total = exceptions.length || 1;
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  exceptions.forEach(e => { if (counts[e.severity] !== undefined) counts[e.severity]++; });

  Object.entries(counts).forEach(([sev, count]) => {
    const fill = document.getElementById(`sev-bar-${sev.toLowerCase()}`);
    const num  = document.getElementById(`sev-count-${sev.toLowerCase()}`);
    if (fill) setTimeout(() => { fill.style.width = ((count / total) * 100) + '%'; }, 200);
    if (num)  num.textContent = count;
  });
}

// ── Recent Exceptions ─────────────────────────────────────────
function _renderRecentExceptions() {
  const tbody    = document.getElementById('recent-exc-tbody');
  if (!tbody) return;
  const exceptions = Utils.sortBy(Storage.Exceptions.getAll(), 'detectedAt', 'desc').slice(0, 6);

  if (!exceptions.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No exceptions yet. Run a reconciliation to detect breaks.</td></tr>`;
    return;
  }

  tbody.innerHTML = exceptions.map(e => `
    <tr onclick="window.location.href='exceptions.html'" style="cursor:pointer;">
      <td class="cell-id">${Utils.escapeHtml(e.id)}</td>
      <td>${Utils.escapeHtml(e.instrument)}</td>
      <td>${Utils.escapeHtml(e.exceptionType)}</td>
      <td><span class="badge ${Utils.statusBadgeClass(e.severity)}">${Utils.escapeHtml(e.severity)}</span></td>
      <td><span class="badge ${Utils.statusBadgeClass(e.status)}">${Utils.escapeHtml(e.status)}</span></td>
      <td class="cell-muted">${Utils.formatDate(e.detectedAt)}</td>
    </tr>
  `).join('');
}

// ── Activity Feed ─────────────────────────────────────────────
function _renderActivity() {
  const container = document.getElementById('activity-feed');
  if (!container) return;
  const log   = Storage.AuditLog.getAll().slice(0, 8);
  const colors = {
    EXCEPTION_CREATED:      'var(--color-danger)',
    EXCEPTION_STATUS_CHANGED:'var(--color-warning)',
    EXCEPTION_COMMENT_ADDED:'var(--color-info)',
    RECONCILIATION_RUN:     'var(--color-accent)',
    TRADE_FILE_UPLOADED:    'var(--color-success)',
    REPORT_EXPORTED:        'var(--color-success)',
    USER_LOGIN:             'var(--color-neutral)',
    USER_REGISTERED:        'var(--color-neutral)',
  };

  if (!log.length) {
    container.innerHTML = `<p style="color:var(--color-text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">No activity yet.</p>`;
    return;
  }

  container.innerHTML = log.map(entry => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${colors[entry.action] || 'var(--color-neutral)'}"></div>
      <div style="flex:1;min-width:0;">
        <div class="activity-text">${_formatActivityText(entry)}</div>
        <div class="activity-time">${Utils.timeAgo(entry.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function _formatActivityText(entry) {
  const actor = `<strong>${Utils.escapeHtml(entry.userName)}</strong>`;
  const map = {
    EXCEPTION_CREATED:       `${actor} — Exception <strong>${entry.entityId}</strong> detected`,
    EXCEPTION_STATUS_CHANGED:`${actor} updated status of ${entry.entityId} to <strong>${entry.changes?.statusTo || ''}</strong>`,
    EXCEPTION_COMMENT_ADDED: `${actor} added a comment to ${entry.entityId}`,
    RECONCILIATION_RUN:      `${actor} triggered a reconciliation run`,
    TRADE_FILE_UPLOADED:     `${actor} uploaded a trade file (${entry.changes?.recordCount || 0} records)`,
    REPORT_EXPORTED:         `${actor} exported a ${entry.changes?.reportType || 'report'} in CSV`,
    USER_LOGIN:              `${actor} signed in`,
    USER_REGISTERED:         `${actor} registered a new account`,
  };
  return map[entry.action] || `${actor} performed ${entry.action}`;
}

// ── Last Recon Run ─────────────────────────────────────────────
function _renderLastReconRun() {
  const run = Storage.ReconRuns.getLatest();
  const el  = document.getElementById('last-run-card');
  if (!el) return;

  if (!run) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:.875rem;">No reconciliation run yet. <a href="reconciliation.html" style="color:var(--color-accent);">Trigger one now →</a></p>`;
    return;
  }

  el.innerHTML = `
    <div class="recon-run-card">
      <div class="recon-run-stat">
        <div class="recon-run-val">${run.total || 0}</div>
        <div class="recon-run-lbl">Total</div>
      </div>
      <div class="recon-run-stat">
        <div class="recon-run-val" style="color:var(--color-success)">${run.matched || 0}</div>
        <div class="recon-run-lbl">Matched</div>
      </div>
      <div class="recon-run-stat">
        <div class="recon-run-val" style="color:var(--color-danger)">${run.exceptions || 0}</div>
        <div class="recon-run-lbl">Exceptions</div>
      </div>
      <div class="recon-run-stat">
        <div class="recon-run-val" style="color:var(--color-warning)">${run.pending || 0}</div>
        <div class="recon-run-lbl">Pending</div>
      </div>
      <div style="flex:1;text-align:right;">
        <div style="font-size:.75rem;color:var(--color-text-muted);">Run at</div>
        <div style="font-size:.875rem;font-weight:600;">${Utils.formatDateTime(run.timestamp)}</div>
        <a href="reconciliation.html" class="btn btn-primary btn-sm" style="margin-top:.5rem;">Run Again</a>
      </div>
    </div>
  `;
}
