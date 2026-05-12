/**
 * audit.js — Audit Log Viewer
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
  AuditPage.init();
});

const AuditPage = (() => {
  let _all = [], _filtered = [], _page = 1;
  const PAGE_SIZE = 15;
  const ACTION_COLORS = {
    EXCEPTION_CREATED:       'var(--color-danger)',
    EXCEPTION_STATUS_CHANGED:'var(--color-warning)',
    EXCEPTION_COMMENT_ADDED: 'var(--color-info)',
    RECONCILIATION_RUN:      'var(--color-accent)',
    TRADE_FILE_UPLOADED:     'var(--color-success)',
    TRADE_MANUAL_ENTRY:      'var(--color-success)',
    REPORT_EXPORTED:         'var(--color-success)',
    USER_LOGIN:              'var(--color-neutral)',
    USER_REGISTERED:         'var(--color-neutral)',
  };

  function init() {
    _all = Storage.AuditLog.getAll();
    _filtered = [..._all];
    _renderStats();
    _renderTable();
    _bindEvents();
  }

  function _renderStats() {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('aud-total',   _all.length);
    setText('aud-today',   _all.filter(e => e.timestamp?.slice(0,10) === new Date().toISOString().slice(0,10)).length);
    setText('aud-users',   [...new Set(_all.map(e => e.userId))].length);
    setText('aud-actions', [...new Set(_all.map(e => e.action))].length);
  }

  function _renderTable() {
    const tbody = document.getElementById('aud-tbody');
    const info  = document.getElementById('aud-table-info');
    if (!tbody) return;

    const start = (_page - 1) * PAGE_SIZE;
    const slice = _filtered.slice(start, start + PAGE_SIZE);
    const total = _filtered.length;

    if (info) info.textContent = `Showing ${Math.min(start+1, total)}–${Math.min(start+PAGE_SIZE, total)} of ${total} entries`;

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>No audit entries found</h3><p>Try adjusting your search or filter.</p></div></td></tr>`;
      _renderPagination(0); return;
    }

    tbody.innerHTML = slice.map(e => `
      <tr>
        <td class="cell-muted" style="font-family:var(--font-mono);font-size:.75rem;white-space:nowrap;">${Utils.formatDateTime(e.timestamp)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:.4rem;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${ACTION_COLORS[e.action]||'var(--color-neutral)'}">
            <span style="width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0;"></span>
            ${Utils.escapeHtml(e.action)}
          </span>
        </td>
        <td>
          <div style="font-weight:600;font-size:.875rem;">${Utils.escapeHtml(e.userName)}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted);">${Utils.escapeHtml(e.userEmail)}</div>
        </td>
        <td class="cell-muted">${Utils.escapeHtml(e.entityType || '—')}</td>
        <td class="cell-id">${Utils.escapeHtml(e.entityId || '—')}</td>
        <td class="cell-muted" style="font-family:var(--font-mono);font-size:.75rem;">${Utils.escapeHtml(e.ip || '—')}</td>
      </tr>
    `).join('');

    _renderPagination(total);
  }

  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el    = document.getElementById('aud-pagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="AuditPage.goPage(${_page-1})" ${_page===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= Math.min(pages, 8); i++) {
      html += `<button class="page-btn ${i===_page?'active':''}" onclick="AuditPage.goPage(${i})">${i}</button>`;
    }
    if (pages > 8) html += `<span style="color:var(--color-text-muted);padding:0 .5rem;">… ${pages}</span>`;
    html += `<button class="page-btn" onclick="AuditPage.goPage(${_page+1})" ${_page===pages?'disabled':''}>›</button>`;
    el.innerHTML = html;
  }

  function _bindEvents() {
    document.getElementById('aud-search')?.addEventListener('input', Utils.debounce(e => {
      _filtered = Utils.filterByTerm(_all, e.target.value, ['action','userName','userEmail','entityId','entityType']);
      _page = 1; _renderTable();
    }, 300));

    document.querySelectorAll('[data-aud-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-aud-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-aud-filter');
        _filtered = f === 'all' ? [..._all] : _all.filter(e => e.action === f);
        _page = 1; _renderTable();
      });
    });

    document.getElementById('aud-export-btn')?.addEventListener('click', () => {
      const cols = ['id','timestamp','action','userName','userEmail','entityType','entityId','ip'];
      const hdrs = { id:'Audit ID', timestamp:'Timestamp', action:'Action', userName:'User Name', userEmail:'Email', entityType:'Entity Type', entityId:'Entity ID', ip:'IP Address' };
      Utils.downloadFile(Utils.toCSV(_filtered, cols, hdrs), `audit-log-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
      Toast.success(`Audit log exported — ${_filtered.length} entries.`);
    });
  }

  return { init, goPage: p => { _page = p; _renderTable(); } };
})();

window.AuditPage = AuditPage;
