// pos-kb-home — Home/lobby view for the Knowledge Base module
// Shows: recently added items + pinned collection previews

import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-page-header.js';
import './pos-kb-item-card.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .body {
    flex: 1;
    padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-lg);
  }

  .section + .section { margin-top: var(--pos-space-xl); }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--pos-space-sm);
  }

  .section-title {
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--pos-color-text-secondary);
    margin: 0;
  }

  .view-all-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-action-primary);
    cursor: pointer;
    font-family: inherit;
  }
  .view-all-btn:hover { text-decoration: underline; }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--pos-space-md);
  }

  .card-grid pos-kb-item-card {
    display: block;
    height: 100%;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: 80px var(--pos-space-xl);
    color: var(--pos-color-text-secondary);
    text-align: center;
  }
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--pos-color-text-secondary);
    opacity: 0.4;
  }
  .empty-state p { margin: 0; font-size: var(--pos-font-size-sm); }
  .add-cta {
    margin-top: var(--pos-space-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: 8px 16px;
    background: var(--pos-color-action-primary);
    color: white;
    border: none;
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
  }
  .add-cta:hover { opacity: 0.9; }

  /* Header action buttons */
  .header-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: 5px var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-primary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .header-btn:hover { background: var(--pos-color-background-secondary); }
  .header-btn svg { pointer-events: none; }
`);

class PosKBHome extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._recentItems = [];
    this._pinnedCollections = [];
    this._totalCount = 0;
  }

  set recentItems(val) { this._recentItems = val || []; this._renderBody(); }
  set pinnedCollections(val) { this._pinnedCollections = val || []; this._renderBody(); }
  set totalCount(val) { this._totalCount = val || 0; this._renderSubtitle(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    this.shadow.innerHTML = `
      <pos-page-header id="header">
        Home
        <span slot="subtitle" id="subtitle">${this._totalCount} item${this._totalCount !== 1 ? 's' : ''}</span>
        <span slot="actions">
          <button class="header-btn" data-action="add-url" title="Add URL">${icon('bookmark', 15)}</button>
          <button class="header-btn" data-action="add-media" title="Add Media">${icon('upload', 15)}</button>
          <button class="header-btn" data-action="add-text" title="Add Text">${icon('file-text', 15)}</button>
        </span>
      </pos-page-header>
      <div class="body" id="body"></div>
    `;
    this._renderBody();
  }

  _renderSubtitle() {
    const subtitle = this.shadow.getElementById('subtitle');
    if (subtitle) {
      subtitle.textContent = `${this._totalCount} item${this._totalCount !== 1 ? 's' : ''}`;
    }
  }

  _renderBody() {
    const body = this.shadow.getElementById('body');
    if (!body) return;

    const hasRecent = this._recentItems.length > 0;
    const pinnedWithItems = this._pinnedCollections.filter(c => c.items && c.items.length > 0);
    const hasContent = hasRecent || pinnedWithItems.length > 0;

    if (!hasContent) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('layers', 48)}</div>
          <p>Save your first article</p>
          <button class="add-cta" data-action="add-url">
            ${icon('bookmark', 14)} Add URL
          </button>
        </div>
      `;
      return;
    }

    const sections = [];

    if (hasRecent) {
      sections.push(`
        <div class="section">
          <div class="section-header">
            <span class="section-title">Recently Added</span>
            <button class="view-all-btn" data-view="recent">View all →</button>
          </div>
          <div class="card-grid">
            ${this._recentItems.map(item => this._renderCard(item)).join('')}
          </div>
        </div>
      `);
    }

    pinnedWithItems.forEach(col => {
      sections.push(`
        <div class="section">
          <div class="section-header">
            <span class="section-title">${this._esc(col.name)}</span>
            <button class="view-all-btn" data-collection-id="${col.id}" data-collection-name="${this._escAttr(col.name)}">View all →</button>
          </div>
          <div class="card-grid">
            ${col.items.map(item => this._renderCard(item)).join('')}
          </div>
        </div>
      `);
    });

    body.innerHTML = sections.join('');

    // Set item data on cards after render (can't pass complex objects via HTML)
    this._hydrateCards();
  }

  _renderCard(item) {
    return `<pos-kb-item-card data-item-id="${item.id}" compact></pos-kb-item-card>`;
  }

  _hydrateCards() {
    // Build a lookup of all items across recent + pinned collections
    const allItems = new Map();
    this._recentItems.forEach(i => allItems.set(i.id, i));
    this._pinnedCollections.forEach(col => {
      (col.items || []).forEach(i => allItems.set(i.id, i));
    });

    this.shadow.querySelectorAll('pos-kb-item-card').forEach(card => {
      const itemId = card.dataset.itemId;
      const item = allItems.get(itemId);
      if (item) card.item = item;
    });
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Header add buttons
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'add-url' || action === 'add-media' || action === 'add-text') {
          const modeMap = { 'add-url': 'url', 'add-media': 'media', 'add-text': 'text' };
          this.dispatchEvent(new CustomEvent('open-add-content', {
            bubbles: true, composed: true,
            detail: { mode: modeMap[action] },
          }));
          return;
        }
      }

      // View-all buttons
      const viewAllBtn = e.target.closest('.view-all-btn');
      if (viewAllBtn) {
        if (viewAllBtn.dataset.view) {
          this.dispatchEvent(new CustomEvent('view-select', {
            bubbles: true, composed: true,
            detail: { view: viewAllBtn.dataset.view },
          }));
        } else if (viewAllBtn.dataset.collectionId) {
          this.dispatchEvent(new CustomEvent('collection-select', {
            bubbles: true, composed: true,
            detail: {
              collectionId: viewAllBtn.dataset.collectionId,
              collectionName: viewAllBtn.dataset.collectionName,
            },
          }));
        }
        return;
      }
    });

    // Item card clicks — pos-kb-item-card already dispatches item-select (bubbles + composed)
    // so those will naturally bubble up to the app. No extra wiring needed here.
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

customElements.define('pos-kb-home', PosKBHome);
