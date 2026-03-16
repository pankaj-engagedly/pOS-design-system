// pos-vault-item-list — scrollable item list with search and create button

import store from '../store.js';

const TAG = 'pos-vault-item-list';

class PosVaultItemList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
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
    const { items, selectedItemId, loading, searchQuery } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .header {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .search {
          flex: 1; padding: 6px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 6px; font-size: 13px; font-family: inherit;
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary); outline: none;
        }
        .search:focus { border-color: var(--pos-color-action-primary); }
        .search::placeholder { color: var(--pos-color-text-disabled); }
        .create-btn {
          background: var(--pos-color-action-primary); color: white;
          border: none; border-radius: 6px;
          width: 28px; height: 28px; font-size: 18px; line-height: 1;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .list { flex: 1; overflow-y: auto; }
        .item-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; cursor: pointer;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9);
        }
        .item-row:hover { background: var(--pos-color-background-secondary); }
        .item-row.active { background: var(--pos-color-action-primary-subtle, #eff6ff); }
        .item-icon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
        .item-body { flex: 1; min-width: 0; }
        .item-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-meta { font-size: 11px; color: var(--pos-color-text-secondary); margin-top: 2px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
        .tag-badge {
          background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: 3px; padding: 0 5px; font-size: 10px;
          color: var(--pos-color-text-secondary);
        }
        .fav-icon { font-size: 11px; }
        .empty { display: flex; align-items: center; justify-content: center; height: 120px; color: var(--pos-color-text-secondary); font-size: 13px; }
      </style>

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
                ${item.is_favorite ? '<span class="fav-icon">⭐</span>' : ''}
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

    if (el.dataset.action === 'create') {
      this.dispatchEvent(new CustomEvent('item-create', { bubbles: true, composed: true }));
    }
    if (el.dataset.action === 'select') {
      store.setState({ selectedItemId: el.dataset.id });
      this.dispatchEvent(new CustomEvent('item-select', {
        detail: { itemId: el.dataset.id },
        bubbles: true, composed: true,
      }));
    }
  }

  _handleInput(e) {
    if (e.target.dataset.action === 'search') {
      const q = e.target.value;
      store.setState({ searchQuery: q });
      this.dispatchEvent(new CustomEvent('search-change', {
        detail: { query: q },
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
