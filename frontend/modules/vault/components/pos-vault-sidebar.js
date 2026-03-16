// pos-vault-sidebar — tag list sidebar with All Items / Favorites / tag filters

import store from '../store.js';

const TAG = 'pos-vault-sidebar';

class PosVaultSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  render() {
    const { tags, activeTag } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: block; padding: 8px 0; }
        .section-header {
          padding: 4px 12px 8px;
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--pos-color-text-secondary);
        }
        .nav-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px; cursor: pointer; border-radius: 6px;
          font-size: 13px; color: var(--pos-color-text-secondary);
          user-select: none; margin: 0 4px;
        }
        .nav-item:hover { background: var(--pos-color-background-primary); color: var(--pos-color-text-primary); }
        .nav-item.active { background: var(--pos-color-action-primary-subtle, #eff6ff); color: var(--pos-color-action-primary); font-weight: 500; }
        .nav-icon { width: 16px; text-align: center; font-size: 13px; }
        .nav-label { flex: 1; }
        .nav-count { font-size: 11px; color: var(--pos-color-text-disabled); }
        .divider { height: 1px; background: var(--pos-color-border-default); margin: 8px 12px; }
      </style>

      <div class="section-header">Vault</div>

      <div class="nav-item ${!activeTag ? 'active' : ''}" data-action="filter" data-tag="">
        <span class="nav-icon">🔐</span>
        <span class="nav-label">All Items</span>
      </div>

      <div class="nav-item" data-action="filter-favorites">
        <span class="nav-icon">⭐</span>
        <span class="nav-label">Favorites</span>
      </div>

      ${tags.length > 0 ? `
        <div class="divider"></div>
        <div class="section-header">Tags</div>
        ${tags.map(t => `
          <div class="nav-item ${activeTag === t.name ? 'active' : ''}" data-action="filter" data-tag="${this._esc(t.name)}">
            <span class="nav-icon">🏷</span>
            <span class="nav-label">${this._esc(t.name)}</span>
            <span class="nav-count">${t.count}</span>
          </div>
        `).join('')}
      ` : ''}
    `;
  }

  _handleClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    if (el.dataset.action === 'filter') {
      const tag = el.dataset.tag || null;
      store.setState({ activeTag: tag, searchQuery: '' });
      this.dispatchEvent(new CustomEvent('filter-change', {
        detail: { tag, favorites: false },
        bubbles: true, composed: true,
      }));
    }

    if (el.dataset.action === 'filter-favorites') {
      store.setState({ activeTag: null, searchQuery: '' });
      this.dispatchEvent(new CustomEvent('filter-change', {
        detail: { tag: null, favorites: true },
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

customElements.define(TAG, PosVaultSidebar);
