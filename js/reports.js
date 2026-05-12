/**
 * reports.js — Report Generation & CSV Export Engine
 * Uses native Blob API — no server required.
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
  Reports.init();
});

const Reports = (() => {

  // ── Report Definitions ────────────────────────────────────────────────────
  const REPORT_TYPES = {
    'trade-summary': {
      label:       'Trade Summary',
      description: 'Full trade blotter with status and notional values.',
      icon:        '📊',
      getData:     () => Storage.Trades.getAll(),
      cols:        ['id','instrument','isin','assetClass','side','quantity','price','notional','currency','counterparty','portfolio','trader','tradeDate','settlementDate','status'],
      headers:     { id:'Trade ID', instrument:'Instrument', isin:'ISIN', assetClass:'Asset Class', side:'Side', quantity:'Quantity', price:'Price', notional:'Notional', currency:'Currency', counterparty:'Counterparty', portfolio:'Portfolio', trader:'Trader', tradeDate:'Trade Date', settlementDate:'Settlement Date', status:'Status' },
      filename:    () => `trade-summary-${_today()}.csv`,
    },
    'exception-report': {
      label:       'Exception Report',
      description: 'All exceptions with severity, variance, and resolution status.',
      icon:        '⚠️',
      getData:     () => Storage.Exceptions.getAll(),
      cols:        ['id','tradeId','instrument','assetClass','exceptionType','severity','status','counterparty','varianceAmount','variancePct','internalValue','counterpartyValue','assignedTo','detectedAt','resolvedAt','resolvedBy'],
      headers:     { id:'Exception ID', tradeId:'Trade ID', instrument:'Instrument', assetClass:'Asset Class', exceptionType:'Exception Type', severity:'Severity', status:'Status', counterparty:'Counterparty', varianceAmount:'Variance Amount', variancePct:'Variance %', internalValue:'Internal Value', counterpartyValue:'Counterparty Value', assignedTo:'Assigned To', detectedAt:'Detected At', resolvedAt:'Resolved At', resolvedBy:'Resolved By' },
      filename:    () => `exception-report-${_today()}.csv`,
    },
    'matched-trades': {
      label:       'Matched Trades',
      description: 'Only successfully matched trades for settlement confirmation.',
      icon:        '✅',
      getData:     () => Storage.Trades.getAll().filter(t => t.status === 'Matched'),
      cols:        ['id','instrument','isin','side','quantity','price','notional','currency','counterparty','tradeDate','settlementDate'],
      headers:     { id:'Trade ID', instrument:'Instrument', isin:'ISIN', side:'Side', quantity:'Quantity', price:'Price', notional:'Notional', currency:'Currency', counterparty:'Counterparty', tradeDate:'Trade Date', settlementDate:'Settlement Date' },
      filename:    () => `matched-trades-${_today()}.csv`,
    },
    'open-exceptions': {
      label:       'Open Exceptions',
      description: 'Unresolved exceptions only — for daily operations review.',
      icon:        '🔴',
      getData:     () => Storage.Exceptions.getAll().filter(e => e.status !== 'Resolved'),
      cols:        ['id','tradeId','instrument','exceptionType','severity','status','counterparty','varianceAmount','assignedTo','detectedAt'],
      headers:     { id:'Exception ID', tradeId:'Trade ID', instrument:'Instrument', exceptionType:'Exception Type', severity:'Severity', status:'Status', counterparty:'Counterparty', varianceAmount:'Variance Amount', assignedTo:'Assigned To', detectedAt:'Detected At' },
      filename:    () => `open-exceptions-${_today()}.csv`,
    },
    'recon-summary': {
      label:       'Reconciliation Summary',
      description: 'Statistics per reconciliation run — match rates and break counts.',
      icon:        '📈',
      getData:     () => Storage.ReconRuns.getAll(),
      cols:        ['id','timestamp','total','matched','exceptions','pending'],
      headers:     { id:'Run ID', timestamp:'Run Timestamp', total:'Total Trades', matched:'Matched', exceptions:'Exceptions', pending:'Pending' },
      filename:    () => `recon-summary-${_today()}.csv`,
    },
    'audit-log': {
      label:       'Audit Log',
      description: 'Full user activity log for compliance and SOC-2 reporting.',
      icon:        '📋',
      getData:     () => Storage.AuditLog.getAll(),
      cols:        ['id','timestamp','action','userName','userEmail','entityType','entityId','ip'],
      headers:     { id:'Audit ID', timestamp:'Timestamp', action:'Action', userName:'User Name', userEmail:'User Email', entityType:'Entity Type', entityId:'Entity ID', ip:'IP Address' },
      filename:    () => `audit-log-${_today()}.csv`,
    },
  };

  function _today() { return new Date().toISOString().slice(0, 10); }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _renderReportCards();
    _renderReconStats();
    _renderExceptionBreakdown();
  }

  // ── Report Cards ──────────────────────────────────────────────────────────
  function _renderReportCards() {
    const grid = document.getElementById('report-cards-grid');
    if (!grid) return;

    grid.innerHTML = Object.entries(REPORT_TYPES).map(([key, r]) => {
      const data  = r.getData();
      return `
        <div class="report-card" id="rc-${key}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-4);">
            <div>
              <div style="font-size:1.5rem;margin-bottom:var(--space-2);">${r.icon}</div>
              <h3 style="font-size:.9375rem;font-weight:700;color:var(--color-text-primary);">${r.label}</h3>
            </div>
            <span class="badge badge-info">${data.length} rows</span>
          </div>
          <p style="font-size:.8125rem;color:var(--color-text-secondary);line-height:1.5;margin-bottom:var(--space-5);">${r.description}</p>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="Reports.exportCSV('${key}')"
              ${!data.length ? 'disabled title="No data available"' : ''}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Reports.preview('${key}')">Preview</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV(type) {
    const report = REPORT_TYPES[type];
    if (!report) { Toast.error('Unknown report type.'); return; }

    const data = report.getData();
    if (!data.length) { Toast.warning('No data available for this report.'); return; }

    const csv = Utils.toCSV(data, report.cols, report.headers);
    Utils.downloadFile(csv, report.filename(), 'text/csv');

    // Audit
    Storage.AuditLog.append('REPORT_EXPORTED', { reportType: report.label, recordCount: data.length, format: 'CSV' });
    Notifications.reportExported({ type, count: data.length });
    Toast.success(`${report.label} exported — ${data.length} records.`);
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  function preview(type) {
    const report = REPORT_TYPES[type];
    if (!report) return;
    const data = report.getData().slice(0, 5);
    if (!data.length) { Toast.warning('No data to preview.'); return; }

    const headers = report.cols.map(c => report.headers[c] || c);
    const rows    = data.map(row => report.cols.map(c => Utils.escapeHtml(String(row[c] ?? '').slice(0, 50))));

    Modal.show({
      title:       `Preview — ${report.label}`,
      body:        `
        <p style="font-size:.8125rem;color:var(--color-text-muted);margin-bottom:var(--space-4);">Showing first ${data.length} of ${report.getData().length} rows.</p>
        <div style="overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-md);">
          <table style="width:100%;border-collapse:collapse;font-size:.75rem;white-space:nowrap;">
            <thead><tr>${headers.map(h => `<th style="background:var(--color-bg-elevated);padding:.5rem .75rem;text-align:left;font-size:.6875rem;color:var(--color-text-muted);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--color-border);">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr style="border-bottom:1px solid var(--color-border-muted);">${r.map(v => `<td style="padding:.5rem .75rem;color:var(--color-text-secondary);">${v || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      `,
      confirmText: `Export CSV`,
      cancelText:  'Close',
      onConfirm:   () => exportCSV(type),
    });
  }

  // ── Stats Section ─────────────────────────────────────────────────────────
  function _renderReconStats() {
    const tradeStats = Storage.Trades.getStats();
    const excStats   = Storage.Exceptions.getStats();
    const latRun     = Storage.ReconRuns.getLatest();

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('rpt-total-trades',    tradeStats.total);
    setText('rpt-match-rate',      tradeStats.matchRate + '%');
    setText('rpt-total-notional',  Utils.formatCompact(tradeStats.totalNotional));
    setText('rpt-open-exceptions', excStats.open);
    setText('rpt-resolved',        excStats.resolved);
    setText('rpt-last-run',        latRun ? Utils.formatDateTime(latRun.timestamp) : 'Never');
  }

  function _renderExceptionBreakdown() {
    const exceptions = Storage.Exceptions.getAll();
    const byType = {};
    exceptions.forEach(e => { byType[e.exceptionType] = (byType[e.exceptionType] || 0) + 1; });

    const el = document.getElementById('exc-type-breakdown');
    if (!el || !Object.keys(byType).length) return;

    const max = Math.max(...Object.values(byType));
    el.innerHTML = Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type, count]) => `
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
        <div style="font-size:.8125rem;color:var(--color-text-secondary);width:200px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(type)}</div>
        <div style="flex:1;height:8px;background:var(--color-bg-elevated);border-radius:var(--radius-full);overflow:hidden;">
          <div style="height:100%;width:${(count/max)*100}%;background:linear-gradient(90deg,var(--color-accent),var(--color-info));border-radius:var(--radius-full);"></div>
        </div>
        <div style="font-size:.8125rem;font-weight:700;color:var(--color-text-primary);width:20px;text-align:right;">${count}</div>
      </div>
    `).join('');
  }

  return { init, exportCSV, preview };
})();

window.Reports = Reports;
