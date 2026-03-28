// pos-kb-feed-timeline — Social feed timeline with filter chips and quick actions

import '../../../shared/components/pos-page-header.js';
import './pos-kb-feed-item-card.js';
import { icon } from '../../../shared/utils/icons.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-sm) 0 var(--pos-space-sm);
    flex-wrap: wrap;
  }

  .chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
  }

  .chip {
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
  .chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
  .chip.active {
    background: var(--pos-color-action-primary);
    color: white;
    border-color: var(--pos-color-action-primary);
  }

  .toggle-btn {
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
  .toggle-btn.active {
    background: var(--pos-color-background-secondary);
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }

  .action-btns {
    display: flex;
    gap: var(--pos-space-xs);
  }

  .header-btn {
    display: flex;
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

  .feed-column {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 var(--pos-space-lg);
  }

  .date-header {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--pos-color-background-secondary);
    border-bottom: 1px solid var(--pos-color-border-default);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--pos-space-xl);
    color: var(--pos-color-text-secondary);
    gap: var(--pos-space-sm);
  }
  .empty svg { opacity: 0.3; }
  .empty p { margin: 0; font-size: var(--pos-font-size-sm); }

  .load-more {
    display: flex;
    justify-content: center;
    padding: var(--pos-space-lg) 0;
  }
  .load-more-btn {
    padding: var(--pos-space-sm) var(--pos-space-lg);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
  }
  .load-more-btn:hover {
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
  }
`);

class PosKBFeedTimeline extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._items = [];
    this._sources = [];
    this._selectedSourceId = null;
    this._unreadOnly = false;
    this._hasMore = false;
  }

  set items(val) { this._items = val || []; this._renderItems(); }
  set sources(val) { this._sources = val || []; this._render(); }
  set selectedSourceId(val) { this._selectedSourceId = val; this._render(); }
  set unreadOnly(val) { this._unreadOnly = val; this._render(); }
  set hasMore(val) { this._hasMore = !!val; this._renderItems(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const count = this._items.length;
    this.shadow.innerHTML = `
      <div class="feed-column">
        <pos-page-header style="padding-left:0;padding-right:0">
          My Feeds
          <span slot="subtitle">${count} item${count !== 1 ? 's' : ''}</span>
          <span slot="actions">
            <button class="header-btn" id="mark-all-btn">
              ${icon('check', 13)} Mark all read
            </button>
            <button class="header-btn header-btn-primary" id="subscribe-btn">
              ${icon('plus', 13)} Subscribe
            </button>
          </span>
        </pos-page-header>

        <div class="toolbar">
          <div class="chips">
            <button class="chip ${!this._selectedSourceId ? 'active' : ''}" data-source-id="">All</button>
            ${this._sources.map(s => `
              <button class="chip ${this._selectedSourceId === s.id ? 'active' : ''}"
                      data-source-id="${s.id}">
                ${this._esc(s.title)}
                ${s.unread_count > 0 ? ` (${s.unread_count})` : ''}
              </button>
            `).join('')}
          </div>
          <button class="toggle-btn ${this._unreadOnly ? 'active' : ''}" id="unread-toggle">
            Unread only
          </button>
        </div>

        <div id="items-container"></div>
      </div>
    `;

    this._renderItems();
  }

  _renderItems() {
    const container = this.shadow.getElementById('items-container');
    if (!container) return;

    if (this._items.length === 0) {
      container.innerHTML = `
        <div class="empty">
          ${icon('rss', 40)}
          <p>${this._sources.length === 0 ? 'Subscribe to feeds to see items here' : 'No items to show'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const groups = this._groupByDate(this._items);
    for (const group of groups) {
      const header = document.createElement('div');
      header.className = 'date-header';
      header.textContent = group.label;
      container.appendChild(header);
      for (const item of group.items) {
        const card = document.createElement('pos-kb-feed-item-card');
        card.item = item;
        container.appendChild(card);
      }
    }

    // Load more button
    if (this._hasMore) {
      const loadMore = document.createElement('div');
      loadMore.className = 'load-more';
      loadMore.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load older episodes</button>';
      container.appendChild(loadMore);
    }
  }

  _groupByDate(items) {
    const groups = [];
    let currentLabel = null;
    for (const item of items) {
      const label = this._getDateLabel(item.published_at || item.created_at);
      if (label !== currentLabel) {
        groups.push({ label, items: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }

  _getDateLabel(dateStr) {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDate.getTime() === today.getTime()) return 'Today';
    if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Subscribe button
      if (e.target.closest('#subscribe-btn')) {
        this.dispatchEvent(new CustomEvent('open-subscribe', { bubbles: true, composed: true }));
        return;
      }

      // Mark all read
      if (e.target.closest('#mark-all-btn')) {
        this.dispatchEvent(new CustomEvent('mark-all-read', {
          bubbles: true, composed: true,
          detail: { sourceId: this._selectedSourceId },
        }));
        return;
      }

      // Unread toggle
      if (e.target.closest('#unread-toggle')) {
        this.dispatchEvent(new CustomEvent('toggle-unread-filter', { bubbles: true, composed: true }));
        return;
      }

      // Load more
      if (e.target.closest('#load-more-btn')) {
        this.dispatchEvent(new CustomEvent('load-more-feeds', { bubbles: true, composed: true }));
        return;
      }

      // Source filter chip
      const chip = e.target.closest('[data-source-id]');
      if (chip) {
        const sourceId = chip.dataset.sourceId || null;
        this.dispatchEvent(new CustomEvent('source-filter', {
          bubbles: true, composed: true,
          detail: { sourceId },
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

customElements.define('pos-kb-feed-timeline', PosKBFeedTimeline);
