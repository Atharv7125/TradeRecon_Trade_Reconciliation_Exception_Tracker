/**
 * utils.js — Shared Utility & Component Injection Layer
 * Trade Reconciliation Exception Tracker
 */

// ── Component Injection ────────────────────────────────────────────────────────
/**
 * Fetches an HTML component file and injects it into the target element.
 * Automatically initialises sidebar active state and user info after injection.
 * @param {string} elementId   - ID of the container element to inject into.
 * @param {string} componentPath - Relative path to the .html component file.
 * @returns {Promise<void>}
 */
async function loadComponent(elementId, componentPath) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[Utils] loadComponent: element #${elementId} not found.`);
    return;
  }
  try {
    const res = await fetch(componentPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${componentPath}`);
    const html = await res.text();
    el.innerHTML = html;

    // Post-injection hooks
    if (elementId === 'sidebar-container') {
      _initSidebar();
      _populateSidebarUser();
    }
    if (elementId === 'navbar-container') {
      _initNavbar();
    }
  } catch (err) {
    console.error(`[Utils] Failed to load component "${componentPath}":`, err);
  }
}

/**
 * Loads multiple components in parallel.
 * @param {Array<{id: string, path: string}>} components
 */
async function loadComponents(components) {
  await Promise.all(components.map(c => loadComponent(c.id, c.path)));
}

// ── Sidebar Initialisation ─────────────────────────────────────────────────────
function _initSidebar() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('#sidebar-container [data-page]');
  links.forEach(link => {
    const page = link.getAttribute('data-page');
    if (page === currentPage) {
      link.classList.add('active');
    }
  });

  // Sidebar toggle for mobile
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar   = document.getElementById('app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-collapsed');
    });
  }
}

function _populateSidebarUser() {
  const session = window.Storage?.Session?.get();
  if (!session) return;

  const avatarEl   = document.getElementById('sidebar-avatar');
  const nameEl     = document.getElementById('sidebar-user-name');
  const roleEl     = document.getElementById('sidebar-user-role');
  const firmEl     = document.getElementById('sidebar-user-firm');

  if (avatarEl) avatarEl.textContent = session.avatar || session.fullName?.slice(0, 2).toUpperCase();
  if (nameEl)   nameEl.textContent   = session.fullName;
  if (roleEl)   roleEl.textContent   = session.role;
  if (firmEl)   firmEl.textContent   = session.firm;
}

function _initNavbar() {
  const session = window.Storage?.Session?.get();
  if (!session) return;

  const avatarEl = document.getElementById('nav-user-avatar');
  const nameEl   = document.getElementById('nav-user-name');
  if (avatarEl) avatarEl.textContent = session.avatar;
  if (nameEl)   nameEl.textContent   = session.fullName;

  // Notification badge update
  const exceptions = window.Storage?.Exceptions?.getStats();
  const badgeEl    = document.getElementById('notification-badge');
  if (badgeEl && exceptions?.open > 0) {
    badgeEl.textContent = exceptions.open > 9 ? '9+' : exceptions.open;
    badgeEl.classList.remove('hidden');
  }
}

// ── Auth Guard ─────────────────────────────────────────────────────────────────
/**
 * Redirects to login.html if no valid session exists.
 * Call at the top of every protected page script.
 */
function requireAuth() {
  if (window.Storage && !window.Storage.Session.isActive()) {
    window.location.href = 'login.html';
  }
}

/**
 * Redirects authenticated users away from login/register pages.
 */
function redirectIfAuthenticated(destination = 'dashboard.html') {
  if (window.Storage && window.Storage.Session.isActive()) {
    window.location.href = destination;
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────────
const Utils = {
  /**
   * Formats a number as USD currency string.
   * @param {number} amount
   * @param {string} currency - ISO currency code
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Formats an ISO date string to a readable short date.
   * @param {string} isoString
   */
  formatDate(isoString, opts = {}) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-GB', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
      ...opts,
    });
  },

  /**
   * Formats an ISO date string to date + time.
   * @param {string} isoString
   */
  formatDateTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('en-GB', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  },

  /**
   * Formats a large number with K/M/B suffix.
   * @param {number} num
   */
  formatCompact(num) {
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  },

  /**
   * Generates a human-readable relative time string.
   * @param {string} isoString
   */
  timeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
    const intervals = [
      { label: 'year',   secs: 31536000 },
      { label: 'month',  secs: 2592000  },
      { label: 'day',    secs: 86400    },
      { label: 'hour',   secs: 3600     },
      { label: 'minute', secs: 60       },
    ];
    for (const i of intervals) {
      const count = Math.floor(seconds / i.secs);
      if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  },

  /**
   * Truncates a string to maxLen characters, appending ellipsis.
   * @param {string} str
   * @param {number} maxLen
   */
  truncate(str, maxLen = 40) {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '…';
  },

  /**
   * Debounce: delays invoking fn until after wait ms have elapsed.
   * @param {Function} fn
   * @param {number} wait
   */
  debounce(fn, wait = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  /**
   * Returns a CSS badge class name based on status string.
   * @param {string} status
   */
  statusBadgeClass(status) {
    const map = {
      'Matched':     'badge-success',
      'Exception':   'badge-danger',
      'Pending':     'badge-warning',
      'Open':        'badge-danger',
      'In Progress': 'badge-warning',
      'Resolved':    'badge-success',
      'Critical':    'badge-critical',
      'High':        'badge-high',
      'Medium':      'badge-medium',
      'Low':         'badge-low',
    };
    return map[status] || 'badge-neutral';
  },

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  /**
   * Deep-clones a plain object/array using JSON serialisation.
   * @param {*} obj
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Generates a random ID string with optional prefix.
   * @param {string} prefix
   */
  uid(prefix = '') {
    return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Downloads data as a file in the browser.
   * @param {string} content - String content of the file.
   * @param {string} filename
   * @param {string} mimeType
   */
  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Converts an array of objects to a CSV string.
   * @param {Array<Object>} data
   * @param {Array<string>} columns - Keys to include as columns.
   * @param {Object} headers - Map of key → display header label.
   */
  toCSV(data, columns, headers = {}) {
    if (!data || !data.length) return '';
    const headerRow = columns.map(c => headers[c] || c).join(',');
    const rows = data.map(row =>
      columns.map(c => {
        const val = row[c] ?? '';
        // Quote values containing commas or newlines
        const str = String(val);
        return str.includes(',') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    return [headerRow, ...rows].join('\n');
  },

  /**
   * Sorts an array of objects by a given key.
   * @param {Array<Object>} arr
   * @param {string} key
   * @param {'asc'|'desc'} direction
   */
  sortBy(arr, key, direction = 'asc') {
    return [...arr].sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (va < vb) return direction === 'asc' ? -1 : 1;
      if (va > vb) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Filters an array of objects by a search term across specified fields.
   * @param {Array<Object>} arr
   * @param {string} term
   * @param {Array<string>} fields
   */
  filterByTerm(arr, term, fields) {
    if (!term) return arr;
    const lower = term.toLowerCase();
    return arr.filter(item =>
      fields.some(f => String(item[f] ?? '').toLowerCase().includes(lower))
    );
  },
};

// ── Loader Overlay ─────────────────────────────────────────────────────────────
const Loader = {
  show(message = 'Processing...') {
    const overlay = document.getElementById('loader-overlay');
    const msg     = document.getElementById('loader-message');
    if (overlay) {
      if (msg) msg.textContent = message;
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    }
  },
  hide() {
    const overlay = document.getElementById('loader-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  },
  /** Shows loader, waits `ms` milliseconds, then hides it. */
  async runFor(ms = 3000, message = 'Processing...') {
    this.show(message);
    await new Promise(resolve => setTimeout(resolve, ms));
    this.hide();
  },

  /**
   * 4-step animated reconciliation loader.
   * Drives the loader component step indicators if present.
   * @param {number} totalMs - Total duration in milliseconds.
   */
  async runRecon(totalMs = 3000) {
    const steps = [
      { id: 'step-1', label: 'Loading trade positions…'        },
      { id: 'step-2', label: 'Fetching counterparty data…'     },
      { id: 'step-3', label: 'Applying matching rules…'        },
      { id: 'step-4', label: 'Generating exception records…'   },
    ];
    const stepDuration = totalMs / steps.length;
    const overlay = document.getElementById('loader-overlay');
    const msg     = document.getElementById('loader-message');
    const prog    = document.getElementById('loader-progress-fill');

    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

    // Reset all step indicators
    steps.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) el.className = 'loader-step loader-step-pending';
    });

    for (let i = 0; i < steps.length; i++) {
      const s  = steps[i];
      const el = document.getElementById(s.id);
      if (msg) msg.textContent = s.label;
      if (el)  el.className = 'loader-step loader-step-active';
      if (prog) prog.style.width = `${((i + 0.5) / steps.length) * 100}%`;

      await new Promise(r => setTimeout(r, stepDuration));

      if (el) el.className = 'loader-step loader-step-done';
      if (prog) prog.style.width = `${((i + 1) / steps.length) * 100}%`;
    }

    await new Promise(r => setTimeout(r, 300));
    if (overlay) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
  },
};

// ── Toast Notifications ────────────────────────────────────────────────────────
const Toast = {
  _container: null,
  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  },

  show(message, type = 'info', duration = 4000) {
    const container = this._getContainer();
    if (!container) { console.warn('[Toast] #toast-container not found.'); return; }

    const icons = {
      success: '✓',
      error:   '✕',
      warning: '⚠',
      info:    'ℹ',
    };
    const colorMap = {
      success: 'toast-success',
      error:   'toast-error',
      warning: 'toast-warning',
      info:    'toast-info',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${colorMap[type] || 'toast-info'}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span class="toast-message">${Utils.escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => this._dismiss(toast));
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this._dismiss(toast), duration);
    }
  },

  _dismiss(toast) {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  },

  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration)   { this.show(msg, 'error',   duration); },
  warning(msg, duration) { this.show(msg, 'warning',  duration); },
  info(msg, duration)    { this.show(msg, 'info',     duration); },
};

// ── Modal ──────────────────────────────────────────────────────────────────────
const Modal = {
  show({ title = 'Confirm', body = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, type = 'default' } = {}) {
    const overlay     = document.getElementById('modal-overlay');
    const titleEl     = document.getElementById('modal-title');
    const bodyEl      = document.getElementById('modal-body');
    const confirmBtn  = document.getElementById('modal-confirm-btn');
    const cancelBtn   = document.getElementById('modal-cancel-btn');

    if (!overlay) { console.warn('[Modal] #modal-overlay not found.'); return; }

    if (titleEl)    titleEl.textContent   = title;
    if (bodyEl)     bodyEl.innerHTML      = body;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className   = `modal-btn modal-btn-${type === 'danger' ? 'danger' : 'primary'}`;
      confirmBtn.onclick     = () => { this.hide(); if (onConfirm) onConfirm(); };
    }
    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
      cancelBtn.onclick     = () => { this.hide(); if (onCancel) onCancel(); };
    }

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  },

  hide() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  },
};

// ── Global Exposure ────────────────────────────────────────────────────────────
window.loadComponent  = loadComponent;
window.loadComponents = loadComponents;
window.requireAuth    = requireAuth;
window.redirectIfAuthenticated = redirectIfAuthenticated;
window.Utils   = Utils;
window.Loader  = Loader;
window.Toast   = Toast;
window.Modal   = Modal;
