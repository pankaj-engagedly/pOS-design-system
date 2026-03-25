// pos-portfolio-app — 2-panel portfolio: sidebar + content (holdings/transactions/plans/family)

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-portfolio-sidebar.js';
import '../components/pos-portfolio-holdings.js';
import '../components/pos-portfolio-transactions.js';
import '../components/pos-portfolio-create-dialog.js';
import '../components/pos-portfolio-import-dialog.js';
import '../components/pos-portfolio-plan-detail.js';
import '../components/pos-portfolio-plan-create-dialog.js';
import '../components/pos-portfolio-allocation-dialog.js';
import '../components/pos-portfolio-deployment-dialog.js';
import '../components/pos-portfolio-plan-history.js';
import '../components/pos-portfolio-family-dashboard.js';
import { icon } from '../../../shared/utils/icons.js';
import { formatINR } from '../components/pos-portfolio-holdings.js';
import store from '../store.js';
import {
  getPortfolios, getHoldings, getTransactions, getPlans,
  getFamilyAggregation, deletePortfolio, refreshNAV,
} from '../services/portfolio-api.js';

const TAG = 'pos-portfolio-app';

class PosPortfolioApp extends HTMLElement {
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
      const [portfolios, plans] = await Promise.all([
        getPortfolios(),
        getPlans(),
      ]);
      store.setState({ portfolios, plans, loading: false });
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadHoldings(portfolioId) {
    store.setState({ loading: true });
    try {
      let holdings = await getHoldings(portfolioId);

      // If all current values are zero/null, auto-fetch NAV first
      const hasNav = (holdings.holdings || []).some(h => h.current_nav && Number(h.current_nav) > 0);
      if (!hasNav && (holdings.holdings || []).length > 0) {
        await refreshNAV();
        holdings = await getHoldings(portfolioId);
      }

      store.setState({ holdings, loading: false });
    } catch (err) {
      store.setState({ holdings: null, loading: false, error: err.message });
    }
  }

  async _loadTransactions(portfolioId) {
    try {
      const transactions = await getTransactions(portfolioId);
      store.setState({ transactions });
    } catch (err) {
      store.setState({ transactions: [] });
    }
  }

  async _loadFamily() {
    store.setState({ loading: true });
    try {
      const familyAggregation = await getFamilyAggregation();
      store.setState({ familyAggregation, loading: false });
    } catch (err) {
      store.setState({ familyAggregation: null, loading: false });
    }
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-portfolio-sidebar');
    if (sidebar) {
      sidebar.portfolios = state.portfolios;
      sidebar.plans = state.plans;
      sidebar.selectedView = state.selectedView;
      sidebar.selectedPortfolioId = state.selectedPortfolioId;
      sidebar.selectedPlanId = state.selectedPlanId;
    }

    this._renderContent();
  }

