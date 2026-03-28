// pos-expense-tracker-app — 2-panel expense tracker: sidebar + content

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-expense-sidebar.js';
import '../components/pos-expense-dashboard.js';
import '../components/pos-expense-transactions.js';
import '../components/pos-expense-account-dialog.js';
import '../components/pos-expense-import-dialog.js';
import { icon } from '../../../shared/utils/icons.js';
import { TABLE_STYLES } from '../../../../design-system/src/components/ui-table.js';
import store from '../store.js';
import {
  getAccounts, getTransactions, getCategories, deleteAccount,
  getDashboardSummary, getCategoryBreakdown, getMonthlyTrend, getOwnerSplit,
} from '../services/expense-api.js';

const TAG = 'pos-expense-tracker-app';

class PosExpenseTrackerApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [TABLE_STYLES];
    this._unsub = null;
    this._renamingId = null;
  }

  connectedCallback() {
    this._render();
    this._unsub = store.subscribe(() => this._update());
    this._bindEvents();
    this._loadData();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadData() {
    store.setState({ loading: true });
    try {
      const [accounts, categories] = await Promise.all([
        getAccounts(),
        getCategories(),
      ]);
      store.setState({ accounts, categories, loading: false });

      // Restore last view from localStorage
      const savedView = localStorage.getItem('pos-expense-view');
      const savedAccountId = localStorage.getItem('pos-expense-account');
      if (savedView) {
        store.setState({ selectedView: savedView, selectedAccountId: savedAccountId || null });
        if (savedView === 'account' && savedAccountId) {
          this._loadTransactions({ account_id: savedAccountId });
        } else if (savedView === 'uncategorized') {
          this._loadTransactions({ uncategorized_only: true });
        } else if (savedView === 'all') {
          this._loadTransactions();
        } else {
          this._loadDashboard();
        }
      } else {
        this._loadDashboard();
      }
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadDashboard() {
    const { selectedMonth } = store.getState();
    try {
      const [summary, breakdown, trend, split] = await Promise.all([
        getDashboardSummary(selectedMonth),
        getCategoryBreakdown(selectedMonth),
        getMonthlyTrend(),
        getOwnerSplit(selectedMonth),
      ]);
      store.setState({
        dashboardSummary: summary,
        categoryBreakdown: breakdown,
        monthlyTrend: trend,
        ownerSplit: split,
      });
    } catch (err) {
      console.error('Dashboard load failed:', err);
    }
  }

  async _loadTransactions(params = {}) {
    try {
      const transactions = await getTransactions(params);
      store.setState({ transactions });
    } catch (err) {
      store.setState({ transactions: [] });
    }
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-expense-sidebar');
    if (sidebar) {
      sidebar.accounts = state.accounts;
      sidebar.selectedView = state.selectedView;
      sidebar.selectedAccountId = state.selectedAccountId;

      // Count uncategorized
      const uncatCount = (state.transactions || []).filter(t => !t.category_id && !t.is_transfer).length;
      sidebar.uncategorizedCount = uncatCount;
    }

    // Update page header
    this._updateHeader(state);

    // Update content components
    const dashboard = this.shadow.querySelector('pos-expense-dashboard');
    if (dashboard) {
      dashboard.summary = state.dashboardSummary;
      dashboard.categoryBreakdown = state.categoryBreakdown;
      dashboard.monthlyTrend = state.monthlyTrend;
      dashboard.ownerSplit = state.ownerSplit;
      dashboard.hidden = state.selectedView !== 'dashboard';
    }

    const txnList = this.shadow.querySelector('pos-expense-transactions');
    if (txnList) {
      txnList.transactions = state.transactions;
      txnList.categories = state.categories;
      txnList.accounts = state.accounts;
      txnList.hidden = state.selectedView === 'dashboard' || state.selectedView === 'categories' || state.selectedView === 'rules';
    }

    const catView = this.shadow.getElementById('categories-view');
    if (catView) {
      catView.hidden = state.selectedView !== 'categories';
      if (state.selectedView === 'categories' && state.categories?.length && !this._renamingId) {
        this._renderCategories(catView, state.categories);
      }
    }

    const rulesView = this.shadow.getElementById('rules-view');
    if (rulesView) {
      rulesView.hidden = state.selectedView !== 'rules';
      if (state.selectedView === 'rules') {
        this._renderRules(rulesView);
      }
    }
  }

  _renderCategories(container, categories) {
    const parents = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const childMap = {};
    for (const c of categories) {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    }

    container.innerHTML = `
      <div class="cat-scroll">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th style="width:80px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${parents.map(p => `
              <tr class="cat-group-header">
                <td>${this._renamingId === p.id
                  ? `<input class="rename-input" data-cat-id="${p.id}" value="${this._esc(p.name)}" autofocus>`
                  : this._esc(p.name)
                }</td>
                <td><span class="cat-group-type">${this._esc(p.group_type)}</span></td>
                <td style="text-align:right;">
                  <span class="row-actions">
                    <button class="row-action-btn" data-action="rename-cat" data-cat-id="${p.id}" title="Rename">${icon('edit', 13)}</button>
                  </span>
                </td>
              </tr>
              ${(childMap[p.id] || []).map(c => `
                <tr data-cat-id="${c.id}">
                  <td class="cat-name-cell">${this._renamingId === c.id
                    ? `<input class="rename-input" data-cat-id="${c.id}" value="${this._esc(c.name)}" autofocus>`
                    : this._esc(c.name)
                  }</td>
                  <td></td>
                  <td style="text-align:right;">
                    <span class="row-actions">
                      <button class="row-action-btn" data-action="rename-cat" data-cat-id="${c.id}" title="Rename">${icon('edit', 13)}</button>
                      <button class="row-action-btn delete" data-action="delete-cat" data-cat-id="${c.id}" title="Delete">${icon('trash', 13)}</button>
                    </span>
                  </td>
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Focus rename input if active
    const input = container.querySelector('.rename-input');
    if (input) { input.focus(); input.select(); }
  }

  async _renderRules(container) {
    try {
      const { getRules } = await import('../services/expense-api.js');
      const rules = await getRules();

      // Update subtitle with count
      const metaEl = this.shadow.getElementById('header-meta');
      if (metaEl) metaEl.textContent = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`;

      if (rules.length === 0) {
        container.innerHTML = '<div class="rules-empty">No rules yet. Rules are learned when you categorize transactions.</div>';
        return;
      }

      container.innerHTML = `
        <div class="rules-scroll">
          <table class="pos-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Category</th>
                <th>Source</th>
                <th style="width:80px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rules.map(r => {
                const catDisplay = r.parent_category_name
                  ? `<span class="cat-path">${this._esc(r.parent_category_name)} → </span>${this._esc(r.category_name)}`
                  : this._esc(r.category_name || '');
                return `
                <tr data-rule-id="${r.id}">
                  <td>${this._esc(r.keyword)}</td>
                  <td>${catDisplay}</td>
                  <td><span class="rule-source">${this._esc(r.source)}</span></td>
                  <td style="text-align:right;">
                    <span class="row-actions">
                      <button class="row-action-btn" data-action="edit-rule" data-rule-id="${r.id}" title="Edit">${icon('edit', 13)}</button>
                      <button class="row-action-btn delete" data-action="delete-rule" data-rule-id="${r.id}" title="Delete">${icon('trash', 13)}</button>
                    </span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = '<div class="rules-empty">Failed to load rules</div>';
    }
  }

  async _openRuleDialog(ruleId) {
    const { getRules } = await import('../services/expense-api.js');
    const categories = store.getState().categories || [];
    let existingRule = null;

    if (ruleId) {
      const rules = await getRules();
      existingRule = rules.find(r => r.id === ruleId);
      if (!existingRule) return;
    }

    // Build grouped category options
    const parents = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const childMap = {};
    for (const c of categories) {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    }

    const optionsHtml = parents.map(p => {
      const children = (childMap[p.id] || []);
      if (children.length === 0) return '';
      return `<optgroup label="${this._esc(p.name)}">
        ${children.map(c => `<option value="${c.id}" ${existingRule?.category_id === c.id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
      </optgroup>`;
    }).join('');

    // Remove any existing dialog
    this.shadow.querySelector('.rule-dialog-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rule-dialog-overlay';
    overlay.innerHTML = `
      <div class="rule-dialog">
        <h3>${existingRule ? 'Edit Rule' : 'Add Rule'}</h3>
        <label>Keyword</label>
        <input type="text" id="rule-keyword" value="${this._esc(existingRule?.keyword || '')}" placeholder="Matched against transaction description">
        <label>Category</label>
        <select id="rule-category">
          <option value="">Select a category...</option>
          ${optionsHtml}
        </select>
        <div class="rule-dialog-actions">
          <button class="btn-cancel" data-action="cancel-rule-dialog">Cancel</button>
          <button class="btn-save" data-action="save-rule" ${ruleId ? `data-rule-id="${ruleId}"` : ''}>
            ${existingRule ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    `;
    this.shadow.appendChild(overlay);

    // Focus keyword input
    const keywordInput = overlay.querySelector('#rule-keyword');
    requestAnimationFrame(() => keywordInput?.focus());
  }

  async _saveRuleFromDialog(ruleId) {
    const keywordInput = this.shadow.querySelector('#rule-keyword');
    const categorySelect = this.shadow.querySelector('#rule-category');
    const keyword = keywordInput?.value?.trim();
    const categoryId = categorySelect?.value;

    if (!keyword || !categoryId) return;

    const { createRule, updateRule } = await import('../services/expense-api.js');
    const data = { keyword, category_id: categoryId };

    if (ruleId) {
      await updateRule(ruleId, data);
    } else {
      await createRule(data);
    }

    this.shadow.querySelector('.rule-dialog-overlay')?.remove();
    this._renderRules(this.shadow.getElementById('rules-view'));
  }

  _openCategoryDialog() {
    const categories = store.getState().categories || [];
    const parents = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);

    this.shadow.querySelector('.rule-dialog-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rule-dialog-overlay';
    overlay.innerHTML = `
      <div class="rule-dialog">
        <h3>Add Category</h3>
        <label>Parent (leave empty for top-level)</label>
        <select id="cat-parent">
          <option value="">None — top-level category</option>
          ${parents.map(p => `<option value="${p.id}">${this._esc(p.name)}</option>`).join('')}
        </select>
        <label>Name</label>
        <input type="text" id="cat-name" placeholder="Category name">
        <div class="rule-dialog-actions">
          <button class="btn-cancel" data-action="cancel-cat-dialog">Cancel</button>
          <button class="btn-save" data-action="save-category">Add</button>
        </div>
      </div>
    `;
    this.shadow.appendChild(overlay);
    requestAnimationFrame(() => this.shadow.querySelector('#cat-name')?.focus());
  }

  async _saveCategoryFromDialog() {
    const parentId = this.shadow.querySelector('#cat-parent')?.value || null;
    const name = this.shadow.querySelector('#cat-name')?.value?.trim();
    if (!name) return;

    const { createCategory } = await import('../services/expense-api.js');
    await createCategory({ name, parent_id: parentId });

    this.shadow.querySelector('.rule-dialog-overlay')?.remove();
    const cats = await getCategories();
    store.setState({ categories: cats });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _updateHeader(state) {
    const titleEl = this.shadow.getElementById('header-title');
    const metaEl = this.shadow.getElementById('header-meta');
    const actionsEl = this.shadow.getElementById('header-actions');
    if (!titleEl) return;

    let title = 'Dashboard';
    let meta = '';

    if (state.selectedView === 'all') {
      title = 'All Transactions';
      meta = `${(state.transactions || []).length} transactions`;
    } else if (state.selectedView === 'uncategorized') {
      title = 'Uncategorized';
      meta = `${(state.transactions || []).length} transactions`;
    } else if (state.selectedView === 'account' && state.selectedAccountId) {
      const account = (state.accounts || []).find(a => a.id === state.selectedAccountId);
      title = account?.name || 'Account';
      meta = `${(state.transactions || []).length} transactions`;
    } else if (state.selectedView === 'dashboard') {
      title = 'Dashboard';
      const s = state.dashboardSummary;
      if (s) meta = `${(state.accounts || []).length} accounts`;
    } else if (state.selectedView === 'categories') {
      title = 'Manage Categories';
      meta = `${(state.categories || []).length} categories`;
    } else if (state.selectedView === 'rules') {
      title = 'Manage Rules';
    }

    titleEl.textContent = title;
    metaEl.textContent = meta;

    // Show context-specific action buttons
    if (state.selectedView === 'account' && state.selectedAccountId) {
      actionsEl.innerHTML = `
        <button class="header-btn" id="header-import-btn">
          ${icon('upload', 14)} Import
        </button>
      `;
    } else if (state.selectedView === 'rules') {
      actionsEl.innerHTML = `
        <button class="header-btn" data-action="add-rule">
          ${icon('plus', 14)} Add Rule
        </button>
      `;
    } else if (state.selectedView === 'categories') {
      actionsEl.innerHTML = `
        <button class="header-btn" data-action="add-category">
          ${icon('plus', 14)} Add Category
        </button>
      `;
    } else {
      actionsEl.innerHTML = '';
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('view-select', (e) => {
      const { view, accountId } = e.detail;
      store.setState({
        selectedView: view,
        selectedAccountId: accountId || null,
      });

      // Persist view state
      localStorage.setItem('pos-expense-view', view);
      if (accountId) localStorage.setItem('pos-expense-account', accountId);
      else localStorage.removeItem('pos-expense-account');

      if (view === 'dashboard') {
        this._loadDashboard();
      } else if (view === 'account') {
        this._loadTransactions({ account_id: accountId });
      } else if (view === 'uncategorized') {
        this._loadTransactions({ uncategorized_only: true });
      } else if (view === 'all') {
        this._loadTransactions();
      }
    });

    this.shadow.addEventListener('create-account', () => {
      const dialog = this.shadow.querySelector('pos-expense-account-dialog');
      if (dialog) dialog.open();
    });

    this.shadow.addEventListener('edit-account', (e) => {
      const { accountId } = e.detail;
      const account = store.getState().accounts.find(a => a.id === accountId);
      const dialog = this.shadow.querySelector('pos-expense-account-dialog');
      if (dialog && account) dialog.open(account);
    });

    this.shadow.addEventListener('delete-account', async (e) => {
      const { accountId } = e.detail;
      const account = store.getState().accounts.find(a => a.id === accountId);
      if (!account) return;

      const confirmed = confirm(`Delete account "${account.name}"? All transactions will be lost.`);
      if (!confirmed) return;

      await deleteAccount(accountId);
      this._loadData();
    });

    this.shadow.addEventListener('account-saved', () => {
      this._loadData();
    });

    this.shadow.addEventListener('import-complete', () => {
      const state = store.getState();
      if (state.selectedAccountId) {
        this._loadTransactions({ account_id: state.selectedAccountId });
      } else {
        this._loadTransactions();
      }
      this._loadDashboard();
    });

    // Click delegation for header + rule/category actions
    this.shadow.addEventListener('click', async (e) => {
      if (e.target.closest('#header-import-btn')) {
        const dialog = this.shadow.querySelector('pos-expense-import-dialog');
        if (dialog) dialog.open(store.getState().selectedAccountId);
        return;
      }

      const action = e.target.closest('[data-action]')?.dataset.action;

      // Rule actions
      if (action === 'add-rule' || action === 'edit-rule') {
        const ruleId = e.target.closest('[data-rule-id]')?.dataset.ruleId || null;
        await this._openRuleDialog(ruleId);
        return;
      }
      if (action === 'delete-rule') {
        const ruleId = e.target.closest('[data-rule-id]')?.dataset.ruleId;
        if (!ruleId) return;
        const { confirmDialog } = await import('../../../shared/components/pos-confirm-dialog.js');
        if (!await confirmDialog('Delete this rule?', { confirmLabel: 'Delete', danger: true })) return;
        const { deleteRule } = await import('../services/expense-api.js');
        await deleteRule(ruleId);
        this._renderRules(this.shadow.getElementById('rules-view'));
        return;
      }
      if (action === 'save-rule') {
        const ruleId = e.target.closest('[data-rule-id]')?.dataset.ruleId || null;
        await this._saveRuleFromDialog(ruleId);
        return;
      }
      if (action === 'cancel-rule-dialog') {
        this.shadow.querySelector('.rule-dialog-overlay')?.remove();
        return;
      }

      // Category actions
      if (action === 'add-category') {
        await this._openCategoryDialog();
        return;
      }
      if (action === 'save-category') {
        await this._saveCategoryFromDialog();
        return;
      }
      if (action === 'cancel-cat-dialog') {
        this.shadow.querySelector('.rule-dialog-overlay')?.remove();
        return;
      }
      if (action === 'rename-cat') {
        this._renamingId = e.target.closest('[data-cat-id]')?.dataset.catId;
        const catView = this.shadow.getElementById('categories-view');
        if (catView) this._renderCategories(catView, store.getState().categories);
        return;
      }
      if (action === 'delete-cat') {
        const catId = e.target.closest('[data-cat-id]')?.dataset.catId;
        if (!catId) return;
        const cat = (store.getState().categories || []).find(c => c.id === catId);
        const { confirmDialog } = await import('../../../shared/components/pos-confirm-dialog.js');
        if (!await confirmDialog(`Delete category "${cat?.name}"?`, { confirmLabel: 'Delete', danger: true })) return;
        const { deleteCategory } = await import('../services/expense-api.js');
        await deleteCategory(catId);
        const cats = await getCategories();
        store.setState({ categories: cats });
        return;
      }
    });

    // Category rename: Enter to save, Escape to cancel, focusout to cancel
    this.shadow.addEventListener('keydown', async (e) => {
      const input = e.target.closest('.rename-input[data-cat-id]');
      if (input) {
        if (e.key === 'Enter') {
          const name = input.value.trim();
          if (name) {
            const { updateCategory } = await import('../services/expense-api.js');
            await updateCategory(input.dataset.catId, { name });
            this._renamingId = null;
            const cats = await getCategories();
            store.setState({ categories: cats });
          }
          return;
        }
        if (e.key === 'Escape') {
          this._renamingId = null;
          const catView = this.shadow.getElementById('categories-view');
          if (catView) this._renderCategories(catView, store.getState().categories);
          return;
        }
      }
      // Rule dialog: Escape to close
      if (e.key === 'Escape' && this.shadow.querySelector('.rule-dialog-overlay')) {
        this.shadow.querySelector('.rule-dialog-overlay').remove();
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('.rename-input[data-cat-id]')) {
        setTimeout(() => {
          if (this._renamingId) {
            this._renamingId = null;
            const catView = this.shadow.getElementById('categories-view');
            if (catView) this._renderCategories(catView, store.getState().categories);
          }
        }, 150);
      }
    });

    this.shadow.addEventListener('open-import', (e) => {
      const dialog = this.shadow.querySelector('pos-expense-import-dialog');
      if (dialog) dialog.open(e.detail?.accountId);
    });

    this.shadow.addEventListener('transaction-updated', () => {
      this._loadDashboard();
    });
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        [hidden] { display: none !important; }
        .main { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .content > div { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
        .header-btn {
          display: inline-flex; align-items: center; gap: var(--pos-space-xs);
          padding: 5px 10px; border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); cursor: pointer; border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
        }
        .header-btn:hover { background: var(--pos-color-background-secondary); }

        /* Categories view */
        .cat-scroll { padding: 0 var(--pos-space-lg); overflow-y: auto; flex: 1; }
        .cat-scroll .pos-table { font-size: var(--pos-font-size-xs); }
        .cat-scroll .pos-table td { padding: 8px 12px; }
        .cat-group-header td {
          font-weight: var(--pos-font-weight-semibold) !important;
          color: var(--pos-color-text-secondary) !important;
          text-transform: uppercase; letter-spacing: 0.5px;
          background: var(--pos-color-background-secondary) !important;
        }
        .cat-group-type {
          font-weight: 400 !important; text-transform: none; letter-spacing: 0;
          margin-left: 4px; color: var(--pos-color-text-tertiary);
        }
        .cat-name-cell { padding-left: var(--pos-space-lg) !important; }
        .rename-input {
          padding: 4px 8px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); font-family: inherit;
          outline: none; width: 200px;
        }

        /* Rules view */
        .rules-scroll { padding: 0 var(--pos-space-lg); overflow-y: auto; flex: 1; }
        .rules-scroll .pos-table { font-size: var(--pos-font-size-xs); }
        .rules-scroll .pos-table td { padding: 8px 12px; }
        .rules-empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
        .rule-source {
          font-size: 10px; padding: 1px 6px; border-radius: 3px;
          background: var(--pos-color-background-secondary); color: var(--pos-color-text-tertiary);
        }
        .cat-path { color: var(--pos-color-text-tertiary); }

        /* Rule dialog */
        .rule-dialog-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        }
        .rule-dialog {
          background: var(--pos-color-background-primary); border-radius: var(--pos-radius-md);
          padding: var(--pos-space-lg); min-width: 380px; max-width: 440px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .rule-dialog h3 { margin: 0 0 var(--pos-space-md); font-size: var(--pos-font-size-md); }
        .rule-dialog label {
          display: block; font-size: var(--pos-font-size-xs); font-weight: 500;
          color: var(--pos-color-text-secondary); margin-bottom: 4px;
        }
        .rule-dialog input, .rule-dialog select {
          width: 100%; padding: 8px; border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
          font-family: inherit; box-sizing: border-box; margin-bottom: var(--pos-space-sm);
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
        }
        .rule-dialog input:focus, .rule-dialog select:focus {
          outline: none; border-color: var(--pos-color-action-primary);
        }
        .rule-dialog-actions {
          display: flex; justify-content: flex-end; gap: var(--pos-space-sm);
          margin-top: var(--pos-space-md);
        }
        .rule-dialog-actions button {
          padding: 6px 16px; border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm); font-family: inherit; cursor: pointer;
        }
        .rule-dialog .btn-cancel {
          background: transparent; border: 1px solid var(--pos-color-border-default);
          color: var(--pos-color-text-secondary);
        }
        .rule-dialog .btn-save {
          background: var(--pos-color-action-primary); border: none; color: white;
        }
      </style>

      <pos-module-layout>
        <pos-expense-sidebar slot="panel"></pos-expense-sidebar>
        <div class="main">
          <pos-page-header id="page-header">
            <span id="header-title">Dashboard</span>
            <span slot="subtitle" id="header-meta"></span>
            <span slot="actions" id="header-actions"></span>
          </pos-page-header>

          <div class="content">
            <pos-expense-dashboard></pos-expense-dashboard>
            <pos-expense-transactions hidden></pos-expense-transactions>
            <div id="categories-view" hidden></div>
            <div id="rules-view" hidden></div>
          </div>
        </div>
      </pos-module-layout>

      <pos-expense-account-dialog></pos-expense-account-dialog>
      <pos-expense-import-dialog></pos-expense-import-dialog>
    `;
  }
}

customElements.define('pos-expense-tracker-app', PosExpenseTrackerApp);
