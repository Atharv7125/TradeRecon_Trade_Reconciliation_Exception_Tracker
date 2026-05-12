/**
 * mockData.js — Seeds localStorage with realistic initial data.
 * Call MockData.seed() on first load (e.g., from login.html after auth).
 * Idempotent: calling it multiple times will not duplicate data.
 */

const MockData = (() => {

  async function _loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
    return res.json();
  }

  return {
    /**
     * Seeds trades, exceptions, and audit log from mock-data JSON files.
     * Only seeds if localStorage is currently empty for each key.
     * @param {object} opts
     * @param {boolean} opts.force  - If true, overwrites existing data.
     */
    async seed({ force = false } = {}) {
      try {
        const basePath = this._basePath();

        // Trades
        if (force || Storage.Trades.getAll().length === 0) {
          const trades = await _loadJSON(`${basePath}/assets/mock-data/trades.json`);
          Storage.Trades.save(trades);
          console.info(`[MockData] Seeded ${trades.length} trades.`);
        }

        // Exceptions
        if (force || Storage.Exceptions.getAll().length === 0) {
          const exceptions = await _loadJSON(`${basePath}/assets/mock-data/exceptions.json`);
          Storage.Exceptions.save(exceptions);
          console.info(`[MockData] Seeded ${exceptions.length} exceptions.`);
        }

        // Audit log
        if (force || Storage.AuditLog.getAll().length === 0) {
          const audit = await _loadJSON(`${basePath}/assets/mock-data/audit.json`);
          Storage.AuditLog.save(audit);
          console.info(`[MockData] Seeded ${audit.length} audit entries.`);
        }

        return { success: true };
      } catch (err) {
        console.error('[MockData] Seed failed:', err);
        return { success: false, error: err.message };
      }
    },

    /** Clears all app data and re-seeds from JSON files. */
    async reset() {
      Storage.clearAll();
      return this.seed({ force: true });
    },

    /**
     * Returns the base URL path (strips the current filename).
     * Works regardless of which page calls seed().
     */
    _basePath() {
      const parts = window.location.pathname.split('/');
      parts.pop(); // remove filename
      return parts.join('/') || '.';
    },
  };
})();

window.MockData = MockData;
