// pos-portfolio-plan-create-dialog — Create investment plan form

import { icon } from '../../../shared/utils/icons.js';
import { createPlan } from '../services/portfolio-api.js';

class PosPortfolioPlanCreateDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._loading = false;
    this._error = null;
  }

  set open(val) { this._open = val; this._render(); }

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
        .dialog { background: white; border-radius: 12px; width: 420px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
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
      </style>
      <div class="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>New Investment Plan</h3>
            <button class="close-btn" data-action="close">${icon('x', 18)}</button>
          </div>
          <div class="dialog-body">
            ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
            <div class="field">
              <label>Plan Name *</label>
              <input type="text" name="name" placeholder="e.g., Q2 2026 Deployment">
            </div>
            <div class="field">
              <label>Total Corpus *</label>
              <input type="number" name="total_corpus" placeholder="100000" min="0" step="1000">
            </div>
            <div class="field">
              <label>Start Date *</label>
              <input type="date" name="start_date" value="${today}">
            </div>
            <div class="field">
              <label>End Date (optional)</label>
              <input type="date" name="end_date">
            </div>
            <div class="field">
              <label>Notes</label>
              <textarea name="notes" rows="2" placeholder="Optional notes"></textarea>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn btn-cancel" data-action="close">Cancel</button>
            <button class="btn btn-primary" data-action="save" ${this._loading ? 'disabled' : ''}>
              ${this._loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'close') { this._open = false; this._error = null; this._render(); }
      if (action === 'save') await this._save();
    });
    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this._open = false; this._render(); }
    });
  }

  async _save() {
    const name = this.shadow.querySelector('[name="name"]')?.value?.trim();
    const corpus = this.shadow.querySelector('[name="total_corpus"]')?.value;
    const startDate = this.shadow.querySelector('[name="start_date"]')?.value;

    if (!name || !corpus || !startDate) {
      this._error = 'Name, corpus, and start date are required';
      this._render();
      return;
    }

    const data = {
      name,
      total_corpus: Number(corpus),
      start_date: startDate,
      end_date: this.shadow.querySelector('[name="end_date"]')?.value || null,
      notes: this.shadow.querySelector('[name="notes"]')?.value?.trim() || null,
    };

    this._loading = true; this._render();

    try {
      await createPlan(data);
      this._open = false; this._loading = false; this._error = null; this._render();
      this.dispatchEvent(new CustomEvent('plan-created', { bubbles: true, composed: true }));
    } catch (err) {
      this._loading = false; this._error = err.message; this._render();
    }
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}

customElements.define('pos-portfolio-plan-create-dialog', PosPortfolioPlanCreateDialog);
