// pos-expense-sidebar — Smart views + accounts grouped by owner

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-sidebar.js';

const sidebarSheet = new CSSStyleSheet();
sidebarSheet.replaceSync(`
  .owner-label {
    display: flex;
    align-items: center;
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-medium);
    color: var(--pos-color-text-secondary);
    padding: var(--pos-space-sm) var(--pos-space-sm) 2px 14px;
  }
  .owner-label .hover-action {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--pos-radius-sm);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .owner-label:hover .hover-action { opacity: 1; }
  .owner-label .hover-action:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-action-primary);
  }

  .section-label .hover-action {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--pos-radius-sm);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .section-label:hover .hover-action { opacity: 1; }
  .section-label .hover-action:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-action-primary);
  }

  .account-type {
    font-size: 10px;
    color: var(--pos-color-text-tertiary);
    background: var(--pos-color-background-primary);
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 4px;
  }
`);

const ACCOUNT_TYPE_ICONS = {
  savings: 'landmark',
  current: 'landmark',
  credit_card: 'credit-card',
  wallet: 'wallet',
  cash: 'banknote',
};

class PosExpenseSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, sidebarSheet];
    this._accounts = [];
    this._selectedView = 'dashboard';
    this._selectedAccountId = null;
    this._uncategorizedCount = 0;
  }

  set accounts(val) { this._accounts = val || []; this._render(); }
  set selectedView(val) { if (this._selectedView !== val) { this._selectedView = val; this._render(); } }
  set selectedAccountId(val) { if (this._selectedAccountId !== val) { this._selectedAccountId = val; this._render(); } }
  set uncategorizedCount(val) { this._uncategorizedCount = val || 0; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    // Group accounts by owner_label
    const owners = {};
    for (const a of this._accounts) {
      const key = a.owner_label || 'Personal';
      if (!owners[key]) owners[key] = [];
      owners[key].push(a);
    }

    this.shadow.innerHTML = `
      <pos-sidebar title="Expenses">

        <div class="nav-item ${this._selectedView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
          ${icon('bar-chart-2', 15)}
          <span class="nav-label">Dashboard</span>
        </div>
        <div class="nav-item ${this._selectedView === 'all' && !this._selectedAccountId ? 'active' : ''}" data-view="all">
          ${icon('list', 15)}
          <span class="nav-label">All Transactions</span>
        </div>
        <div class="nav-item ${this._selectedView === 'uncategorized' ? 'active' : ''}" data-view="uncategorized">
          ${icon('help-circle', 15)}
          <span class="nav-label">Uncategorized</span>
          ${this._uncategorizedCount > 0 ? `<span class="nav-count">${this._uncategorizedCount}</span>` : ''}
        </div>

        ${Object.keys(owners).length > 0 ? `
          <div class="divider"></div>
          <div class="section-label">
            Accounts
            <span class="hover-action" data-action="create-account" title="New Account">${icon('plus', 13)}</span>
          </div>
        ` : `
          <div class="divider"></div>
          <div class="section-label">Accounts</div>
          <div class="nav-item" data-action="create-account" style="color: var(--pos-color-text-tertiary);">
            ${icon('plus', 14)}
            <span class="nav-label">Add your first account</span>
          </div>
        `}

        ${Object.entries(owners).map(([ownerName, accounts]) => `
          <div class="owner-label">
            ${this._esc(ownerName)}
          </div>
          ${accounts.map(a => `
            <div class="nav-item ${this._selectedAccountId === a.id ? 'active' : ''}"
                 data-view="account" data-id="${a.id}" style="padding-left: 28px;">
              ${icon(ACCOUNT_TYPE_ICONS[a.type] || 'landmark', 14)}
              <span class="nav-label">${this._esc(a.name)}</span>
              <div class="nav-actions">
                <button class="nav-action-btn" data-action="edit-account" data-id="${a.id}" title="Edit">
                  ${icon('edit', 11)}
                </button>
                <button class="nav-action-btn delete" data-action="delete-account" data-id="${a.id}" title="Delete">
                  ${icon('trash', 11)}
                </button>
              </div>
            </div>
          `).join('')}
        `).join('')}

        <div class="divider"></div>
        <div class="nav-item ${this._selectedView === 'categories' ? 'active' : ''}" data-view="categories">
          ${icon('tag', 15)}
          <span class="nav-label">Manage Categories</span>
        </div>
        <div class="nav-item ${this._selectedView === 'rules' ? 'active' : ''}" data-view="rules">
          ${icon('zap', 15)}
          <span class="nav-label">Manage Rules</span>
        </div>

      </pos-sidebar>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        e.stopPropagation();
        const action = actionEl.dataset.action;
        this.dispatchEvent(new CustomEvent(action, {
          bubbles: true, composed: true,
          detail: actionEl.dataset.id ? { accountId: actionEl.dataset.id } : {},
        }));
        return;
      }

      const item = e.target.closest('[data-view]');
      if (!item) return;
      const view = item.dataset.view;
      const id = item.dataset.id || null;

      this.dispatchEvent(new CustomEvent('view-select', {
        bubbles: true, composed: true,
        detail: { view, accountId: id },
      }));
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-sidebar', PosExpenseSidebar);
