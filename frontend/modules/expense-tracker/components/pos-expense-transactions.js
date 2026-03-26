// pos-expense-transactions — Transaction table with inline category dropdowns

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

  .scroll { flex: 1; overflow-y: auto; padding: 0 var(--pos-space-lg) var(--pos-space-lg); }

  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: var(--pos-font-size-xs); font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;
    padding: var(--pos-space-xs) var(--pos-space-sm); border-bottom: 1px solid var(--pos-color-border-default);
    position: sticky; top: 0; background: var(--pos-color-background-primary); z-index: 1;
    white-space: nowrap;
  }
  td {
    padding: 6px var(--pos-space-sm); font-size: var(--pos-font-size-sm);
    border-bottom: 1px solid var(--pos-color-border-subtle, var(--pos-color-border-default));
    color: var(--pos-color-text-primary); vertical-align: middle;
  }

  .col-date { width: 90px; white-space: nowrap; color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs); }
  .col-account { width: 110px; font-size: 12px; color: var(--pos-color-text-secondary); }
  .col-desc { min-width: 200px; }
  .col-category { width: 130px; }
  .col-subcat { width: 130px; }
  .col-debit { width: 100px; text-align: right; }
  .col-credit { width: 100px; text-align: right; }

  .amount-debit { color: var(--pos-color-status-error); font-weight: var(--pos-font-weight-medium); font-variant-numeric: tabular-nums; }
  .amount-credit { color: var(--pos-color-status-success); font-weight: var(--pos-font-weight-medium); font-variant-numeric: tabular-nums; }

  .transfer-badge {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--pos-color-background-secondary); color: var(--pos-color-text-secondary);
    margin-left: 4px;
  }
  .desc-sub { font-size: 11px; color: var(--pos-color-text-tertiary); margin-top: 1px; }

  .cat-select {
    width: 100%; padding: 2px 4px; border: 1px solid transparent; border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-xs); background: transparent; color: var(--pos-color-text-primary);
    cursor: pointer; appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 4px center; padding-right: 16px;
  }
  .cat-select:hover { border-color: var(--pos-color-border-default); background-color: var(--pos-color-background-secondary); }
  .cat-select:focus { border-color: var(--pos-color-action-primary); outline: none; background-color: var(--pos-color-background-primary); }
  .cat-select.uncat { color: var(--pos-color-text-tertiary); font-style: italic; }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
  .txn-count { font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); }
