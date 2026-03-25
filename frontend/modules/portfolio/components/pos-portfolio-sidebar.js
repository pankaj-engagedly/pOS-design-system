// pos-portfolio-sidebar — Smart views, portfolios grouped by holder, plans

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-sidebar.js';

const portfolioSheet = new CSSStyleSheet();
portfolioSheet.replaceSync(`
  /* Holder name sub-label (e.g. "Pankaj", "Family") */
  .section-sublabel {
    display: flex;
    align-items: center;
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-medium);
    color: var(--pos-color-text-secondary);
    padding: var(--pos-space-sm) var(--pos-space-sm) 2px 14px;
  }
  .section-sublabel .hover-action {
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
  .section-sublabel:hover .hover-action { opacity: 1; }
  .section-sublabel .hover-action:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-action-primary);
  }

  /* Section header with inline + button */
  .section-label {
    display: flex;
    align-items: center;
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
`);

class PosPortfolioSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, portfolioSheet];
    this._portfolios = [];
    this._plans = [];
    this._selectedView = 'all';
    this._selectedPortfolioId = null;
    this._selectedPlanId = null;
  }

  set portfolios(val) { this._portfolios = val || []; this._render(); }
  set plans(val) { this._plans = val || []; this._render(); }
  set selectedView(val) { if (this._selectedView !== val) { this._selectedView = val; this._render(); } }
  set selectedPortfolioId(val) { if (this._selectedPortfolioId !== val) { this._selectedPortfolioId = val; this._render(); } }
  set selectedPlanId(val) { if (this._selectedPlanId !== val) { this._selectedPlanId = val; this._render(); } }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    // Group portfolios by holder_name
    const holders = {};
    for (const p of this._portfolios) {
      const key = p.holder_name || 'Unknown';
      if (!holders[key]) holders[key] = [];
      holders[key].push(p);
    }

    const activePlans = this._plans.filter(p => p.status === 'active');

    this.shadow.innerHTML = `
      <pos-sidebar title="Portfolio">

        <div class="nav-item ${this._selectedView === 'all' && !this._selectedPortfolioId ? 'active' : ''}"
             data-view="all">
          ${icon('list', 15)}
          <span class="nav-label">All Portfolios</span>
          <span class="nav-count">${this._portfolios.length}</span>
        </div>
        <div class="nav-item ${this._selectedView === 'family' ? 'active' : ''}"
             data-view="family">
          ${icon('home', 15)}
          <span class="nav-label">Family Dashboard</span>
        </div>

        ${Object.keys(holders).length > 0 ? `
          <div class="divider"></div>
          <div class="section-label">
            Portfolios
            <span class="hover-action" data-action="create-portfolio" title="New Portfolio">${icon('plus', 13)}</span>
          </div>
        ` : ''}

        ${Object.entries(holders).map(([holderName, portfolios]) => `
          <div class="section-sublabel">
            ${this._esc(holderName)}
            <span class="hover-action" data-action="create-portfolio-for" data-holder="${this._escAttr(holderName)}" title="New portfolio for ${this._escAttr(holderName)}">
              ${icon('plus', 11)}
            </span>
          </div>
          ${portfolios.map(p => `
            <div class="nav-item ${this._selectedPortfolioId === p.id ? 'active' : ''}"
                 data-view="portfolio" data-id="${p.id}" style="padding-left: 28px;">
              ${icon('briefcase', 14)}
              <span class="nav-label">${this._esc(p.name)}</span>
              <div class="nav-actions">
                <button class="nav-action-btn" data-action="edit-portfolio" data-id="${p.id}" title="Edit">
                  ${icon('edit', 11)}
                </button>
                <button class="nav-action-btn delete" data-action="delete-portfolio" data-id="${p.id}" title="Delete">
                  ${icon('trash', 11)}
                </button>
              </div>
            </div>
          `).join('')}
        `).join('')}

        ${this._portfolios.length === 0 ? `
          <div class="divider"></div>
          <div class="section-label">Portfolios</div>
          <div class="nav-item" data-action="create-portfolio" style="color: var(--pos-color-text-tertiary);">
            ${icon('plus', 14)}
            <span class="nav-label">Create your first portfolio</span>
          </div>
        ` : ''}

        <div class="divider"></div>

        <div class="nav-item ${this._selectedView === 'plan' ? 'active' : ''}"
             data-view="plan">
          ${icon('flag', 15)}
          <span class="nav-label">Investment Plans</span>
          ${activePlans.length > 0 ? `<span class="nav-count">${activePlans.length}</span>` : ''}
        </div>

        ${activePlans.length === 0 ? `
          <div class="nav-item" data-action="create-plan" style="color: var(--pos-color-text-tertiary); padding-left: 28px;">
            ${icon('plus', 14)}
            <span class="nav-label">Create your first plan</span>
          </div>
        ` : ''}

      </pos-sidebar>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        e.stopPropagation();
        const action = actionEl.dataset.action;

        if (action === 'create-portfolio') {
          this.dispatchEvent(new CustomEvent('create-portfolio-request', {
            bubbles: true, composed: true,
          }));
          return;
        }

        if (action === 'create-portfolio-for') {
          this.dispatchEvent(new CustomEvent('create-portfolio-request', {
            bubbles: true, composed: true,
            detail: { holderName: actionEl.dataset.holder },
          }));
          return;
        }

        if (action === 'edit-portfolio') {
          this.dispatchEvent(new CustomEvent('edit-portfolio-request', {
            bubbles: true, composed: true,
            detail: { portfolioId: actionEl.dataset.id },
          }));
          return;
        }

        if (action === 'delete-portfolio') {
          this.dispatchEvent(new CustomEvent('delete-portfolio-request', {
            bubbles: true, composed: true,
            detail: { portfolioId: actionEl.dataset.id },
          }));
          return;
        }

        if (action === 'create-plan') {
          this.dispatchEvent(new CustomEvent('create-plan', {
            bubbles: true, composed: true,
          }));
          return;
        }
        return;
      }

      const item = e.target.closest('[data-view]');
      if (!item) return;
      const view = item.dataset.view;

      if (view === 'all' || view === 'family') {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view },
        }));
      } else if (view === 'portfolio') {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view: 'portfolio', portfolioId: item.dataset.id },
        }));
      } else if (view === 'plan') {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view: 'plan' },
        }));
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-portfolio-sidebar', PosPortfolioSidebar);
