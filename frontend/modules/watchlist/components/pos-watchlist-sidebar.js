// pos-watchlist-sidebar — Smart views + asset class navigation
// Composes: pos-sidebar (shell + scroll + footer)

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import { getStats } from '../services/watchlist-api.js';
import '../../../shared/components/pos-sidebar.js';

const sidebarSheet = new CSSStyleSheet();
sidebarSheet.replaceSync(`
  .asset-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
`);

class PosWatchlistSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, sidebarSheet];
    this._selectedView = 'all';
    this._selectedAssetClass = 'stock';
    this._assetClasses = [];
    this._stats = {};
  }

  set selectedView(val) { if (this._selectedView !== val) { this._selectedView = val; this._render(); } }
  set selectedAssetClass(val) { if (this._selectedAssetClass !== val) { this._selectedAssetClass = val; this._render(); } }
  set assetClasses(val) { this._assetClasses = val || []; this._render(); }
  set stats(val) { this._stats = val || {}; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
    this.refreshData();
  }

  async refreshData() {
    try {
      const stats = await getStats().catch(() => ({}));
      this._stats = stats;
      this._render();
    } catch (e) {
      console.error('Sidebar data load failed', e);
    }
  }

  _render() {
    const stats = this._stats;
    const total = stats.total || 0;
    const favCount = stats.favourites || 0;

    this.shadow.innerHTML = `
      <pos-sidebar title="Watchlist">

        <div class="nav-item ${this._selectedView === 'all' && !this._selectedAssetClass ? 'active' : ''}" data-view="all" data-asset="">
          ${icon('list', 15)}
          <span class="nav-label">All Items</span>
          ${total > 0 ? `<span class="nav-count">${total}</span>` : ''}
        </div>
        <div class="nav-item ${this._selectedView === 'favourites' ? 'active' : ''}" data-view="favourites" data-asset="">
          ${icon('star', 15)}
          <span class="nav-label">Favourites</span>
          ${favCount > 0 ? `<span class="nav-count">${favCount}</span>` : ''}
        </div>

        <div class="divider"></div>
        <div class="section-label">Asset Classes</div>

        ${this._assetClasses.map(ac => {
          const count = stats.by_asset_type?.[ac.slug] || 0;
          const active = this._selectedView !== 'all' && this._selectedView !== 'favourites' && this._selectedAssetClass === ac.slug;
          return `
            <div class="nav-item ${active ? 'active' : ''}" data-view="asset" data-asset="${ac.slug}">
              <span class="asset-icon">${icon(ac.icon, 15)}</span>
              <span class="nav-label">${this._esc(ac.label)}</span>
              ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
            </div>`;
        }).join('')}

      </pos-sidebar>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item) return;

      const view = item.dataset.view;
      const asset = item.dataset.asset;

      if (view === 'all' || view === 'favourites') {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view, assetClass: null },
        }));
      } else if (view === 'asset' && asset) {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view: 'asset', assetClass: asset },
        }));
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-watchlist-sidebar', PosWatchlistSidebar);
