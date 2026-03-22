// pos-vault-all-items-view — Vertical stack of detailed cards across all categories
// Dispatches: search-change + all card events bubble through

import { icon } from '../../../shared/utils/icons.js';
import '../../../../design-system/src/components/ui-search-input.js';
import './pos-vault-item-card.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    padding: var(--pos-space-md) var(--pos-space-lg) 0;
    flex-shrink: 0;
  }
  .header-inner {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    max-width: 680px;
    margin: 0 auto;
  }
  .header-left { flex: 1; min-width: 0; }
  .header-title {
    font-size: var(--pos-font-size-lg);
    font-weight: var(--pos-font-weight-bold);
    color: var(--pos-color-text-primary);
    margin: 0;
  }
  .header-meta {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
    margin-top: 2px;
  }

  .toolbar {
    padding: var(--pos-space-sm) var(--pos-space-lg);
    flex-shrink: 0;
  }
  .toolbar ui-search-input {
    display: block;
    max-width: 680px;
    margin: 0 auto;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--pos-space-md) var(--pos-space-lg);
  }

  .items-stack {
    display: flex;
    flex-direction: column;
    gap: var(--pos-space-md);
    max-width: 680px;
    margin: 0 auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 240px;
    color: var(--pos-color-text-secondary);
  }
  .empty-icon { opacity: 0.3; }
`);

class PosVaultAllItemsView extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._items = [];
    this._categories = [];
    this._title = 'All Items';
    this._searchTimer = null;
  }

  set items(val) { this._items = val || []; this._renderItems(); this._updateMeta(); }
  set categories(val) { this._categories = val || []; }
  set title(val) { this._title = val || 'All Items'; this._updateTitle(); }

  refreshItem(item) {
    const card = this.shadow.querySelector(`pos-vault-item-card[data-item-id="${item.id}"]`);
    if (card) card.refreshItem(item);
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _bindEvents() {
    this.shadow.addEventListener('search-input', (e) => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.dispatchEvent(new CustomEvent('search-change', {
          bubbles: true, composed: true, detail: { query: e.detail.value },
        }));
      }, 300);
    });
  }

  _updateTitle() {
    const el = this.shadow.querySelector('.header-title');
    if (el) el.textContent = this._title;
  }

  _updateMeta() {
    const el = this.shadow.getElementById('item-count');
    if (el) {
      const n = this._items.length;
      el.textContent = `${n} item${n !== 1 ? 's' : ''}`;
    }
  }

  _render() {
    const n = this._items.length;
    this.shadow.innerHTML = `
      <div class="header">
        <div class="header-inner">
          <div class="header-left">
            <h2 class="header-title">${this._title}</h2>
            <div class="header-meta" id="item-count">${n} item${n !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
      <div class="toolbar">
        <ui-search-input placeholder="Search items\u2026"></ui-search-input>
      </div>
      <div class="content">
        <div class="items-stack" id="items-stack"></div>
      </div>
    `;
    this._renderItems();
  }

  _renderItems() {
    const stack = this.shadow.getElementById('items-stack');
    if (!stack) return;

    if (this._items.length === 0) {
      stack.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('lock', 40)}</div>
          <span>No items found</span>
        </div>
      `;
      return;
    }

    stack.innerHTML = '';
    this._items.forEach(item => {
      const card = document.createElement('pos-vault-item-card');
      const cat = this._categories.find(c => c.id === item.category_id);
      card.categoryName = cat?.name || '';
      card.item = item;
      card.dataset.itemId = item.id;
      stack.appendChild(card);
    });
  }
}

customElements.define('pos-vault-all-items-view', PosVaultAllItemsView);
