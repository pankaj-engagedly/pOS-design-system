// pos-expense-transactions — Transaction table with inline category edit, filters, import button

import { icon } from '../../../shared/utils/icons.js';
import { updateTransaction } from '../services/expense-api.js';
import store from '../store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  :host([hidden]) { display: none; }

  .header { display: flex; align-items: center; gap: var(--pos-space-sm); padding: var(--pos-space-md) var(--pos-space-lg) var(--pos-space-sm); flex-shrink: 0; }
  .header h2 { margin: 0; font-size: var(--pos-font-size-lg); font-weight: var(--pos-font-weight-bold); flex: 1; }
  .header-btn {
    display: inline-flex; align-items: center; gap: var(--pos-space-xs);
    padding: 6px 12px; border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); cursor: pointer; border: none;
    background: var(--pos-color-action-primary); color: white;
  }
  .header-btn:hover { opacity: 0.9; }

  .filters { display: flex; gap: var(--pos-space-sm); padding: 0 var(--pos-space-lg) var(--pos-space-sm); flex-shrink: 0; }
  .filters input, .filters select {
    padding: 4px 8px; border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
  }

  .scroll { flex: 1; overflow-y: auto; padding: 0 var(--pos-space-lg) var(--pos-space-lg); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: var(--pos-font-size-xs); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding: var(--pos-space-xs) var(--pos-space-sm); border-bottom: 1px solid var(--pos-color-border-default); position: sticky; top: 0; background: var(--pos-color-background-primary); }
  td { padding: var(--pos-space-xs) var(--pos-space-sm); font-size: var(--pos-font-size-sm); border-bottom: 1px solid var(--pos-color-border-subtle, var(--pos-color-border-default)); color: var(--pos-color-text-primary); }

  .amount-debit { color: var(--pos-color-status-error); font-weight: var(--pos-font-weight-medium); }
  .amount-credit { color: var(--pos-color-status-success); font-weight: var(--pos-font-weight-medium); }

  .transfer-badge {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--pos-color-background-secondary); color: var(--pos-color-text-secondary);
  }

  .category-cell { cursor: pointer; }
  .category-cell:hover { text-decoration: underline; }
  .uncat { color: var(--pos-color-text-tertiary); font-style: italic; }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
`);

class PosExpenseTransactions extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._transactions = [];
    this._categories = [];
    this._accounts = [];
  }

  set transactions(val) { this._transactions = val || []; this._render(); }
  set categories(val) { this._categories = val || []; }
  set accounts(val) { this._accounts = val || []; }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    const txns = this._transactions;
    const state = store.getState();
    const account = state.selectedAccountId
      ? state.accounts.find(a => a.id === state.selectedAccountId)
      : null;

    const title = account ? account.name : (
      state.selectedView === 'uncategorized' ? 'Uncategorized' : 'All Transactions'
    );

    const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    this.shadow.innerHTML = `
      <div class="header">
        <h2>${this._esc(title)}</h2>
        ${account ? `<button class="header-btn" data-action="import">${icon('upload', 14)} Import</button>` : ''}
      </div>

      <div class="scroll">
        ${txns.length === 0 ? `
          <div class="empty">
            ${account ? 'No transactions yet. Import a statement to get started.' : 'No transactions found.'}
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th style="text-align:right">Amount</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map(t => `
                <tr>
                  <td>${t.date}</td>
                  <td>
                    ${this._esc(t.merchant || t.description)}
                    ${t.is_transfer ? '<span class="transfer-badge">Transfer</span>' : ''}
                    ${t.merchant && t.merchant !== t.description ? `<br><span style="font-size:11px;color:var(--pos-color-text-tertiary)">${this._esc(t.description.substring(0, 60))}</span>` : ''}
                  </td>
                  <td class="category-cell" data-action="change-category" data-txn-id="${t.id}">
                    ${t.category_name ? this._esc(t.category_name) : '<span class="uncat">Uncategorized</span>'}
                  </td>
                  <td style="text-align:right" class="${t.txn_type === 'debit' ? 'amount-debit' : 'amount-credit'}">
                    ${t.txn_type === 'debit' ? '-' : '+'}${fmt(t.amount)}
                  </td>
                  <td style="font-size:12px;color:var(--pos-color-text-secondary)">${this._esc(t.account_name || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      if (actionEl.dataset.action === 'import') {
        this.dispatchEvent(new CustomEvent('open-import', {
          bubbles: true, composed: true,
          detail: { accountId: store.getState().selectedAccountId },
        }));
      }

      if (actionEl.dataset.action === 'change-category') {
        // Simple prompt for now — will be replaced with dropdown in polish phase
        const txnId = actionEl.dataset.txnId;
        const categories = store.getState().categories || [];
        if (categories.length === 0) {
          // Load categories if not cached
          const { getCategories } = await import('../services/expense-api.js');
          const cats = await getCategories();
          store.setState({ categories: cats });
        }

        const cats = store.getState().categories;
        const leafCats = cats.filter(c => c.parent_id); // subcategories only
        const options = leafCats.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
        const choice = prompt(`Select category:\n${options}\n\nEnter number:`);
        if (!choice) return;

        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < leafCats.length) {
          await updateTransaction(txnId, { category_id: leafCats[idx].id });
          // Refresh
          this.dispatchEvent(new CustomEvent('transaction-updated', { bubbles: true, composed: true }));

          const state = store.getState();
          const { getTransactions } = await import('../services/expense-api.js');
          const params = {};
          if (state.selectedAccountId) params.account_id = state.selectedAccountId;
          if (state.selectedView === 'uncategorized') params.uncategorized_only = true;
          const txns = await getTransactions(params);
          store.setState({ transactions: txns });
        }
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-transactions', PosExpenseTransactions);
