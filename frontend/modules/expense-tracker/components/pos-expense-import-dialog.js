// pos-expense-import-dialog — Import statement file upload

import { importStatement } from '../services/expense-api.js';
import store from '../store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: none; position: fixed; inset: 0; z-index: 2000; }
  :host([open]) { display: flex; align-items: center; justify-content: center; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
  .dialog {
    position: relative; background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-lg); padding: var(--pos-space-lg);
    min-width: 420px; max-width: 500px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  h3 { margin: 0 0 var(--pos-space-md); }
  .form-group { margin-bottom: var(--pos-space-sm); }
  label { display: block; font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); margin-bottom: 4px; }
  select, input[type="file"] {
    width: 100%; padding: 8px; border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
    box-sizing: border-box;
  }
  .actions { display: flex; justify-content: flex-end; gap: var(--pos-space-sm); margin-top: var(--pos-space-md); }
  button {
    padding: 8px 16px; border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    cursor: pointer; border: 1px solid var(--pos-color-border-default);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
  }
  button.primary { background: var(--pos-color-action-primary); color: white; border: none; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .close-btn {
    position: absolute; top: 12px; right: 12px; background: none; border: none;
    cursor: pointer; color: var(--pos-color-text-secondary); font-size: 18px; padding: 4px;
  }
  .result { margin-top: var(--pos-space-md); padding: var(--pos-space-sm); border-radius: var(--pos-radius-sm); background: var(--pos-color-background-secondary); font-size: var(--pos-font-size-sm); }
  .result-line { display: flex; justify-content: space-between; padding: 2px 0; }
  .result-value { font-weight: var(--pos-font-weight-medium); }
  .error { color: var(--pos-color-status-error); margin-top: var(--pos-space-sm); font-size: var(--pos-font-size-sm); }
`);

class PosExpenseImportDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._accountId = null;
    this._importing = false;
    this._result = null;
    this._error = null;
  }

  open(accountId = null) {
    this._accountId = accountId;
    this._result = null;
    this._error = null;
    this._importing = false;
    this._render();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    if (this._result) {
      this.dispatchEvent(new CustomEvent('import-complete', { bubbles: true, composed: true }));
    }
  }

  connectedCallback() {
    this._bindEvents();
  }

  _render() {
    const accounts = store.getState().accounts || [];

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <button class="close-btn" data-action="close">&times;</button>
        <h3>Import Statement</h3>
        <form>
          <div class="form-group">
            <label>Account</label>
            <select name="account_id" ${this._accountId ? 'disabled' : ''}>
              ${accounts.map(a => `
                <option value="${a.id}" ${a.id === this._accountId ? 'selected' : ''}>
                  ${a.name} (${a.bank})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Statement File (CSV, XLS, XLSX)</label>
            <input type="file" name="file" accept=".csv,.xls,.xlsx" required>
          </div>
          <div class="actions">
            <button type="button" data-action="close">Cancel</button>
            <button type="submit" class="primary" ${this._importing ? 'disabled' : ''}>
              ${this._importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
        ${this._error ? `<div class="error">${this._error}</div>` : ''}
        ${this._result ? this._renderResult() : ''}
      </div>
    `;
  }

  _renderResult() {
    const r = this._result;
    return `
      <div class="result">
        <div class="result-line"><span>Total parsed</span><span class="result-value">${r.total_parsed}</span></div>
        <div class="result-line"><span>New transactions</span><span class="result-value">${r.new_transactions}</span></div>
        <div class="result-line"><span>Duplicates skipped</span><span class="result-value">${r.duplicates_skipped}</span></div>
        <div class="result-line"><span>Auto-categorized</span><span class="result-value">${r.auto_categorized}</span></div>
        <div class="result-line"><span>Uncategorized</span><span class="result-value">${r.uncategorized}</span></div>
        <div class="result-line"><span>Transfers detected</span><span class="result-value">${r.transfers_detected}</span></div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) this.close();
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.shadow.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const accountId = this._accountId || form.account_id.value;
      const file = form.file.files[0];
      if (!file || !accountId) return;

      this._importing = true;
      this._error = null;
      this._render();

      try {
        this._result = await importStatement(accountId, file);
        this._importing = false;
        this._render();
      } catch (err) {
        this._importing = false;
        this._error = err.message;
        this._render();
      }
    });
  }
}

customElements.define('pos-expense-import-dialog', PosExpenseImportDialog);