  _renderContent() {
    const state = store.getState();
    const content = this.shadow.querySelector('.content');
    if (!content) return;

    if (state.selectedView === 'family') {
      content.innerHTML = '<pos-portfolio-family-dashboard></pos-portfolio-family-dashboard>';
      const dash = content.querySelector('pos-portfolio-family-dashboard');
      if (dash) dash.data = state.familyAggregation;
      return;
    }

    if (state.selectedView === 'plan') {
      content.innerHTML = '<pos-portfolio-plan-detail></pos-portfolio-plan-detail>';
      const detail = content.querySelector('pos-portfolio-plan-detail');
      if (detail) detail.plan = { _trigger: true }; // triggers load of all plans
      return;
    }

    if (!state.selectedPortfolioId) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('briefcase', 48)}</div>
          <p>Select a portfolio from the sidebar or create a new one</p>
          <button class="action-btn" data-action="create-portfolio">
            ${icon('plus', 14)} New Portfolio
          </button>
        </div>`;
      return;
    }

    // Portfolio selected — show holdings or transactions
    const portfolio = (state.portfolios || []).find(p => p.id === state.selectedPortfolioId);
    const headerTitle = portfolio ? portfolio.name : 'Portfolio';

    if (state.contentView === 'transactions') {
      content.innerHTML = `
        <div class="content-header">
          <h2>${this._esc(headerTitle)}</h2>
          <div class="content-tabs">
            <button class="tab-btn" data-tab="holdings">Holdings</button>
            <button class="tab-btn active" data-tab="transactions">Transactions</button>
          </div>
          <button class="header-btn" data-action="import">${icon('upload', 14)} Import CAS</button>
        </div>
        <pos-portfolio-transactions></pos-portfolio-transactions>`;
      const txnEl = content.querySelector('pos-portfolio-transactions');
      if (txnEl) txnEl.transactions = state.transactions;
    } else {
      content.innerHTML = `
        <div class="content-header">
          <h2>${this._esc(headerTitle)}</h2>
          <div class="content-tabs">
            <button class="tab-btn active" data-tab="holdings">Holdings</button>
            <button class="tab-btn" data-tab="transactions">Transactions</button>
          </div>
          <div class="header-actions">
            <button class="header-btn" data-action="import">${icon('upload', 14)} Import CAS</button>
            <button class="header-btn" data-action="refresh-nav">${icon('refresh-cw', 14)} Refresh NAV</button>
          </div>
        </div>
        <pos-portfolio-holdings></pos-portfolio-holdings>`;
      const holdEl = content.querySelector('pos-portfolio-holdings');
      if (holdEl) holdEl.data = state.holdings;
    }
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .main {
          position: relative;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .content {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 20px 24px;
        }
        .content-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        .content-header h2 {
          margin: 0;
          font-size: var(--pos-font-size-lg, 18px);
          font-weight: 600;
          color: var(--pos-color-text-primary, #1a1a2e);
        }
        .content-tabs {
          display: flex;
          gap: 4px;
          margin-left: 16px;
        }
        .tab-btn {
          padding: 4px 12px;
          border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: var(--pos-radius-sm, 6px);
          background: transparent;
          color: var(--pos-color-text-secondary, #6b6b80);
          font-size: var(--pos-font-size-xs, 12px);
          font-family: inherit;
          cursor: pointer;
        }
        .tab-btn.active {
          background: var(--pos-color-action-primary, #4361ee);
          color: white;
          border-color: var(--pos-color-action-primary, #4361ee);
        }
        .header-actions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        .header-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: var(--pos-radius-sm, 6px);
          background: transparent;
          color: var(--pos-color-text-secondary, #6b6b80);
          font-size: var(--pos-font-size-xs, 12px);
          font-family: inherit;
          cursor: pointer;
        }
        .header-btn:hover {
          border-color: var(--pos-color-action-primary, #4361ee);
          color: var(--pos-color-action-primary, #4361ee);
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--pos-color-action-primary, #4361ee);
          color: white;
          border: none;
          border-radius: var(--pos-radius-sm, 6px);
          font-family: inherit;
          font-size: var(--pos-font-size-sm, 13px);
          cursor: pointer;
        }
        .action-btn:hover { opacity: 0.9; }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60%;
          color: var(--pos-color-text-tertiary, #9b9bb0);
          gap: 12px;
        }
        .empty-icon { opacity: 0.3; }
        .empty-state p {
          margin: 0;
          font-size: var(--pos-font-size-sm, 13px);
        }
        pos-portfolio-create-dialog,
        pos-portfolio-import-dialog,
        pos-portfolio-plan-create-dialog,
        pos-portfolio-allocation-dialog,
        pos-portfolio-deployment-dialog {
          position: relative;
          z-index: 10000;
        }
      </style>
      <pos-module-layout>
        <pos-portfolio-sidebar slot="panel"></pos-portfolio-sidebar>
        <div class="main">
          <div class="content"></div>
          <pos-portfolio-create-dialog></pos-portfolio-create-dialog>
          <pos-portfolio-import-dialog></pos-portfolio-import-dialog>
          <pos-portfolio-plan-create-dialog></pos-portfolio-plan-create-dialog>
          <pos-portfolio-allocation-dialog></pos-portfolio-allocation-dialog>
          <pos-portfolio-deployment-dialog></pos-portfolio-deployment-dialog>
        </div>
      </pos-module-layout>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const tab = e.target.closest('[data-tab]')?.dataset.tab;

      if (tab) {
        store.setState({ contentView: tab });
        const state = store.getState();
        if (tab === 'transactions' && state.selectedPortfolioId) {
          this._loadTransactions(state.selectedPortfolioId);
        }
      }

      if (action === 'create-portfolio') {
        const dialog = this.shadow.querySelector('pos-portfolio-create-dialog');
        if (dialog) dialog.open = true;
      }
      if (action === 'import') {
        const dialog = this.shadow.querySelector('pos-portfolio-import-dialog');
        if (dialog) {
          dialog.portfolios = store.getState().portfolios;
          dialog.selectedPortfolioId = store.getState().selectedPortfolioId;
          dialog.open = true;
        }
      }
      if (action === 'refresh-nav') {
        refreshNAV().then(() => {
          const state = store.getState();
          if (state.selectedPortfolioId) this._loadHoldings(state.selectedPortfolioId);
        });
      }
    });

    // Sidebar events
    this.shadow.addEventListener('view-select', (e) => {
      const { view, portfolioId, planId } = e.detail;
      store.setState({
        selectedView: view,
        selectedPortfolioId: portfolioId || null,
        selectedPlanId: planId || null,
        contentView: 'holdings',
        holdings: null,
        transactions: [],
      });

      if (portfolioId) {
        this._loadHoldings(portfolioId);
      }
      if (view === 'family') {
        this._loadFamily();
      }
    });

    // Dialog result events
    this.shadow.addEventListener('portfolio-created', () => this._loadData());
    this.shadow.addEventListener('import-complete', () => {
      const state = store.getState();
      if (state.selectedPortfolioId) this._loadHoldings(state.selectedPortfolioId);
    });
    this.shadow.addEventListener('plan-created', () => this._loadData());
    this.shadow.addEventListener('allocation-created', () => this._loadData());
    this.shadow.addEventListener('deployment-created', () => this._loadData());

    // Sidebar: create portfolio (optionally pre-fill holder name)
    this.shadow.addEventListener('create-portfolio-request', (e) => {
      const dialog = this.shadow.querySelector('pos-portfolio-create-dialog');
      if (dialog) {
        dialog.holderName = e.detail?.holderName || '';
        dialog.open = true;
      }
    });

    // Sidebar: edit portfolio
    this.shadow.addEventListener('edit-portfolio-request', (e) => {
      const portfolio = store.getState().portfolios.find(p => p.id === e.detail.portfolioId);
      if (portfolio) {
        const dialog = this.shadow.querySelector('pos-portfolio-create-dialog');
        if (dialog) {
          dialog.editPortfolio = portfolio;
          dialog.open = true;
        }
      }
    });

    // Sidebar: delete portfolio
    this.shadow.addEventListener('delete-portfolio-request', async (e) => {
      const { confirmDialog } = await import('../../../shared/components/pos-confirm-dialog.js');
      if (!await confirmDialog('Delete this portfolio and all its data?', { confirmLabel: 'Delete', danger: true })) return;
      const { deletePortfolio } = await import('../services/portfolio-api.js');
      try {
        await deletePortfolio(e.detail.portfolioId);
        if (store.getState().selectedPortfolioId === e.detail.portfolioId) {
          store.setState({ selectedView: 'all', selectedPortfolioId: null });
        }
        this._loadData();
      } catch (err) {
        console.error('Delete portfolio failed', err);
      }
    });

    // Plan actions
    this.shadow.addEventListener('create-plan', () => {
      const dialog = this.shadow.querySelector('pos-portfolio-plan-create-dialog');
      if (dialog) dialog.open = true;
    });
    this.shadow.addEventListener('add-allocation', (e) => {
      const dialog = this.shadow.querySelector('pos-portfolio-allocation-dialog');
      if (dialog) {
        dialog.planId = e.detail.planId;
        dialog.open = true;
      }
    });
    this.shadow.addEventListener('record-deployment', (e) => {
      const dialog = this.shadow.querySelector('pos-portfolio-deployment-dialog');
      if (dialog) {
        dialog.allocationId = e.detail.allocationId;
        dialog.open = true;
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosPortfolioApp);
