// pos-kb-list-page — Content area: header with title + actions, tag chips, search, item grid

import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-page-header.js';
import '../../../../design-system/src/components/ui-search-input.js';
import './pos-kb-item-card.js';

const KB_VIEW_MODE_KEY = 'pos-kb-view-mode';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  /* Filters — rendered inside .content, above cards */
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--pos-space-sm);
    margin-bottom: var(--pos-space-md);
  }

  .filter-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }

  .tag-chip {
    padding: 3px 10px;
    border-radius: 99px;
    border: 1px solid var(--pos-color-border-default);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-xs);
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .tag-chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
  .tag-chip.active {
    background: var(--pos-color-action-primary);
    color: white;
    border-color: var(--pos-color-action-primary);
  }

  ui-search-input { width: 160px; }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-lg);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--pos-space-md);
  }
  .card-grid pos-kb-item-card {
    display: block;
    height: 100%;
  }

  /* Header padding handled by .content — zero it out */
  pos-page-header {
    padding-left: 0;
    padding-right: 0;
  }

  .card-list {
    max-width: 720px;
    margin: 0 auto;
  }


  .empty {
    text-align: center;
    padding: var(--pos-space-xl);
    color: var(--pos-color-text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--pos-space-sm);
  }
  .empty-icon { opacity: 0.4; }
  .empty-text { font-size: var(--pos-font-size-sm); }
  .empty-add-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: 6px 16px;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
  }
  .empty-add-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }

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
  .header-btn-primary {
    background: var(--pos-color-action-primary);
    color: white;
    border-color: var(--pos-color-action-primary);
  }
  .header-btn-primary:hover { opacity: 0.9; }
  .header-btn.active {
    background: var(--pos-color-background-secondary);
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }

