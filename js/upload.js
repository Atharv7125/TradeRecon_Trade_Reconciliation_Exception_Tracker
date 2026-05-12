/**
 * upload.js — File Upload & Trade Ingestion Controller
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

  Upload.init();
  _renderUploadHistory();
});

const Upload = (() => {
  let _selectedFile = null;
  let _parsedTrades = [];

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    const zone    = document.getElementById('drop-zone');
    const input   = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    if (!zone || !input) return;

    // Browse button
    browseBtn?.addEventListener('click', () => input.click());
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => _handleFile(e.target.files[0]));

    // Drag & Drop
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) _handleFile(file);
    });

    // Upload button
    document.getElementById('upload-btn')?.addEventListener('click', _doUpload);
    document.getElementById('clear-btn')?.addEventListener('click', _clearFile);
  }

  // ── File Handling ─────────────────────────────────────────────
  function _handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json'].includes(ext)) {
      Toast.error('Unsupported file type. Please upload CSV or JSON.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Toast.error('File too large. Maximum size is 5 MB.');
      return;
    }
    _selectedFile = file;
    _showFilePreview(file);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        _parsedTrades = ext === 'json'
          ? JSON.parse(e.target.result)
          : _parseCSV(e.target.result);
        _showParsePreview(_parsedTrades);
      } catch (err) {
        Toast.error('Failed to parse file: ' + err.message);
        _parsedTrades = [];
      }
    };
    reader.readAsText(file);
  }

  function _parseCSV(text) {
    const lines  = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
  }

  // ── UI: File Preview ──────────────────────────────────────────
  function _showFilePreview(file) {
    const zone    = document.getElementById('drop-zone');
    const preview = document.getElementById('file-preview-area');
    if (zone)    zone.style.display = 'none';
    if (!preview) return;
    preview.style.display = 'block';
    preview.innerHTML = `
      <div class="file-preview">
        <div class="file-preview-icon">📄</div>
        <div class="file-preview-info">
          <div class="file-preview-name">${Utils.escapeHtml(file.name)}</div>
          <div class="file-preview-meta">${(file.size / 1024).toFixed(1)} KB · ${file.type || 'text/plain'} · Modified ${Utils.formatDate(new Date(file.lastModified).toISOString())}</div>
        </div>
        <div class="file-preview-actions">
          <button class="btn btn-ghost btn-sm" id="clear-btn" onclick="Upload._clearFile()">✕ Remove</button>
          <button class="btn btn-primary btn-sm" id="upload-btn" onclick="Upload._doUpload()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload Trades
          </button>
        </div>
      </div>
      <div class="upload-progress-bar" id="upload-progress" style="display:none;">
        <div class="upload-progress-fill" id="upload-progress-fill" style="width:0%"></div>
      </div>
    `;
  }

  function _showParsePreview(trades) {
    const el = document.getElementById('parse-preview');
    if (!el || !trades.length) return;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="card" style="margin-top:var(--space-5);">
        <div class="card-header">
          <h3 class="card-title">Preview — ${trades.length} trades detected</h3>
          <span class="badge badge-info">${trades.length} rows</span>
        </div>
        <div class="data-table-wrap" style="max-height:240px;overflow-y:auto;">
          <table class="data-table">
            <thead><tr>${Object.keys(trades[0]).slice(0,7).map(k => `<th>${Utils.escapeHtml(k)}</th>`).join('')}</tr></thead>
            <tbody>${trades.slice(0,5).map(t =>
              `<tr>${Object.values(t).slice(0,7).map(v => `<td class="cell-muted">${Utils.escapeHtml(String(v).slice(0,30))}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
        </div>
        ${trades.length > 5 ? `<p style="font-size:.75rem;color:var(--color-text-muted);padding:var(--space-3) var(--space-4);">… and ${trades.length - 5} more rows</p>` : ''}
      </div>
    `;
  }

  // ── Upload & Persist ──────────────────────────────────────────
  async function _doUpload() {
    if (!_parsedTrades.length) { Toast.warning('No trades parsed yet.'); return; }

    // Animate progress
    const bar = document.getElementById('upload-progress');
    const fill = document.getElementById('upload-progress-fill');
    if (bar)  bar.style.display = 'block';
    if (fill) {
      let w = 0;
      const t = setInterval(() => { w = Math.min(w + 15, 90); fill.style.width = w + '%'; if (w >= 90) clearInterval(t); }, 100);
    }
    await new Promise(r => setTimeout(r, 900));
    if (fill) fill.style.width = '100%';

    // Save trades — map fields permissively
    const saved = _parsedTrades.map(t => Storage.Trades.add({
      tradeId:        t.id || t.tradeId || t.trade_id || Utils.uid('TRD-'),
      instrument:     t.instrument || t.Instrument || 'Unknown',
      isin:           t.isin || t.ISIN || 'N/A',
      assetClass:     t.assetClass || t.asset_class || 'Equity',
      side:           t.side || t.Side || 'Buy',
      quantity:       parseFloat(t.quantity || t.Quantity) || 0,
      price:          parseFloat(t.price   || t.Price)    || 0,
      notional:       parseFloat(t.notional|| t.Notional) || 0,
      currency:       t.currency  || t.Currency  || 'USD',
      counterparty:   t.counterparty || t.Counterparty || 'Unknown',
      broker:         t.broker    || t.Broker    || '',
      portfolio:      t.portfolio || t.Portfolio || 'DEFAULT',
      trader:         t.trader    || t.Trader    || 'Unknown',
      tradeDate:      t.tradeDate || t.trade_date|| new Date().toISOString().slice(0,10),
      settlementDate: t.settlementDate || t.settlement_date || '',
      status:         'Pending',
      source:         'Upload',
    }));

    Storage.AuditLog.append('TRADE_FILE_UPLOADED', {
      filename: _selectedFile?.name,
      recordCount: saved.length,
    });

    Notifications.tradeUploaded({ count: saved.length });
    Toast.success(`✓ ${saved.length} trades uploaded successfully.`);

    // Log to history
    _addHistoryEntry(_selectedFile?.name, saved.length);
    _clearFile();
    _renderUploadHistory();
  }

  function _clearFile() {
    _selectedFile = null;
    _parsedTrades = [];
    const zone    = document.getElementById('drop-zone');
    const preview = document.getElementById('file-preview-area');
    const parse   = document.getElementById('parse-preview');
    const input   = document.getElementById('file-input');
    if (zone)    zone.style.display = 'block';
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (parse)   { parse.style.display = 'none';   parse.innerHTML = ''; }
    if (input)   input.value = '';
  }

  function _addHistoryEntry(filename, count) {
    const history = JSON.parse(localStorage.getItem('tret_upload_history') || '[]');
    history.unshift({ filename: filename || 'upload', count, timestamp: new Date().toISOString() });
    localStorage.setItem('tret_upload_history', JSON.stringify(history.slice(0, 20)));
  }

  return { init, _doUpload, _clearFile };
})();

function _renderUploadHistory() {
  const container = document.getElementById('upload-history');
  if (!container) return;
  const history = JSON.parse(localStorage.getItem('tret_upload_history') || '[]');

  if (!history.length) {
    container.innerHTML = `<p style="color:var(--color-text-muted);font-size:.875rem;text-align:center;padding:1.5rem 0;">No uploads yet.</p>`;
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="upload-history-item">
      <div class="upload-status-dot" style="background:var(--color-success)"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.875rem;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(h.filename)}</div>
        <div style="font-size:.75rem;color:var(--color-text-muted);">${h.count} trades · ${Utils.timeAgo(h.timestamp)}</div>
      </div>
      <span class="badge badge-success">Uploaded</span>
    </div>
  `).join('');
}

window.Upload = Upload;
