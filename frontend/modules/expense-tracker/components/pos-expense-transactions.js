// pos-expense-transactions — Transaction table using shared TABLE_STYLES

import { TABLE_STYLES } from '../../../../design-system/src/components/ui-table.js';
import { icon } from '../../../shared/utils/icons.js';
import { updateTransaction } from '../services/expense-api.js';
import store from '../store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  :host([hidden]) { display: none; }

  .scroll { flex: 1; overflow-y: auto; padding: 0 var(--pos-space-lg) var(--pos-space-lg); }

  /* Match dropdown text size — compact table */
  .pos-table { font-size: var(--pos-font-size-xs); }
  .pos-table td { padding: 8px 12px; }

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

  .transfer-badge {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--pos-color-background-secondary); color: var(--pos-color-text-secondary);
    margin-left: 4px;
  }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
`);

class PosExpenseTransactions extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [TABLE_STYLES, sheet];
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
    return cat.id;
  }

  _render() {
    const txns = this._transactions;
    const state = store.getState();
    const account = state.selectedAccountId
      ? state.accounts.find(a => a.id === state.selectedAccountId)
      : null;

    const { parents, childMap } = this._getCategoryTree();

    if (txns.length === 0) {
      this.shadow.innerHTML = `
        <div class="empty">
          ${account ? 'No transactions yet. Import a statement to get started.' : 'No transactions found.'}
        </div>
      `;
      return;
    }

    this.shadow.innerHTML = `
      <div class="scroll">
        <table class="pos-table">
          <thead>
            <tr>
              <th style="width:100px">Account</th>
              <th style="width:100px">Date</th>
              <th>Description</th>
              <th style="width:130px">Category</th>
              <th style="width:130px">Subcategory</th>
              <th class="num" style="width:100px">Debit</th>
              <th class="num" style="width:100px">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${txns.map(t => {
              const parentId = this._getParentForCategory(t.category_id);
              const children = parentId ? (childMap[parentId] || []) : [];

              return `
              <tr data-txn-id="${t.id}">
                <td>${this._esc(t.account_name || '')}</td>
                <td>${this._formatDate(t.date)}</td>
                <td>
                  ${this._esc(t.merchant || t.description)}
                  ${t.is_transfer ? '<span class="transfer-badge">Transfer</span>' : ''}
                  ${t.merchant && t.merchant !== t.description ? `<span class="sub-value">${this._esc(t.description.substring(0, 80))}</span>` : ''}
                </td>
                <td>
                  <select class="cat-select ${!t.category_id ? 'uncat' : ''}" data-action="change-parent" data-txn-id="${t.id}">
                    <option value="">—</option>
                    ${parents.map(p => `<option value="${p.id}" ${p.id === parentId ? 'selected' : ''}>${this._esc(p.name)}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <select class="cat-select ${!t.category_id ? 'uncat' : ''}" data-action="change-subcat" data-txn-id="${t.id}">
                    <option value="">—</option>
                    ${children.map(c => `<option value="${c.id}" ${c.id === t.category_id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
                  </select>
                </td>
                <td class="num">
                  ${t.txn_type === 'debit' ? `<span class="negative">${this._formatAmount(t.amount)}</span>` : ''}
                </td>
                <td class="num">
                  ${t.txn_type === 'credit' ? `<span class="positive">${this._formatAmount(t.amount)}</span>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('change', async (e) => {
      const el = e.target;
      const txnId = el.dataset?.txnId;
      if (!txnId) return;

      if (el.dataset.action === 'change-parent') {
        const parentId = el.value;
        if (!parentId) {
          await this._updateCategory(txnId, null);
          return;
        }

        const { childMap } = this._getCategoryTree();
        const children = childMap[parentId] || [];

        if (children.length === 1) {
          await this._updateCategory(txnId, children[0].id);
        } else if (children.length === 0) {
          await this._updateCategory(txnId, parentId);
        } else {
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
