// pos-expense-tracker-app — 2-panel expense tracker: sidebar + content

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-expense-sidebar.js';
import '../components/pos-expense-dashboard.js';
import '../components/pos-expense-transactions.js';
import '../components/pos-expense-account-dialog.js';
import '../components/pos-expense-import-dialog.js';
import { icon } from '../../../shared/utils/icons.js';
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
    this._unsub = null;
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
      // Load dashboard by default
      this._loadDashboard();
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
    }

    titleEl.textContent = title;
    metaEl.textContent = meta;

    // Show import button when viewing an account
    if (state.selectedView === 'account' && state.selectedAccountId) {
      actionsEl.innerHTML = `
        <button class="header-btn" id="header-import-btn">
          ${icon('upload', 14)} Import
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

    // Header import button
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#header-import-btn')) {
        const dialog = this.shadow.querySelector('pos-expense-import-dialog');
        if (dialog) dialog.open(store.getState().selectedAccountId);
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
        .header-btn {
          display: inline-flex; align-items: center; gap: var(--pos-space-xs);
          padding: 5px 10px; border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); cursor: pointer; border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
        }
        .header-btn:hover { background: var(--pos-color-background-secondary); }
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
          </div>
        </div>
      </pos-module-layout>

      <pos-expense-account-dialog></pos-expense-account-dialog>
      <pos-expense-import-dialog></pos-expense-import-dialog>
    `;
  }
}

customElements.define('pos-expense-tracker-app', PosExpenseTrackerApp);
