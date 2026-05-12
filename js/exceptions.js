/**
 * exceptions.js — Exception Tracker & Lifecycle Manager
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
  ExceptionsPage.init();
});

const ExceptionsPage = (() => {
  let _all       = [];
  let _filtered  = [];
  let _page      = 1;
  const PAGE_SIZE = 10;
  let _sortKey   = 'detectedAt';
  let _sortDir   = 'desc';
  let _filters   = { status: 'all', severity: 'all', type: 'all', search: '' };

  function init() {
    _all = Storage.Exceptions.getAll();
    _applyFilters();
    _renderStats();
    _renderTable();
    _bindEvents();
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  function _renderStats() {
    const s = Storage.Exceptions.getStats();
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('exc-total',      _all.length);
    setText('exc-open',       s.open);
    setText('exc-inprogress', s.inProgress);
    setText('exc-resolved',   s.resolved);
    setText('exc-critical',   s.critical);
  }

  // ── Filtering & Sorting ───────────────────────────────────────────────────
  function _applyFilters() {
    let data = [..._all];
    if (_filters.status   !== 'all') data = data.filter(e => e.status   === _filters.status);
    if (_filters.severity !== 'all') data = data.filter(e => e.severity === _filters.severity);
    if (_filters.type     !== 'all') data = data.filter(e => e.exceptionType === _filters.type);
    if (_filters.search)             data = Utils.filterByTerm(data, _filters.search, ['id','instrument','counterparty','exceptionType','assignedTo']);
    _filtered = Utils.sortBy(data, _sortKey, _sortDir);
    _page = 1;
  }

  // ── Table Render ─────────────────────────────────────────────────────────
  function _renderTable() {
    const tbody = document.getElementById('exc-tbody');
    const info  = document.getElementById('exc-table-info');
    if (!tbody) return;

    const start  = (_page - 1) * PAGE_SIZE;
    const slice  = _filtered.slice(start, start + PAGE_SIZE);
    const total  = _filtered.length;

    if (info) info.textContent = `Showing ${Math.min(start+1, total)}–${Math.min(start+PAGE_SIZE, total)} of ${total}`;

    if (!slice.length) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <h3>No exceptions found</h3>
            <p>${_filters.search || _filters.status !== 'all' ? 'Try adjusting your filters.' : 'Run a reconciliation to detect trade breaks.'}</p>
          </div>
        </td></tr>`;
      _renderPagination(total);
      return;
    }

    tbody.innerHTML = slice.map(e => `
      <tr data-id="${Utils.escapeHtml(e.id)}" class="exc-row" style="cursor:pointer;" onclick="ExceptionsPage.openDetail('${Utils.escapeHtml(e.id)}')">
        <td class="cell-id">${Utils.escapeHtml(e.id)}</td>
        <td>
          <div style="font-weight:600;color:var(--color-text-primary);white-space:nowrap;">${Utils.escapeHtml(e.instrument)}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted);">${Utils.escapeHtml(e.assetClass)}</div>
        </td>
        <td>${Utils.escapeHtml(e.exceptionType)}</td>
        <td><span class="badge ${Utils.statusBadgeClass(e.severity)}">${Utils.escapeHtml(e.severity)}</span></td>
        <td><span class="badge ${Utils.statusBadgeClass(e.status)}">${Utils.escapeHtml(e.status)}</span></td>
        <td class="cell-muted">${Utils.escapeHtml(e.counterparty)}</td>
        <td class="cell-num" style="font-family:var(--font-mono);font-size:.8125rem;">
          ${e.varianceAmount != null ? Utils.formatCurrency(e.varianceAmount) : '—'}
        </td>
        <td class="cell-muted">${Utils.formatDate(e.detectedAt)}</td>
      </tr>
    `).join('');

    _renderPagination(total);
  }

  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el    = document.getElementById('exc-pagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="ExceptionsPage.goPage(${_page-1})" ${_page===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= Math.min(pages, 7); i++) {
      html += `<button class="page-btn ${i===_page?'active':''}" onclick="ExceptionsPage.goPage(${i})">${i}</button>`;
    }
    if (pages > 7) html += `<span style="color:var(--color-text-muted);padding:0 .25rem;">…${pages}</span>`;
    html += `<button class="page-btn" onclick="ExceptionsPage.goPage(${_page+1})" ${_page===pages?'disabled':''}>›</button>`;
    el.innerHTML = html;
  }

  // ── Detail Modal ──────────────────────────────────────────────────────────
  function openDetail(id) {
    const exc = _all.find(e => e.id === id);
    if (!exc) return;

    const varDisplay = exc.varianceAmount != null
      ? `${Utils.formatCurrency(exc.varianceAmount)}${exc.variancePct ? ` (${exc.variancePct}%)` : ''}`
      : '—';

    const comments = (exc.comments || []).map(c => `
      <div style="background:var(--color-bg-elevated);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);">
        <div style="display:flex;justify-content:space-between;margin-bottom:.25rem;">
          <strong style="font-size:.8125rem;">${Utils.escapeHtml(c.author)}</strong>
          <span style="font-size:.75rem;color:var(--color-text-muted);">${Utils.formatDateTime(c.timestamp)}</span>
        </div>
        <p style="font-size:.875rem;color:var(--color-text-secondary);">${Utils.escapeHtml(c.text)}</p>
      </div>
    `).join('') || '<p style="font-size:.875rem;color:var(--color-text-muted);">No comments yet.</p>';

    Modal.show({
      title: `${exc.exceptionType} — ${exc.id}`,
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5);">
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Instrument</div><div style="font-weight:600;margin-top:2px;">${Utils.escapeHtml(exc.instrument)}</div></div>
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Counterparty</div><div style="font-weight:600;margin-top:2px;">${Utils.escapeHtml(exc.counterparty)}</div></div>
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Severity</div><div style="margin-top:4px;"><span class="badge ${Utils.statusBadgeClass(exc.severity)}">${Utils.escapeHtml(exc.severity)}</span></div></div>
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Status</div><div style="margin-top:4px;"><span class="badge ${Utils.statusBadgeClass(exc.status)}">${Utils.escapeHtml(exc.status)}</span></div></div>
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Variance</div><div style="font-weight:600;color:var(--color-danger);margin-top:2px;">${varDisplay}</div></div>
          <div><div style="font-size:.6875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;">Assigned To</div><div style="font-weight:600;margin-top:2px;">${Utils.escapeHtml(exc.assignedTo || '—')}</div></div>
        </div>
        <div style="background:var(--color-bg-elevated);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);font-size:.875rem;color:var(--color-text-secondary);line-height:1.6;">${Utils.escapeHtml(exc.description)}</div>
        <div style="margin-bottom:var(--space-4);">
          <div style="font-size:.8125rem;font-weight:700;margin-bottom:var(--space-2);">Update Status</div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-secondary btn-sm" onclick="ExceptionsPage.updateStatus('${id}','Open')">Open</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--color-warning);border-color:var(--color-warning);" onclick="ExceptionsPage.updateStatus('${id}','In Progress')">In Progress</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--color-success);border-color:var(--color-success);" onclick="ExceptionsPage.updateStatus('${id}','Resolved')">Resolved</button>
          </div>
        </div>
        <div>
          <div style="font-size:.8125rem;font-weight:700;margin-bottom:var(--space-3);">Comments (${(exc.comments||[]).length})</div>
          ${comments}
        </div>
      `,
      confirmText: 'Close',
      cancelText:  '',
      onConfirm: () => {},
    });
    document.getElementById('modal-cancel-btn').style.display = 'none';
  }

  function updateStatus(id, status) {
    const session = Storage.Session.get();
    Storage.Exceptions.updateStatus(id, status, session?.fullName);
    Storage.AuditLog.append('EXCEPTION_STATUS_CHANGED', { status, exceptionId: id }, session?.userId);
    Notifications.exceptionResolved({ id, status });
    Toast.success(`Exception ${id} marked as ${status}.`);
    Modal.hide();
    _all = Storage.Exceptions.getAll();
    _applyFilters();
    _renderStats();
    _renderTable();
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  function _bindEvents() {
    // Search
    const search = document.getElementById('exc-search');
    if (search) search.addEventListener('input', Utils.debounce(e => {
      _filters.search = e.target.value;
      _applyFilters(); _renderTable();
    }, 300));

    // Filter chips
    document.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filters.status = btn.getAttribute('data-filter-status');
        _applyFilters(); _renderTable();
      });
    });
    document.querySelectorAll('[data-filter-severity]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-severity]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filters.severity = btn.getAttribute('data-filter-severity');
        _applyFilters(); _renderTable();
      });
    });

    // Sort headers
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        _sortDir = (_sortKey === key && _sortDir === 'desc') ? 'asc' : 'desc';
        _sortKey = key;
        document.querySelectorAll('[data-sort]').forEach(h => h.classList.remove('sort-asc','sort-desc'));
        th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        _applyFilters(); _renderTable();
      });
    });

    // Export button
    document.getElementById('exc-export-btn')?.addEventListener('click', () => {
      const cols = ['id','tradeId','instrument','assetClass','exceptionType','severity','status','counterparty','varianceAmount','variancePct','assignedTo','detectedAt','resolvedAt'];
      const hdrs = { id:'Exception ID', tradeId:'Trade ID', instrument:'Instrument', assetClass:'Asset Class', exceptionType:'Exception Type', severity:'Severity', status:'Status', counterparty:'Counterparty', varianceAmount:'Variance Amount (USD)', variancePct:'Variance %', assignedTo:'Assigned To', detectedAt:'Detected At', resolvedAt:'Resolved At' };
      const csv = Utils.toCSV(_filtered, cols, hdrs);
      Utils.downloadFile(csv, `traderecon-exceptions-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
      Storage.AuditLog.append('REPORT_EXPORTED', { reportType: 'Exception Summary', recordCount: _filtered.length, format: 'CSV' });
      Toast.success(`Exported ${_filtered.length} exceptions to CSV.`);
    });
  }

  return { init, openDetail, updateStatus, goPage: p => { _page = p; _renderTable(); } };
})();

window.ExceptionsPage = ExceptionsPage;
