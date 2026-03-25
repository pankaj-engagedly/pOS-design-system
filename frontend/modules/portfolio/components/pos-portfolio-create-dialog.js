// pos-portfolio-create-dialog — Create portfolio form (name, holder, PAN, email)

import { icon } from '../../../shared/utils/icons.js';
import { createPortfolio, updatePortfolio } from '../services/portfolio-api.js';

class PosPortfolioCreateDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._loading = false;
    this._error = null;
    this._holderName = '';
    this._editPortfolio = null;
  }

  set open(val) { this._open = val; if (!val) { this._editPortfolio = null; this._holderName = ''; } this._render(); }
  set holderName(val) { this._holderName = val || ''; }
  set editPortfolio(val) { this._editPortfolio = val || null; }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.3);
          z-index: 10000;
          display: flex; align-items: center; justify-content: center;
        }
        .dialog {
          background: white; border-radius: 12px;
          width: 420px; max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .dialog-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--pos-color-border-default, #e2e2e8);
        }
        .dialog-header h3 { margin: 0; font-size: 15px; }
        .close-btn {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-tertiary); padding: 4px;
        }
        .dialog-body { padding: 20px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--pos-color-text-secondary); }
        .field input, .field textarea {
          width: 100%; padding: 8px 10px; border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box;
        }
        .field textarea { resize: vertical; height: 60px; }
        .dialog-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 12px 20px; border-top: 1px solid var(--pos-color-border-default, #e2e2e8);
        }
        .btn {
          padding: 7px 16px; border-radius: 6px; font-size: 13px;
          font-family: inherit; cursor: pointer; border: 1px solid transparent;
        }
        .btn-cancel { background: transparent; border-color: var(--pos-color-border-default); color: var(--pos-color-text-secondary); }
        .btn-primary { background: var(--pos-color-action-primary, #4361ee); color: white; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { color: #ef4444; font-size: 12px; margin-bottom: 8px; }
      </style>
      <div class="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>${this._editPortfolio ? 'Edit Portfolio' : 'New Portfolio'}</h3>
            <button class="close-btn" data-action="close">${icon('x', 18)}</button>
          </div>
          <div class="dialog-body">
            ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
            <div class="field">
              <label>Portfolio Name *</label>
              <input type="text" name="name" placeholder="e.g., My Mutual Funds" required
                     value="${this._esc(this._editPortfolio?.name || '')}">
            </div>
            <div class="field">
              <label>Holder Name *</label>
              <input type="text" name="holder_name" placeholder="e.g., Pankaj"
                     value="${this._esc(this._editPortfolio?.holder_name || this._holderName || '')}">
            </div>
            <div class="field">
              <label>PAN</label>
              <input type="text" name="pan" placeholder="e.g., ABCDE1234F" maxlength="10" style="text-transform: uppercase;"
                     value="${this._esc(this._editPortfolio?.pan || '')}">
            </div>
            <div class="field">
              <label>Email</label>
              <input type="email" name="email" placeholder="Email associated with this account"
                     value="${this._esc(this._editPortfolio?.email || '')}">
            </div>
            <div class="field">
              <label>Description</label>
              <textarea name="description" placeholder="Optional notes">${this._esc(this._editPortfolio?.description || '')}</textarea>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn btn-cancel" data-action="close">Cancel</button>
            <button class="btn btn-primary" data-action="save" ${this._loading ? 'disabled' : ''}>
              ${this._loading ? 'Saving...' : (this._editPortfolio ? 'Save Changes' : 'Create Portfolio')}
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
      if (e.key === 'Escape') { this._open = false; this._error = null; this._render(); }
    });
  }

  async _save() {
    const name = this.shadow.querySelector('input[name="name"]')?.value?.trim();
    const holder_name = this.shadow.querySelector('input[name="holder_name"]')?.value?.trim();
    if (!name || !holder_name) { this._error = 'Name and holder name are required'; this._render(); return; }

    const data = {
      name,
      holder_name,
      pan: this.shadow.querySelector('input[name="pan"]')?.value?.trim().toUpperCase() || null,
      email: this.shadow.querySelector('input[name="email"]')?.value?.trim() || null,
      description: this.shadow.querySelector('textarea[name="description"]')?.value?.trim() || null,
    };

    this._loading = true;
    this._render();

    try {
      if (this._editPortfolio) {
        await updatePortfolio(this._editPortfolio.id, data);
      } else {
        await createPortfolio(data);
      }
      this._open = false;
      this._loading = false;
      this._error = null;
      this._editPortfolio = null;
      this._holderName = '';
      this._render();
      this.dispatchEvent(new CustomEvent('portfolio-created', { bubbles: true, composed: true }));
    } catch (err) {
      this._loading = false;
      this._error = err.message;
      this._render();
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-create-dialog', PosPortfolioCreateDialog);
