/**
 * notifications.js — Notification Bus & In-App Alert Manager
 * Trade Reconciliation Exception Tracker
 */

const Notifications = (() => {
  const _subscribers = {};

  return {
    /**
     * Subscribe to a notification event type.
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      if (!_subscribers[event]) _subscribers[event] = [];
      _subscribers[event].push(handler);
    },

    /**
     * Unsubscribe a handler from an event.
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      if (!_subscribers[event]) return;
      _subscribers[event] = _subscribers[event].filter(h => h !== handler);
    },

    /**
     * Emit an event to all subscribers.
     * @param {string} event
     * @param {*} payload
     */
    emit(event, payload) {
      (_subscribers[event] || []).forEach(h => {
        try { h(payload); } catch (e) { console.error(`[Notifications] Handler error for "${event}":`, e); }
      });
    },

    // Convenience emitters
    tradeUploaded(data)     { this.emit('trade:uploaded',      data); },
    reconCompleted(data)    { this.emit('recon:completed',     data); },
    exceptionResolved(data) { this.emit('exception:resolved',  data); },
    reportExported(data)    { this.emit('report:exported',     data); },
  };
})();

window.Notifications = Notifications;
