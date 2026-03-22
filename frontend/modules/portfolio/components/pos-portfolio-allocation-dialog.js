// pos-portfolio-allocation-dialog — Add allocation to a plan

import { icon } from '../../../shared/utils/icons.js';
import { createAllocation } from '../services/portfolio-api.js';

class PosPortfolioAllocationDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._planId = null;
    this._loading = false;
    this._error = null;
  }

  set open(val) { this._open = val; this._error = null; this._render(); }
  set planId(val) { this._planId = val; }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 10000; display: flex; align-items: center; justify-content: center; }
        .dialog { background: white; border-radius: 12px; width: 420px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e2e8; }
        .dialog-header h3 { margin: 0; font-size: 15px; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--pos-color-text-tertiary); padding: 4px; }
        .dialog-body { padding: 20px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--pos-color-text-secondary); }
        .field input, .field select { width: 100%; padding: 8px 10px; border: 1px solid #e2e2e8; border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #e2e2e8; }
        .btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
        .btn-cancel { background: transparent; border-color: #e2e2e8; color: var(--pos-color-text-secondary); }
        .btn-primary { background: var(--pos-color-action-primary, #4361ee); color: white; }
        .btn-primary:disabled { opacity: 0.6; }
        .error { color: #ef4444; font-size: 12px; margin-bottom: 8px; }
      </style>
      <div class="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>Add Allocation</h3>
            <button class="close-btn" data-action="close">${icon('x', 18)}</button>
          </div>
          <div class="dialog-body">
            ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
            <div class="field">
              <label>Asset Name *</label>
              <input type="text" name="asset_name" placeholder="e.g., Parag Parikh Flexi Cap">
            </div>
            <div class="field">
              <label>ISIN / Ticker *</label>
              <input type="text" name="asset_identifier" placeholder="e.g., INF846K01EW2 or TCS.NS">
            </div>
            <div class="field">
              <label>Asset Type *</label>
              <select name="asset_type">
                <option value="mutual_fund">Mutual Fund</option>
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="gold">Gold</option>
                <option value="bond">Bond</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div class="field">
              <label>Target Amount *</label>
              <input type="number" name="target_amount" placeholder="20000" min="0" step="100">
            </div>
            <div class="field">
              <label>Target Buy Price (optional)</label>
              <input type="number" name="target_price" placeholder="Buy below this price" min="0" step="0.01">
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn btn-cancel" data-action="close">Cancel</button>
            <button class="btn btn-primary" data-action="save" ${this._loading ? 'disabled' : ''}>
              ${this._loading ? 'Adding...' : 'Add Allocation'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'close') { this._open = false; this._render(); }
      if (action === 'save') await this._save();
    });
    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this._open = false; this._render(); }
    });
  }

  async _save() {
    const name = this.shadow.querySelector('[name="asset_name"]')?.value?.trim();
    const identifier = this.shadow.querySelector('[name="asset_identifier"]')?.value?.trim();
    const amount = this.shadow.querySelector('[name="target_amount"]')?.value;

    if (!name || !identifier || !amount) {
      this._error = 'Asset name, identifier, and target amount are required';
      this._render();
      return;
    }

    const data = {
      asset_name: name,
      asset_identifier: identifier,
      asset_type: this.shadow.querySelector('[name="asset_type"]')?.value,
      target_amount: Number(amount),
      target_price: this.shadow.querySelector('[name="target_price"]')?.value ? Number(this.shadow.querySelector('[name="target_price"]').value) : null,
    };

    this._loading = true; this._render();

    try {
      await createAllocation(this._planId, data);
      this._open = false; this._loading = false; this._error = null; this._render();
      this.dispatchEvent(new CustomEvent('allocation-created', { bubbles: true, composed: true }));
    } catch (err) {
      this._loading = false; this._error = err.message; this._render();
    }
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}

customElements.define('pos-portfolio-allocation-dialog', PosPortfolioAllocationDialog);
