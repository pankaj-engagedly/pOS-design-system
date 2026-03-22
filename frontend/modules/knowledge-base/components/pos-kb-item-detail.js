// pos-kb-item-detail — Flyout panel (380px slide-in): metadata, status, tags, rating

import { icon } from '../../../shared/utils/icons.js';
import { getCollections, addToCollection, removeFromCollection, getTags } from '../services/kb-api.js';
import '../../../../design-system/src/components/ui-tag-input.js';

class PosKBItemDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
    this._allTags = [];
    this._collections = [];
    this._itemCollectionIds = new Set();
  }

  openForItem(item) {
    this._item = item;
    this._itemCollectionIds = new Set((item.collection_ids || []).map(String));
    this._loadCollections();
    getTags().then(tags => {
      this._allTags = tags;
      const tagEl = this.shadow.getElementById('tag-input');
      if (tagEl) tagEl.allTags = tags;
    }).catch(() => {});
    this._render();
    this._bindDetailEvents();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    this._item = null;
  }

  refreshItem(item) {
    if (!item || !this._item || item.id !== this._item.id) return;
    this._item = item;
    this._render();
    this._bindDetailEvents();
  }

  async _loadCollections() {
    try {
      const collections = await getCollections();
      this._collections = collections;
      this._renderCollectionsField();
    } catch (e) {
      console.error('Failed to load collections', e);
    }
  }

  _render() {
    if (!this._item) { this.shadow.innerHTML = ''; return; }
    const it = this._item;

    this.shadow.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0; right: 0;
          width: 380px;
          height: 100%;
          background: var(--pos-color-background-primary);
          border-left: 1px solid var(--pos-color-border-default);
          box-shadow: -6px 0 24px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.22s ease;
          z-index: 50;
          overflow: hidden;
        }
        :host([open]) { transform: translateX(0); }

        .header {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 10px var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          flex-shrink: 0;
        }
        .header-title {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-medium);
          color: var(--pos-color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .close-btn, .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          padding: 0;
        }
        .close-btn:hover, .action-btn:hover {
          background: var(--pos-color-border-default);
          color: var(--pos-color-text-primary);
        }

        .body {
          flex: 1;
          overflow-y: auto;
          padding: var(--pos-space-md);
        }

        .title-text {
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          line-height: 1.4;
          margin-bottom: var(--pos-space-sm);
        }

        .url-link {
          display: flex;
          align-items: center;
          gap: var(--pos-space-xs);
          color: var(--pos-color-action-primary);
          font-size: var(--pos-font-size-sm);
          text-decoration: none;
          margin-bottom: var(--pos-space-md);
          word-break: break-all;
        }
        .url-link:hover { text-decoration: underline; }

        .field { margin-bottom: var(--pos-space-md); }
        .field-label {
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--pos-space-xs);
        }

        .collection-chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .collection-chip {
          padding: 4px 10px;
          border-radius: 99px;
          border: 1px solid var(--pos-color-border-default);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.1s;
        }
        .collection-chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .collection-chip.in-collection {
          background: var(--pos-color-action-primary);
          color: white;
          border-color: var(--pos-color-action-primary);
        }

        .rating-stars { display: flex; gap: 2px; }
        .star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          color: var(--pos-color-border-default);
        }
        .star-btn.filled { color: #f59e0b; }
        .star-btn:hover { color: #f59e0b; }

        /* Tags — uses ui-tag-input component */

        .meta-info {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .meta-row { display: flex; align-items: center; gap: var(--pos-space-xs); }

        .preview-text {
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-secondary);
          line-height: 1.5;
        }

        .delete-btn {
          width: 100%;
          padding: var(--pos-space-sm);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-priority-urgent);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          margin-top: var(--pos-space-md);
        }
        .delete-btn:hover {
          background: var(--pos-color-priority-urgent);
          color: white;
          border-color: var(--pos-color-priority-urgent);
        }
      </style>

      <div class="header">
        <span class="header-title">Item Details</span>
        ${it.url ? `<button class="action-btn" data-action="open-url" title="Open URL">${icon('external-link', 14)}</button>` : ''}
        <button class="action-btn" data-action="favourite" title="${it.is_favourite ? 'Unfavourite' : 'Favourite'}">
          ${icon('star', 14)}
        </button>
        <button class="close-btn" data-action="close">${icon('x', 16)}</button>
      </div>

      <div class="body">
        <div class="title-text">${this._esc(it.title)}</div>

        ${it.url ? `<a class="url-link" href="${this._escAttr(it.url)}" target="_blank" rel="noopener">
          ${icon('external-link', 12)} ${this._esc(this._shortenUrl(it.url))}
        </a>` : ''}

        <div class="field">
          <div class="field-label">Collections</div>
          <div class="collection-chips" id="collection-chips"></div>
        </div>

        <div class="field">
          <div class="field-label">Rating</div>
          <div class="rating-stars">
            ${[1,2,3,4,5].map(n => `
              <button class="star-btn ${it.rating >= n ? 'filled' : ''}" data-rating="${n}">
                ${icon('star', 18)}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <div class="field-label">Tags</div>
          <ui-tag-input id="tag-input"></ui-tag-input>
        </div>

        ${it.preview_text ? `
          <div class="field">
            <div class="field-label">Preview</div>
            <div class="preview-text">${this._esc(it.preview_text)}</div>
          </div>
        ` : ''}

        <div class="field">
          <div class="field-label">Info</div>
          <div class="meta-info">
            ${it.source ? `<div class="meta-row">${icon('globe', 11)} ${this._esc(it.source)}</div>` : ''}
            ${it.author ? `<div class="meta-row">${icon('user', 11)} ${this._esc(it.author)}</div>` : ''}
            ${it.reading_time_min ? `<div class="meta-row">${icon('clock', 11)} ${it.reading_time_min} min read</div>` : ''}
            ${it.word_count ? `<div class="meta-row">${icon('file-text', 11)} ${it.word_count.toLocaleString()} words</div>` : ''}
            <div class="meta-row">${icon('calendar', 11)} Added ${new Date(it.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <button class="delete-btn" data-action="delete">Delete item</button>
      </div>
    `;

    // Populate tag component
    const tagEl = this.shadow.getElementById('tag-input');
    if (tagEl) {
      tagEl.tags = it.tags || [];
      tagEl.allTags = this._allTags;
    }
  }

  _renderCollectionsField() {
    const container = this.shadow.getElementById('collection-chips');
    if (!container || !this._collections.length) return;
    container.innerHTML = this._collections.map(c => `
      <button class="collection-chip ${this._itemCollectionIds.has(c.id) ? 'in-collection' : ''}"
              data-col-id="${c.id}">
        ${this._esc(c.name)}
      </button>
    `).join('');
  }

  _bindDetailEvents() {
    this.shadow.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) {
        // Collection chip
        const colChip = e.target.closest('[data-col-id]');
        if (colChip) { this._toggleCollection(colChip.dataset.colId); return; }
        // Rating star
        const star = e.target.closest('[data-rating]');
        if (star) {
          this.dispatchEvent(new CustomEvent('detail-action', {
            bubbles: true, composed: true,
            detail: { action: 'update-rating', itemId: this._item?.id, rating: parseInt(star.dataset.rating) },
          }));
          return;
        }
        return;
      }

      if (action === 'close') { this.close(); return; }
      if (action === 'open-url' && this._item?.url) {
        window.open(this._item.url, '_blank', 'noopener');
        return;
      }

      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action, itemId: this._item?.id, ...e.target.closest('[data-action]').dataset },
      }));
    });

    // Tag component events → bridge to detail-action
    this.shadow.addEventListener('tag-add', (e) => {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'add-tag-submit', itemId: this._item?.id, tagName: e.detail.name },
      }));
    });

    this.shadow.addEventListener('tag-remove', (e) => {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'remove-tag', itemId: this._item?.id, tagId: e.detail.tagId },
      }));
    });
  }

  async _toggleCollection(collectionId) {
    if (!this._item) return;
    try {
      if (this._itemCollectionIds.has(collectionId)) {
        await removeFromCollection(collectionId, this._item.id);
        this._itemCollectionIds.delete(collectionId);
      } else {
        await addToCollection(collectionId, this._item.id);
        this._itemCollectionIds.add(collectionId);
      }
      this._renderCollectionsField();
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'collections-changed', itemId: this._item.id },
      }));
    } catch (err) {
      console.error('Failed to toggle collection', err);
    }
  }

  _shortenUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname.length > 30 ? u.pathname.substring(0, 30) + '\u2026' : u.pathname);
    } catch {
      return url.length > 50 ? url.substring(0, 50) + '\u2026' : url;
    }
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

customElements.define('pos-kb-item-detail', PosKBItemDetail);
