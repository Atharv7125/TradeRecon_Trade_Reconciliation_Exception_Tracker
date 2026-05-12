/**
 * validation.js — Trade Form Validation Rules
 * Trade Reconciliation Exception Tracker
 */

const Validation = (() => {

  const ASSET_CLASSES = ['Equity','Fixed Income','FX','Commodity','Derivative','Money Market','Repo'];
  const CURRENCIES    = ['USD','EUR','GBP','JPY','CHF','AUD','CAD','SGD','HKD','NOK','SEK','DKK'];
  const SIDES         = ['Buy','Sell'];

  const rules = {
    tradeId(v)     { return /^[A-Z0-9-]{3,30}$/.test(v?.trim())    || 'Trade ID must be 3–30 uppercase alphanumeric characters.'; },
    instrument(v)  { return v?.trim().length >= 2                   || 'Instrument name is required (min 2 chars).'; },
    isin(v)        { if (!v || v.trim() === 'N/A' || v.trim() === '') return true; return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v.trim()) || 'ISIN must be 12 characters (e.g. US0378331005).'; },
    quantity(v)    { const n = parseFloat(v); return (!isNaN(n) && n > 0)  || 'Quantity must be a positive number.'; },
    price(v)       { const n = parseFloat(v); return (!isNaN(n) && n >= 0) || 'Price must be zero or positive.'; },
    notional(v)    { const n = parseFloat(v); return (!isNaN(n) && n > 0)  || 'Notional must be a positive number.'; },
    tradeDate(v)   { return !!v && !isNaN(Date.parse(v))           || 'Valid trade date is required.'; },
    settlDate(v)   { return !!v && !isNaN(Date.parse(v))           || 'Valid settlement date is required.'; },
    assetClass(v)  { return ASSET_CLASSES.includes(v)              || `Asset class must be one of: ${ASSET_CLASSES.join(', ')}.`; },
    side(v)        { return SIDES.includes(v)                      || 'Side must be Buy or Sell.'; },
    currency(v)    { return CURRENCIES.includes(v)                 || 'Please select a valid currency.'; },
    counterparty(v){ return v?.trim().length >= 2                  || 'Counterparty name is required.'; },
    portfolio(v)   { return v?.trim().length >= 2                  || 'Portfolio code is required.'; },
  };

  /** Validate a single field. Returns true or error string. */
  function validateField(name, value) {
    if (!rules[name]) return true;
    return rules[name](value);
  }

  /** Validate an entire trade object. Returns { valid, errors: {field: msg} }. */
  function validateTrade(trade) {
    const errors = {};
    const fields = ['tradeId','instrument','quantity','price','notional','tradeDate','settlDate','assetClass','side','currency','counterparty','portfolio'];
    fields.forEach(f => {
      const result = validateField(f, trade[f]);
      if (result !== true) errors[f] = result;
    });
    // Cross-field: settlement >= tradeDate
    if (!errors.tradeDate && !errors.settlDate) {
      if (new Date(trade.settlDate) < new Date(trade.tradeDate)) {
        errors.settlDate = 'Settlement date cannot be before trade date.';
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /** Apply/clear DOM error for a field. */
  function setFieldError(fieldId, message) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(`${fieldId}-error`);
    if (el)  { el.classList.toggle('error', !!message); if (message) el.classList.remove('success'); else el.classList.add('success'); }
    if (err) { err.textContent = message || ''; err.style.display = message ? 'flex' : 'none'; }
  }

  /** Wire up blur-validation on a form field. */
  function attachField(fieldId, ruleName) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.addEventListener('blur', () => {
      const result = validateField(ruleName, el.value);
      setFieldError(fieldId, result === true ? '' : result);
    });
    el.addEventListener('input', () => setFieldError(fieldId, ''));
  }

  return { validateField, validateTrade, setFieldError, attachField, ASSET_CLASSES, CURRENCIES, SIDES };
})();

window.Validation = Validation;
