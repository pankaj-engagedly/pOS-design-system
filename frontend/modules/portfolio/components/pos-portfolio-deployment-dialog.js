// pos-portfolio-deployment-dialog — Record deployment (append-only)

import { icon } from '../../../shared/utils/icons.js';
import { createDeployment } from '../services/portfolio-api.js';

class PosPortfolioDeploymentDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._allocationId = null;
    this._loading = false;
    this._error = null;
  }

  set open(val) { this._open = val; this._error = null; this._render(); }
  set allocationId(val) { this._allocationId = val; }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    const today = new Date().toISOString().split('T')[0];

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 10000; display: flex; align-items: center; justify-content: center; }
        .dialog { background: white; border-radius: 12px; width: 400px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e2e8; }
        .dialog-header h3 { margin: 0; font-size: 15px; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--pos-color-text-tertiary); padding: 4px; }
        .dialog-body { padding: 20px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--pos-color-text-secondary); }
        .field input, .field textarea { width: 100%; padding: 8px 10px; border: 1px solid #e2e2e8; border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #e2e2e8; }
        .btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
        .btn-cancel { background: transparent; border-color: #e2e2e8; color: var(--pos-color-text-secondary); }
        .btn-primary { background: var(--pos-color-action-primary, #4361ee); color: white; }
        .btn-primary:disabled { opacity: 0.6; }
        .error { color: #ef4444; font-size: 12px; margin-bottom: 8px; }
        .hint { font-size: 11px; color: var(--pos-color-text-tertiary); margin-top: 8px; }
      </style>
      <div class="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>Record Deployment</h3>
            <button class="close-btn" data-action="close">${icon('x', 18)}</button>
          </div>
          <div class="dialog-body">
            ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
            <div class="field">
              <label>Date *</label>
              <input type="date" name="event_date" value="${today}">
            </div>
            <div class="field">
              <label>Amount *</label>
              <input type="number" name="amount" placeholder="10000" step="0.01">
            </div>
            <div class="field">
              <label>Units (optional)</label>
              <input type="number" name="units" placeholder="e.g., 30.5" step="0.0001">
            </div>
            <div class="field">
              <label>Price per Unit (optional)</label>
              <input type="number" name="price_per_unit" placeholder="e.g., 3150" step="0.01">
            </div>
            <div class="field">
              <label>Notes</label>
              <textarea name="notes" rows="2" placeholder="e.g., Bought on market dip"></textarea>
            </div>
            <div class="hint">Deployment events are immutable. Use negative amounts for corrections.</div>
          </div>
          <div class="dialog-footer">
            <button class="btn btn-cancel" data-action="close">Cancel</button>
            <button class="btn btn-primary" data-action="save" ${this._loading ? 'disabled' : ''}>
              ${this._loading ? 'Recording...' : 'Record'}
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
    const eventDate = this.shadow.querySelector('[name="event_date"]')?.value;
    const amount = this.shadow.querySelector('[name="amount"]')?.value;

    if (!eventDate || !amount) {
      this._error = 'Date and amount are required';
      this._render();
      return;
    }

    const data = {
      event_date: eventDate,
      amount: Number(amount),
      units: this.shadow.querySelector('[name="units"]')?.value ? Number(this.shadow.querySelector('[name="units"]').value) : null,
      price_per_unit: this.shadow.querySelector('[name="price_per_unit"]')?.value ? Number(this.shadow.querySelector('[name="price_per_unit"]').value) : null,
      notes: this.shadow.querySelector('[name="notes"]')?.value?.trim() || null,
    };

    this._loading = true; this._render();

    try {
      await createDeployment(this._allocationId, data);
      this._open = false; this._loading = false; this._error = null; this._render();
      this.dispatchEvent(new CustomEvent('deployment-created', { bubbles: true, composed: true }));
    } catch (err) {
      this._loading = false; this._error = err.message; this._render();
    }
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}

customElements.define('pos-portfolio-deployment-dialog', PosPortfolioDeploymentDialog);
