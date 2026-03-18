// pos-vault-item-list — scrollable item list with filter pills, search, and create button

import store from '../store.js';
import '../../../shared/components/pos-page-header.js';

const TAG = 'pos-vault-item-list';

class PosVaultItemList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
    this._activeTag = null;
    this._favorites = false;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('input', (e) => this._handleInput(e));
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  render() {
    const { items, tags, selectedItemId, loading, searchQuery } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

        .filters {
          display: flex; align-items: center; gap: var(--pos-space-xs);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          overflow-x: auto; scrollbar-width: none; flex-shrink: 0;
        }
        .filters::-webkit-scrollbar { display: none; }

        .filter-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 99px;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer; white-space: nowrap;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .filter-pill:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }
        .filter-pill.active {
          background: var(--pos-color-action-primary);
          border-color: var(--pos-color-action-primary);
          color: #fff;
        }

        .header {
          display: flex; align-items: center; gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }
        .search {
          flex: 1; padding: 5px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm); font-family: inherit;
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary); outline: none;
        }
        .search:focus { border-color: var(--pos-color-action-primary); }
        .search::placeholder { color: var(--pos-color-text-disabled); }
        .create-btn {
          background: var(--pos-color-action-primary); color: #fff;
          border: none; border-radius: var(--pos-radius-sm);
          width: 28px; height: 28px; font-size: 18px; line-height: 1;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .create-btn:hover { opacity: 0.85; }

        .list { flex: 1; overflow-y: auto; }
        .item-row {
          display: flex; align-items: center; gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md); cursor: pointer;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .item-row:hover { background: var(--pos-color-background-secondary); }
        .item-row.active { background: color-mix(in srgb, var(--pos-color-action-primary) 10%, transparent); }
        .item-icon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
        .item-body { flex: 1; min-width: 0; }
        .item-name { font-size: var(--pos-font-size-sm); font-weight: var(--pos-font-weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-meta { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); margin-top: 2px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
        .tag-badge {
          background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: 3px; padding: 0 5px; font-size: 10px;
          color: var(--pos-color-text-secondary);
        }
        .empty { display: flex; align-items: center; justify-content: center; height: 120px; color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-sm); }
      </style>

      <pos-page-header>
        ${this._favorites ? 'Favourites' : this._activeTag ? this._esc(this._activeTag) : 'Vault'}
        <span slot="subtitle">${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </pos-page-header>

      <div class="filters">
        <button class="filter-pill ${!this._activeTag && !this._favorites ? 'active' : ''}" data-action="filter-all">All</button>
        <button class="filter-pill ${this._favorites ? 'active' : ''}" data-action="filter-favorites">⭐ Favorites</button>
        ${(tags || []).map(t => `
          <button class="filter-pill ${this._activeTag === t.name ? 'active' : ''}" data-action="filter-tag" data-tag="${this._esc(t.name)}">${this._esc(t.name)}</button>
        `).join('')}
      </div>

      <div class="header">
        <input class="search" type="text" placeholder="Search vault…" value="${this._esc(searchQuery)}" data-action="search" />
        <button class="create-btn" data-action="create" title="New vault item">+</button>
      </div>

      <div class="list">
        ${loading ? '<div class="empty">Loading…</div>' : ''}
        ${!loading && items.length === 0 ? '<div class="empty">No items yet — click + to add</div>' : ''}
        ${!loading ? items.map(item => `
          <div class="item-row ${item.id === selectedItemId ? 'active' : ''}" data-action="select" data-id="${item.id}">
            <div class="item-icon">${this._esc(item.icon || '🔐')}</div>
            <div class="item-body">
              <div class="item-name">${this._esc(item.name)}</div>
              <div class="item-meta">
                ${item.is_favorite ? '<span>⭐</span>' : ''}
                <span>${item.field_count} field${item.field_count !== 1 ? 's' : ''}</span>
                ${item.tags.map(t => `<span class="tag-badge">${this._esc(t.name)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('') : ''}
      </div>
    `;
  }

  _handleClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
      case 'create':
        this.dispatchEvent(new CustomEvent('item-create', { bubbles: true, composed: true }));
        break;

      case 'select':
        store.setState({ selectedItemId: el.dataset.id });
        this.dispatchEvent(new CustomEvent('item-select', {
          detail: { itemId: el.dataset.id },
          bubbles: true, composed: true,
        }));
        break;

      case 'filter-all':
        this._activeTag = null;
        this._favorites = false;
        this.dispatchEvent(new CustomEvent('filter-change', {
          detail: { tag: null, favorites: false },
          bubbles: true, composed: true,
        }));
        break;

      case 'filter-favorites':
        this._activeTag = null;
        this._favorites = true;
        this.dispatchEvent(new CustomEvent('filter-change', {
          detail: { tag: null, favorites: true },
          bubbles: true, composed: true,
        }));
        break;

      case 'filter-tag':
        this._activeTag = el.dataset.tag;
        this._favorites = false;
        this.dispatchEvent(new CustomEvent('filter-change', {
          detail: { tag: el.dataset.tag, favorites: false },
          bubbles: true, composed: true,
        }));
        break;
    }
  }

  _handleInput(e) {
    if (e.target.dataset.action === 'search') {
      store.setState({ searchQuery: e.target.value });
      this.dispatchEvent(new CustomEvent('search-change', {
        detail: { query: e.target.value },
        bubbles: true, composed: true,
      }));
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosVaultItemList);