`);

class PosExpenseTransactions extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._transactions = [];
    this._categories = [];
    this._accounts = [];
    this._eventsBound = false;
  }

  set transactions(val) { this._transactions = val || []; this._render(); }
  set categories(val) { this._categories = val || []; }
  set accounts(val) { this._accounts = val || []; }

  connectedCallback() {
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
    this._render();
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  _formatAmount(v) {
    return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  _getCategoryTree() {
    const cats = store.getState().categories || [];
    const parents = cats.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const childMap = {};
    for (const c of cats) {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    }
    return { parents, childMap };
  }

  _getParentForCategory(categoryId) {
    const cats = store.getState().categories || [];
    const cat = cats.find(c => c.id === categoryId);
    if (!cat) return null;
    if (cat.parent_id) return cat.parent_id;
    return cat.id; // it is a parent
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

    const { parents, childMap } = this._getCategoryTree();

    this.shadow.innerHTML = `
      <div class="header">
        <h2>${this._esc(title)}</h2>
        <span class="txn-count">${txns.length} transactions</span>
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
                <th class="col-account">Account</th>
                <th class="col-date">Date</th>
                <th class="col-desc">Description</th>
                <th class="col-category">Category</th>
                <th class="col-subcat">Subcategory</th>
                <th class="col-debit" style="text-align:right">Debit</th>
                <th class="col-credit" style="text-align:right">Credit</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map(t => {
                const parentId = this._getParentForCategory(t.category_id);
                const children = parentId ? (childMap[parentId] || []) : [];

                return `
                <tr data-txn-id="${t.id}">
                  <td class="col-account">${this._esc(t.account_name || '')}</td>
                  <td class="col-date">${this._formatDate(t.date)}</td>
                  <td class="col-desc">
                    ${this._esc(t.merchant || t.description)}
                    ${t.is_transfer ? '<span class="transfer-badge">Transfer</span>' : ''}
                    ${t.merchant && t.merchant !== t.description ? `<div class="desc-sub">${this._esc(t.description.substring(0, 80))}</div>` : ''}
                  </td>
                  <td class="col-category">
                    <select class="cat-select ${!t.category_id ? 'uncat' : ''}" data-action="change-parent" data-txn-id="${t.id}">
                      <option value="">—</option>
                      ${parents.map(p => `<option value="${p.id}" ${p.id === parentId ? 'selected' : ''}>${this._esc(p.name)}</option>`).join('')}
                    </select>
                  </td>
                  <td class="col-subcat">
                    <select class="cat-select ${!t.category_id ? 'uncat' : ''}" data-action="change-subcat" data-txn-id="${t.id}">
                      <option value="">—</option>
                      ${children.map(c => `<option value="${c.id}" ${c.id === t.category_id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
                    </select>
                  </td>
                  <td class="col-debit" style="text-align:right">
                    ${t.txn_type === 'debit' ? `<span class="amount-debit">${this._formatAmount(t.amount)}</span>` : ''}
                  </td>
                  <td class="col-credit" style="text-align:right">
                    ${t.txn_type === 'credit' ? `<span class="amount-credit">${this._formatAmount(t.amount)}</span>` : ''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="import"]');
      if (actionEl) {
        this.dispatchEvent(new CustomEvent('open-import', {
          bubbles: true, composed: true,
          detail: { accountId: store.getState().selectedAccountId },
        }));
      }
    });

    this.shadow.addEventListener('change', async (e) => {
      const el = e.target;
      const txnId = el.dataset?.txnId;
      if (!txnId) return;

      if (el.dataset.action === 'change-parent') {
        const parentId = el.value;
        if (!parentId) {
          // Clear category
          await this._updateCategory(txnId, null);
          return;
        }

        // Get children for this parent — auto-select if only one child
        const { childMap } = this._getCategoryTree();
        const children = childMap[parentId] || [];

        if (children.length === 1) {
          await this._updateCategory(txnId, children[0].id);
        } else if (children.length === 0) {
          // Parent with no children — assign parent directly
          await this._updateCategory(txnId, parentId);
        } else {
          // Re-render to show filtered subcategories
          // Find the row and update the subcat dropdown
          const row = this.shadow.querySelector(`tr[data-txn-id="${txnId}"]`);
          const subcatSelect = row?.querySelector('[data-action="change-subcat"]');
          if (subcatSelect) {
            subcatSelect.innerHTML = `<option value="">— pick —</option>` +
              children.map(c => `<option value="${c.id}">${this._esc(c.name)}</option>`).join('');
            subcatSelect.classList.add('uncat');
            subcatSelect.focus();
          }
        }
      }

      if (el.dataset.action === 'change-subcat') {
        const subcatId = el.value;
        if (subcatId) {
          await this._updateCategory(txnId, subcatId);
        }
      }
    });
  }

  async _updateCategory(txnId, categoryId) {
    try {
      await updateTransaction(txnId, { category_id: categoryId });
      this.dispatchEvent(new CustomEvent('transaction-updated', { bubbles: true, composed: true }));

      // Refresh transaction list
      const state = store.getState();
      const { getTransactions } = await import('../services/expense-api.js');
      const params = {};
      if (state.selectedAccountId) params.account_id = state.selectedAccountId;
      if (state.selectedView === 'uncategorized') params.uncategorized_only = true;
      const txns = await getTransactions(params);
      store.setState({ transactions: txns });
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-transactions', PosExpenseTransactions);
