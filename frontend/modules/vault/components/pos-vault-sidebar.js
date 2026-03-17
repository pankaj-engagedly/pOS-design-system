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
    this.shadow.addEventListener('nav-select', (e) => this._handleNavSelect(e));
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  render() {
    const { tags, activeTag } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: block; padding: var(--pos-space-sm) 0; }

        .section-header {
          padding: var(--pos-space-xs) var(--pos-space-md) var(--pos-space-sm);
          font-size: var(--pos-raw-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--pos-color-text-secondary);
        }

        .divider {
          height: 1px;
          background: var(--pos-color-border-default);
          margin: var(--pos-space-sm) var(--pos-space-md);
        }
      </style>

      <div class="section-header">Vault</div>

      <ui-nav-item data-action="filter" data-tag="" ${!activeTag ? 'selected' : ''}>
        <span slot="icon">🔐</span>
        All Items
      </ui-nav-item>

      <ui-nav-item data-action="filter-favorites">
        <span slot="icon">⭐</span>
        Favorites
      </ui-nav-item>

      ${tags.length > 0 ? `
        <div class="divider"></div>
        <div class="section-header">Tags</div>
        ${tags.map(t => `
          <ui-nav-item
            data-action="filter"
            data-tag="${this._esc(t.name)}"
            ${activeTag === t.name ? 'selected' : ''}
            count="${t.count}">
            <span slot="icon">🏷</span>
            ${this._esc(t.name)}
          </ui-nav-item>
        `).join('')}
      ` : ''}
    `;
  }

  _handleNavSelect(e) {
    const item = e.target;
    const action = item.dataset?.action;

    if (action === 'filter') {
      const tag = item.dataset.tag || null;
      store.setState({ activeTag: tag, searchQuery: '' });
      this.dispatchEvent(new CustomEvent('filter-change', {
        detail: { tag, favorites: false },
        bubbles: true, composed: true,
      }));
    } else if (action === 'filter-favorites') {
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
