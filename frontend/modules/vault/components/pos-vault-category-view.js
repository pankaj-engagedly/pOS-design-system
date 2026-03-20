// pos-vault-category-view — Vertical stack of detailed item cards for a category
// Dispatches: item-create, manage-templates + all card events bubble through

import { icon } from '../../../shared/utils/icons.js';
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-meta {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
    margin-top: 2px;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    padding: 0;
  }
  .header-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
  .header-btn.primary {
    background: var(--pos-color-action-primary);
    color: #fff;
    border-color: var(--pos-color-action-primary);
  }
  .header-btn.primary:hover { opacity: 0.9; }
  .header-btn svg { pointer-events: none; }

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
    text-align: center;
  }
  .empty-icon { opacity: 0.3; color: var(--pos-color-text-secondary); }
  .empty-title { font-size: var(--pos-font-size-md); font-weight: var(--pos-font-weight-medium); }
  .empty-hint { font-size: var(--pos-font-size-sm); color: var(--pos-color-text-muted); }
`);

class PosVaultCategoryView extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._category = null;
    this._items = [];
  }

  set category(val) { this._category = val; this._renderAll(); }
  set items(val) { this._items = val || []; this._renderItems(); this._updateMeta(); }

  refreshItem(item) {
    const card = this.shadow.querySelector(`pos-vault-item-card[data-item-id="${item.id}"]`);
    if (card) card.refreshItem(item);
  }

  connectedCallback() {
    this._bindEvents();
    this._renderAll();
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'new-item') {
        this.dispatchEvent(new CustomEvent('item-create', { bubbles: true, composed: true }));
      } else if (action === 'manage-templates') {
        this.dispatchEvent(new CustomEvent('manage-templates', { bubbles: true, composed: true }));
      }
    });
  }

  _updateMeta() {
    const el = this.shadow.getElementById('item-count');
    if (el) {
      const n = this._items.length;
      el.textContent = `${n} item${n !== 1 ? 's' : ''}`;
    }
  }

  _renderAll() {
    const cat = this._category;
    const title = cat ? this._esc(cat.name) : 'Category';
    const n = this._items.length;

    this.shadow.innerHTML = `
      <div class="header">
        <div class="header-inner">
          <div class="header-left">
            <h2 class="header-title">${cat?.icon ? cat.icon + ' ' : ''}${title}</h2>
            <div class="header-meta" id="item-count">${n} item${n !== 1 ? 's' : ''}</div>
          </div>
          <div class="header-actions">
            <button class="header-btn" data-action="manage-templates" title="Manage field templates">
              ${icon('settings', 15)}
            </button>
            <button class="header-btn primary" data-action="new-item" title="New item">
              ${icon('plus', 15)}
            </button>
          </div>
        </div>
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
          <div class="empty-title">No items yet</div>
          <div class="empty-hint">Click + to add your first entry,<br>or set up field templates first.</div>
        </div>
      `;
      return;
    }

    stack.innerHTML = '';
    const catName = this._category?.name || '';
    this._items.forEach(item => {
      const card = document.createElement('pos-vault-item-card');
      card.categoryName = catName;
      card.item = item;
      card.dataset.itemId = item.id;
      stack.appendChild(card);
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-vault-category-view', PosVaultCategoryView);
