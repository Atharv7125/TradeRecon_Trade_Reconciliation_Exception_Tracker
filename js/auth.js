/**
 * auth.js — Authentication Controller
 * Trade Reconciliation Exception Tracker
 * Handles login / registration against localStorage via Storage.js
 */

const Auth = (() => {

  // ── Validation ─────────────────────────────────────────────────────────────
  const Validate = {
    email(val) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
    },
    password(val) {
      return val.length >= 8;
    },
    fullName(val) {
      return val.trim().length >= 2;
    },
    required(val) {
      return val !== null && val !== undefined && String(val).trim().length > 0;
    },
  };

  // ── Field Error Helpers ────────────────────────────────────────────────────
  function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(`${fieldId}-error`);
    if (field)  field.classList.add('error');
    if (errEl)  { errEl.textContent = message; errEl.style.display = 'flex'; }
  }

  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(`${fieldId}-error`);
    if (field)  field.classList.remove('error');
    if (errEl)  { errEl.textContent = ''; errEl.style.display = 'none'; }
  }

  function clearAllErrors(ids) {
    ids.forEach(id => clearFieldError(id));
  }

  function setFormAlert(alertId, message, type = 'error') {
    const el = document.getElementById(alertId);
    if (!el) return;
    el.textContent = message;
    el.className = `form-alert form-alert-${type}`;
    el.style.display = 'flex';
  }

  function clearFormAlert(alertId) {
    const el = document.getElementById(alertId);
    if (el) el.style.display = 'none';
  }

  // ── Button Loading State ───────────────────────────────────────────────────
  function setButtonLoading(btnId, loading, defaultText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="btn-spinner"></span> Processing…`
      : defaultText;
  }

  // ── Login Handler ──────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();

    const emailVal    = document.getElementById('login-email')?.value.trim() || '';
    const passwordVal = document.getElementById('login-password')?.value || '';
    const rememberMe  = document.getElementById('login-remember')?.checked || false;

    clearAllErrors(['login-email', 'login-password']);
    clearFormAlert('login-alert');

    // Validate
    let valid = true;
    if (!Validate.required(emailVal)) {
      setFieldError('login-email', 'Email address is required.'); valid = false;
    } else if (!Validate.email(emailVal)) {
      setFieldError('login-email', 'Please enter a valid email address.'); valid = false;
    }
    if (!Validate.required(passwordVal)) {
      setFieldError('login-password', 'Password is required.'); valid = false;
    }
    if (!valid) return;

    setButtonLoading('login-btn', true, 'Sign In');

    // Simulate async (would be API call in prod)
    await new Promise(r => setTimeout(r, 800));

    const result = Storage.Users.authenticate(emailVal, passwordVal);

    setButtonLoading('login-btn', false, 'Sign In');

    if (!result.success) {
      setFormAlert('login-alert', result.message);
      // Shake the form
      const form = document.getElementById('login-form');
      if (form) { form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 600); }
      return;
    }

    // Create session
    Storage.Session.create(result.user);

    // Log audit
    Storage.AuditLog.append('USER_LOGIN', { email: result.user.email }, result.user.id);

    // Seed mock data on first login
    await MockData.seed();

    // Success toast (briefly, before redirect)
    if (window.Toast) Toast.success(`Welcome back, ${result.user.fullName.split(' ')[0]}!`);

    // Redirect after brief pause
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
  }

  // ── Register Handler ───────────────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();

    const fullName = document.getElementById('reg-fullname')?.value.trim() || '';
    const email    = document.getElementById('reg-email')?.value.trim()    || '';
    const password = document.getElementById('reg-password')?.value        || '';
    const confirm  = document.getElementById('reg-confirm')?.value         || '';
    const role     = document.getElementById('reg-role')?.value            || 'Analyst';
    const firm     = document.getElementById('reg-firm')?.value.trim()     || 'Global Capital Partners';

    const fields = ['reg-fullname', 'reg-email', 'reg-password', 'reg-confirm'];
    clearAllErrors(fields);
    clearFormAlert('reg-alert');

    // Validate
    let valid = true;
    if (!Validate.fullName(fullName)) {
      setFieldError('reg-fullname', 'Please enter your full name (min 2 characters).'); valid = false;
    }
    if (!Validate.email(email)) {
      setFieldError('reg-email', 'Please enter a valid email address.'); valid = false;
    }
    if (!Validate.password(password)) {
      setFieldError('reg-password', 'Password must be at least 8 characters.'); valid = false;
    }
    if (password !== confirm) {
      setFieldError('reg-confirm', 'Passwords do not match.'); valid = false;
    }
    if (!valid) return;

    setButtonLoading('reg-btn', true, 'Create Account');
    await new Promise(r => setTimeout(r, 900));

    const result = Storage.Users.register({ fullName, email, password, role, firm });

    setButtonLoading('reg-btn', false, 'Create Account');

    if (!result.success) {
      setFormAlert('reg-alert', result.message);
      return;
    }

    // Auto-login after registration
    Storage.Session.create(result.user);
    Storage.AuditLog.append('USER_REGISTERED', { email: result.user.email }, result.user.id);

    // Seed mock data for new user
    await MockData.seed();

    setFormAlert('reg-alert', `Account created! Redirecting to your dashboard…`, 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
  }

  // ── Real-time Field Validation ─────────────────────────────────────────────
  function attachRealtimeValidation() {
    const rules = {
      'login-email':    v => Validate.email(v)    || 'Invalid email address.',
      'login-password': v => Validate.required(v) || 'Password is required.',
      'reg-fullname':   v => Validate.fullName(v) || 'Name must be at least 2 characters.',
      'reg-email':      v => Validate.email(v)    || 'Invalid email address.',
      'reg-password':   v => Validate.password(v) || 'Minimum 8 characters.',
      'reg-confirm':    v => {
        const pw = document.getElementById('reg-password')?.value || '';
        return v === pw || 'Passwords do not match.';
      },
    };

    Object.entries(rules).forEach(([id, rule]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', () => {
        const res = rule(el.value);
        if (res === true) clearFieldError(id);
        else setFieldError(id, res);
      });
      el.addEventListener('input', () => clearFieldError(id));
    });
  }

  // ── Password Strength Meter ────────────────────────────────────────────────
  function attachPasswordStrength() {
    const pwInput = document.getElementById('reg-password');
    const meter   = document.getElementById('pw-strength-meter');
    const label   = document.getElementById('pw-strength-label');
    if (!pwInput || !meter) return;

    pwInput.addEventListener('input', () => {
      const v = pwInput.value;
      let score = 0;
      if (v.length >= 8)  score++;
      if (v.length >= 12) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;

      const levels = [
        { pct: 0,   color: 'var(--color-border)',   text: '' },
        { pct: 20,  color: 'var(--color-danger)',   text: 'Very Weak' },
        { pct: 40,  color: 'var(--color-critical)', text: 'Weak' },
        { pct: 60,  color: 'var(--color-warning)',  text: 'Fair' },
        { pct: 80,  color: 'var(--color-success)',  text: 'Strong' },
        { pct: 100, color: 'var(--color-accent)',   text: 'Very Strong' },
      ];
      const lvl = levels[score] || levels[0];
      meter.style.width = lvl.pct + '%';
      meter.style.background = lvl.color;
      if (label) { label.textContent = lvl.text; label.style.color = lvl.color; }
    });
  }

  // ── Toggle Password Visibility ─────────────────────────────────────────────
  function attachPasswordToggle() {
    document.querySelectorAll('[data-toggle-password]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-password');
        const input    = document.getElementById(targetId);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
        btn.innerHTML = isText
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      });
    });
  }

  // ── Tab Switcher (Login ↔ Register) ───────────────────────────────────────
  function initTabs() {
    const loginTab  = document.getElementById('tab-login');
    const regTab    = document.getElementById('tab-register');
    const loginPane = document.getElementById('pane-login');
    const regPane   = document.getElementById('pane-register');

    function switchTo(tab) {
      if (tab === 'login') {
        loginTab?.classList.add('auth-tab-active');
        regTab?.classList.remove('auth-tab-active');
        loginPane?.classList.remove('hidden');
        regPane?.classList.add('hidden');
        loginPane?.classList.add('animate-fade-in');
      } else {
        regTab?.classList.add('auth-tab-active');
        loginTab?.classList.remove('auth-tab-active');
        regPane?.classList.remove('hidden');
        loginPane?.classList.add('hidden');
        regPane?.classList.add('animate-fade-in');
      }
    }

    loginTab?.addEventListener('click', () => switchTo('login'));
    regTab?.addEventListener('click',   () => switchTo('register'));

    // Allow switching via URL hash
    if (window.location.hash === '#register') switchTo('register');
  }

  // ── Public Init ────────────────────────────────────────────────────────────
  return {
    init() {
      // Redirect if already logged in
      redirectIfAuthenticated('dashboard.html');

      // Wire up forms
      document.getElementById('login-form')?.addEventListener('submit', handleLogin);
      document.getElementById('reg-form')?.addEventListener('submit', handleRegister);

      // UX helpers
      initTabs();
      attachRealtimeValidation();
      attachPasswordStrength();
      attachPasswordToggle();
    },
  };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => Auth.init());

window.Auth = Auth;
