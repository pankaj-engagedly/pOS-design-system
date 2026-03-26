// pos-expense-account-dialog — Create/edit account dialog

import { createAccount, updateAccount } from '../services/expense-api.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: none; position: fixed; inset: 0; z-index: 2000; }
  :host([open]) { display: flex; align-items: center; justify-content: center; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
  .dialog {
    position: relative; background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-lg); padding: var(--pos-space-lg);
    min-width: 400px; max-width: 480px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  h3 { margin: 0 0 var(--pos-space-md); }
  .form-group { margin-bottom: var(--pos-space-sm); }
  label { display: block; font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); margin-bottom: 4px; }
  input, select {
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
  .close-btn {
    position: absolute; top: 12px; right: 12px; background: none; border: none;
    cursor: pointer; color: var(--pos-color-text-secondary); font-size: 18px; padding: 4px;
  }
`);

const BANKS = ['HDFC', 'Kotak', 'Standard Chartered', 'Bank of Baroda', 'Canara Bank', 'SBI', 'ICICI', 'Axis', 'IDFC First', 'Yes Bank', 'Other'];

class PosExpenseAccountDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._account = null;
  }

  open(account = null) {
    this._account = account;
    this._render();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    this._account = null;
  }

  connectedCallback() {
    this._bindEvents();
  }

  _render() {
    const a = this._account;
    const isEdit = !!a;

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <button class="close-btn" data-action="close">&times;</button>
        <h3>${isEdit ? 'Edit Account' : 'New Account'}</h3>
        <form>
          <div class="form-group">
            <label>Account Name</label>
            <input name="name" value="${a?.name || ''}" placeholder="e.g. HDFC Savings" required>
          </div>
          <div class="form-group">
            <label>Bank</label>
            <select name="bank">
              ${BANKS.map(b => `<option value="${b}" ${a?.bank === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="type">
              <option value="savings" ${a?.type === 'savings' ? 'selected' : ''}>Savings</option>
              <option value="current" ${a?.type === 'current' ? 'selected' : ''}>Current</option>
              <option value="credit_card" ${a?.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
              <option value="wallet" ${a?.type === 'wallet' ? 'selected' : ''}>Wallet</option>
              <option value="cash" ${a?.type === 'cash' ? 'selected' : ''}>Cash</option>
            </select>
          </div>
          <div class="form-group">
            <label>Owner</label>
            <input name="owner_label" value="${a?.owner_label || ''}" placeholder="e.g. Pankaj, Wife">
          </div>
          <div class="form-group">
            <label>Account Number (masked)</label>
            <input name="account_number_masked" value="${a?.account_number_masked || ''}" placeholder="e.g. XX1234">
          </div>
          <div class="actions">
            <button type="button" data-action="close">Cancel</button>
            <button type="submit" class="primary">${isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.shadow.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value.trim(),
        bank: form.bank.value,
        type: form.type.value,
        owner_label: form.owner_label.value.trim(),
        account_number_masked: form.account_number_masked.value.trim() || null,
      };

      try {
        if (this._account) {
          await updateAccount(this._account.id, data);
        } else {
          await createAccount(data);
        }
        this.close();
        this.dispatchEvent(new CustomEvent('account-saved', { bubbles: true, composed: true }));
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

customElements.define('pos-expense-account-dialog', PosExpenseAccountDialog);