`);

class PosKBListPage extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._title = '';
    this._items = [];
    this._tags = [];
    this._activeTag = null;
    this._minRating = null;
    this._showRatingFilter = false;
    this._searchQuery = '';
    this._selectedItemId = null;
    this._searchTimeout = null;
    this._viewMode = sessionStorage.getItem(KB_VIEW_MODE_KEY) || 'grid';
  }

  set listTitle(val) { this._title = val; this._renderItems(); }
  set items(val) { this._items = val || []; this._renderItems(); }
  set tags(val) { this._tags = val || []; this._renderItems(); }
  set activeTag(val) { this._activeTag = val; this._renderItems(); }
  set minRating(val) { this._minRating = val; this._renderItems(); }
  set showRatingFilter(val) { this._showRatingFilter = val; this._renderItems(); }
  set selectedItemId(val) { this._selectedItemId = val; this._renderItems(); }
  set viewMode(val) { this._viewMode = val; this._renderItems(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    this.shadow.innerHTML = `
      <div class="content" id="content"></div>
    `;
    this._renderItems();
  }

  _getHeaderHtml() {
    return `
      ${this._esc(this._title)}
      <span slot="subtitle">${this._items.length} item${this._items.length !== 1 ? 's' : ''}</span>
      <span slot="actions">
        <ui-search-input size="sm" placeholder="Search\u2026" value="${this._escAttr(this._searchQuery)}"></ui-search-input>
        <button class="header-btn ${this._viewMode === 'list' ? 'active' : ''}" data-action="set-view-list" title="List view">${icon('list', 15)}</button>
        <button class="header-btn ${this._viewMode === 'grid' ? 'active' : ''}" data-action="set-view-grid" title="Grid view">${icon('grid', 15)}</button>
        <span style="width:1px;height:20px;background:var(--pos-color-border-default);margin:0 4px"></span>
        <button class="header-btn" data-action="add-url" title="Add URL">${icon('bookmark', 15)}</button>
        <button class="header-btn" data-action="add-media" title="Add Media">${icon('upload', 15)}</button>
        <button class="header-btn" data-action="add-text" title="Add Text">${icon('file-text', 15)}</button>
      </span>
    `;
  }

  _getFiltersHtml() {
    const hasTagChips = this._tags.length > 0;
    const hasRatingChips = this._showRatingFilter;
    if (!hasTagChips && !hasRatingChips) return '';

    const RATING_OPTIONS = [
      { label: 'All Ratings', value: null },
      { label: '5★', value: 5 },
      { label: '4★+', value: 4 },
      { label: '3★+', value: 3 },
    ];

    return `
      <div class="filters">
        ${hasTagChips ? `
          <div class="filter-row">
            ${this._tags.map(t => `
              <button class="tag-chip ${this._activeTag === t.name ? 'active' : ''}" data-tag="${this._escAttr(t.name)}">
                ${this._esc(t.name)}
              </button>
            `).join('')}
            ${this._activeTag ? `<button class="tag-chip" data-tag="" style="border-style:dashed">Clear</button>` : ''}
          </div>
        ` : ''}
        ${hasRatingChips ? `
          <div class="filter-row">
            ${RATING_OPTIONS.map(r => `
              <button class="tag-chip ${this._minRating === r.value ? 'active' : ''}" data-min-rating="${r.value ?? ''}">${r.label}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderItems() {
    const content = this.shadow.getElementById('content');
    if (!content) return;

    const filtersHtml = this._getFiltersHtml();

    const headerHtml = `<pos-page-header>${this._getHeaderHtml()}</pos-page-header>`;
    const isGrid = this._viewMode === 'grid';

    if (!this._items.length) {
      const emptyHtml = `
        ${filtersHtml}
        <div class="empty">
          <div class="empty-icon">${icon('layers', 40)}</div>
          <button class="empty-add-btn" data-action="add-url">${icon('plus', 13)} Add Content</button>
        </div>
      `;
      if (isGrid) {
        content.innerHTML = `${headerHtml}${emptyHtml}`;
      } else {
        content.innerHTML = `<div class="card-list">${headerHtml}${emptyHtml}</div>`;
      }
      return;
    }

    const compactAttr = isGrid ? ' compact' : '';
    const cardsHtml = this._items.map(it =>
      `<pos-kb-item-card data-id="${it.id}"${compactAttr}></pos-kb-item-card>`
    ).join('');

    if (isGrid) {
      content.innerHTML = `${headerHtml}${filtersHtml}<div class="card-grid">${cardsHtml}</div>`;
    } else {
      content.innerHTML = `<div class="card-list">${headerHtml}${filtersHtml}${cardsHtml}</div>`;
    }

    content.querySelectorAll('pos-kb-item-card').forEach(card => {
      const item = this._items.find(i => i.id === card.dataset.id);
      if (item) {
        card.item = item;
        card.selected = item.id === this._selectedItemId;
      }
    });
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;

      if (action === 'set-view-list') { this._viewMode = 'list'; sessionStorage.setItem(KB_VIEW_MODE_KEY, 'list'); this._renderItems(); return; }
      if (action === 'set-view-grid') { this._viewMode = 'grid'; sessionStorage.setItem(KB_VIEW_MODE_KEY, 'grid'); this._renderItems(); return; }

      if (action === 'add-url' || action === 'add-media' || action === 'add-text') {
        this.dispatchEvent(new CustomEvent('open-add-content', {
          bubbles: true, composed: true,
          detail: { mode: action.replace('add-', '') },
        }));
        return;
      }

      const ratingChip = e.target.closest('[data-min-rating]');
      if (ratingChip) {
        const val = ratingChip.dataset.minRating;
        const minRating = val ? parseInt(val) : null;
        this._minRating = minRating;
        this.dispatchEvent(new CustomEvent('rating-filter', {
          bubbles: true, composed: true,
          detail: { minRating },
        }));
        return;
      }

      const tagChip = e.target.closest('[data-tag]');
      if (tagChip) {
        const tag = tagChip.dataset.tag || null;
        this._activeTag = tag;
        this._renderItems();
        this.dispatchEvent(new CustomEvent('tag-filter', {
          bubbles: true, composed: true,
          detail: { tag },
        }));
      }
    });

    this.shadow.addEventListener('search-input', (e) => {
      clearTimeout(this._searchTimeout);
      this._searchQuery = e.detail.value;
      this._searchTimeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent('search-change', {
          bubbles: true, composed: true,
          detail: { query: this._searchQuery },
        }));
      }, 300);
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

customElements.define('pos-kb-list-page', PosKBListPage);
