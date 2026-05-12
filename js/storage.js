/**
 * storage.js — LocalStorage Abstraction Layer
 * Trade Reconciliation Exception Tracker
 * Handles all read/write operations for users, sessions, and trade data.
 */

const Storage = (() => {
  // ── Key Registry ────────────────────────────────────────────────────────────
  const KEYS = {
    USERS:      'tret_users',
    SESSION:    'tret_session',
    TRADES:     'tret_trades',
    EXCEPTIONS: 'tret_exceptions',
    AUDIT_LOG:  'tret_audit_log',
    SETTINGS:   'tret_settings',
    RECON_RUNS: 'tret_recon_runs',
  };

  // ── Private Helpers ─────────────────────────────────────────────────────────
  const _get = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error(`[Storage] Read error for key "${key}":`, e);
      return null;
    }
  };

  const _set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] Write error for key "${key}":`, e);
      return false;
    }
  };

  const _remove = (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[Storage] Remove error for key "${key}":`, e);
      return false;
    }
  };

  // ── User Management ─────────────────────────────────────────────────────────
  const Users = {
    /**
     * Retrieves all registered users.
     * @returns {Array} Array of user objects.
     */
    getAll() {
      return _get(KEYS.USERS) || [];
    },

    /**
     * Finds a user by email address (case-insensitive).
     * @param {string} email
     * @returns {Object|null} User object or null.
     */
    findByEmail(email) {
      const users = this.getAll();
      return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    /**
     * Finds a user by their unique ID.
     * @param {string} id
     * @returns {Object|null}
     */
    findById(id) {
      const users = this.getAll();
      return users.find(u => u.id === id) || null;
    },

    /**
     * Registers a new user if the email is not already taken.
     * @param {Object} userData - { fullName, email, password, role, firm }
     * @returns {{ success: boolean, message: string, user?: Object }}
     */
    register(userData) {
      if (!userData.email || !userData.password || !userData.fullName) {
        return { success: false, message: 'Missing required fields.' };
      }
      if (this.findByEmail(userData.email)) {
        return { success: false, message: 'An account with this email already exists.' };
      }

      const users = this.getAll();
      const newUser = {
        id:        `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fullName:  userData.fullName.trim(),
        email:     userData.email.toLowerCase().trim(),
        password:  userData.password, // NOTE: plain text for demo; hash in production
        role:      userData.role || 'Analyst',
        firm:      userData.firm || 'Global Capital Partners',
        avatar:    userData.fullName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        createdAt: new Date().toISOString(),
        lastLogin: null,
        preferences: {
          theme: 'dark',
          notifications: true,
          defaultView: 'dashboard',
        },
      };

      users.push(newUser);
      _set(KEYS.USERS, users);
      return { success: true, message: 'Registration successful.', user: newUser };
    },

    /**
     * Validates credentials and returns the user if valid.
     * @param {string} email
     * @param {string} password
     * @returns {{ success: boolean, message: string, user?: Object }}
     */
    authenticate(email, password) {
      const user = this.findByEmail(email);
      if (!user) {
        return { success: false, message: 'No account found with this email address.' };
      }
      if (user.password !== password) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      // Update last login timestamp
      this.update(user.id, { lastLogin: new Date().toISOString() });
      return { success: true, message: 'Login successful.', user };
    },

    /**
     * Updates a user's properties by ID.
     * @param {string} id
     * @param {Object} updates - Partial user object.
     * @returns {boolean}
     */
    update(id, updates) {
      const users = this.getAll();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
      return _set(KEYS.USERS, users);
    },

    /** Directly saves the full user array (after edits). */
    save(usersArray) {
      return _set(KEYS.USERS, usersArray);
    },
  };

  // ── Session Management ───────────────────────────────────────────────────────
  const Session = {
    /**
     * Creates a new session for the authenticated user.
     * @param {Object} user
     */
    create(user) {
      const session = {
        userId:    user.id,
        email:     user.email,
        fullName:  user.fullName,
        role:      user.role,
        firm:      user.firm,
        avatar:    user.avatar,
        token:     `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
      };
      _set(KEYS.SESSION, session);
      return session;
    },

    /**
     * Returns the current active session, or null if expired/absent.
     * @returns {Object|null}
     */
    get() {
      const session = _get(KEYS.SESSION);
      if (!session) return null;
      if (new Date(session.expiresAt) < new Date()) {
        this.destroy();
        return null;
      }
      return session;
    },

    /**
     * Checks if a valid session exists.
     * @returns {boolean}
     */
    isActive() {
      return this.get() !== null;
    },

    /**
     * Destroys the current session (logout).
     */
    destroy() {
      _remove(KEYS.SESSION);
    },

    /** Alias: clear is same as destroy */
    clear() { this.destroy(); },

    /** Overwrites session with updated data (e.g., after profile edit). */
    save(sessionData) {
      return _set(KEYS.SESSION, sessionData);
    },
  };

  // ── Trade Data ───────────────────────────────────────────────────────────────
  const Trades = {
    getAll() {
      return _get(KEYS.TRADES) || [];
    },

    save(tradesArray) {
      return _set(KEYS.TRADES, tradesArray);
    },

    add(trade) {
      const trades = this.getAll();
      const newTrade = {
        id: `trd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uploadedAt: new Date().toISOString(),
        ...trade,
      };
      trades.push(newTrade);
      _set(KEYS.TRADES, trades);
      return newTrade;
    },

    findById(id) {
      return this.getAll().find(t => t.id === id) || null;
    },

    clear() {
      return _remove(KEYS.TRADES);
    },

    getStats() {
      const trades = this.getAll();
      const total = trades.length;
      const matched = trades.filter(t => t.status === 'Matched').length;
      const exceptions = trades.filter(t => t.status === 'Exception').length;
      const pending = trades.filter(t => t.status === 'Pending').length;
      const totalNotional = trades.reduce((sum, t) => sum + (parseFloat(t.notional) || 0), 0);
      return { total, matched, exceptions, pending, totalNotional, matchRate: total ? ((matched / total) * 100).toFixed(1) : 0 };
    },
  };

  // ── Exceptions ───────────────────────────────────────────────────────────────
  const Exceptions = {
    getAll() {
      return _get(KEYS.EXCEPTIONS) || [];
    },

    save(exceptionsArray) {
      return _set(KEYS.EXCEPTIONS, exceptionsArray);
    },

    updateStatus(exceptionId, status, resolvedBy = null) {
      const exceptions = this.getAll();
      const idx = exceptions.findIndex(e => e.id === exceptionId);
      if (idx === -1) return false;
      exceptions[idx].status = status;
      exceptions[idx].resolvedAt = status === 'Resolved' ? new Date().toISOString() : null;
      exceptions[idx].resolvedBy = resolvedBy;
      return _set(KEYS.EXCEPTIONS, exceptions);
    },

    getStats() {
      const exceptions = this.getAll();
      return {
        total:      exceptions.length,
        open:       exceptions.filter(e => e.status === 'Open').length,
        inProgress: exceptions.filter(e => e.status === 'In Progress').length,
        resolved:   exceptions.filter(e => e.status === 'Resolved').length,
        critical:   exceptions.filter(e => e.severity === 'Critical').length,
      };
    },
  };

  // ── Audit Log ────────────────────────────────────────────────────────────────
  const AuditLog = {
    getAll() {
      return _get(KEYS.AUDIT_LOG) || [];
    },

    append(action, details = {}, userId = null) {
      const log = this.getAll();
      const session = Session.get();
      log.unshift({
        id:        `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action,
        details,
        userId:    userId || session?.userId || 'system',
        userEmail: session?.email || 'system',
        userName:  session?.fullName || 'System',
        timestamp: new Date().toISOString(),
        ip:        '192.168.1.' + Math.floor(Math.random() * 254 + 1), // mocked
      });
      // Keep only last 500 entries
      _set(KEYS.AUDIT_LOG, log.slice(0, 500));
    },

    save(auditArray) {
      return _set(KEYS.AUDIT_LOG, auditArray);
    },

    clear() {
      return _remove(KEYS.AUDIT_LOG);
    },
  };

  // ── Reconciliation Runs ──────────────────────────────────────────────────────
  const ReconRuns = {
    getAll() {
      return _get(KEYS.RECON_RUNS) || [];
    },

    save(run) {
      const runs = this.getAll();
      runs.unshift({ id: `run_${Date.now()}`, ...run, timestamp: new Date().toISOString() });
      _set(KEYS.RECON_RUNS, runs.slice(0, 50));
      return runs[0];
    },

    getLatest() {
      return this.getAll()[0] || null;
    },
  };

  // ── Settings ─────────────────────────────────────────────────────────────────
  const Settings = {
    get() {
      return _get(KEYS.SETTINGS) || { theme: 'dark', notifications: true };
    },
    update(updates) {
      const current = this.get();
      return _set(KEYS.SETTINGS, { ...current, ...updates });
    },
  };

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    KEYS,
    Users,
    Session,
    Trades,
    Exceptions,
    AuditLog,
    ReconRuns,
    Settings,
    /** Wipes all app data from localStorage (use with caution). */
    clearAll() {
      Object.values(KEYS).forEach(k => _remove(k));
    },
  };
})();

// Make globally available
window.Storage = Storage;
