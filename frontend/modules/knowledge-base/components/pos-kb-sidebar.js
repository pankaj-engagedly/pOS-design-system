// pos-kb-sidebar — Smart views + feeds + collections
// Composes: pos-sidebar (shell + scroll + footer)

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import { getCollections, createCollection, updateCollection, deleteCollection, getStats } from '../services/kb-api.js';
import { getFeedStats } from '../services/feed-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import '../../../shared/components/pos-sidebar.js';

const kbSheet = new CSSStyleSheet();
kbSheet.replaceSync(`
  .new-collection-btn {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }
  .new-collection-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .new-collection-input {
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
`);

const SMART_VIEWS = [
  { key: 'all',        label: 'All Items',       iconName: 'layers' },
  { key: 'favourites', label: 'Favourites',       iconName: 'star' },
  { key: 'top_rated',  label: 'Top Rated',        iconName: 'award' },
  { key: 'recent',     label: 'Recently Added',   iconName: 'clock' },
];

class PosKBSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, kbSheet];
    this._selectedView = 'all';
    this._selectedCollectionId = null;
    this._collections = [];
    this._stats = {};
    this._feedUnread = 0;
    this._addingCollection = false;
    this._renamingId = null;
  }

  set selectedView(val) { this._selectedView = val; this._render(); }
  set selectedCollectionId(val) { this._selectedCollectionId = val; this._render(); }
  set stats(val) { this._stats = val || {}; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
    this.refreshData();
  }

  async refreshData() {
    try {
      const [collections, stats, feedStats] = await Promise.all([
        getCollections().catch(() => []),
        getStats().catch(() => ({})),
        getFeedStats().catch(() => ({ total_unread: 0 })),
      ]);
      this._collections = collections;
      this._stats = stats;
      this._feedUnread = feedStats.total_unread || 0;
      this._render();
    } catch (e) {
      console.error('Sidebar data load failed', e);
    }
  }

  _render() {
    const getCounts = (key) => {
      if (key === 'all' && this._stats.total) return this._stats.total;
      if (key === 'favourites' && this._stats.favourites) return this._stats.favourites;
      return 0;
    };

    const pinned = this._collections.filter(c => c.is_pinned);
    const unpinned = this._collections.filter(c => !c.is_pinned);

    this.shadow.innerHTML = `
      <pos-sidebar title="Knowledge Base">

        ${SMART_VIEWS.map(v => {
          const active = this._selectedView === v.key && !this._selectedCollectionId;
          const count = getCounts(v.key);
          return `
            <div class="nav-item ${active ? 'active' : ''}" data-view="${v.key}">
              ${icon(v.iconName, 15)}
              <span class="nav-label">${v.label}</span>
              ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
            </div>`;
        }).join('')}

        ${pinned.map(c => this._renderCollectionItem(c)).join('')}

        <div class="divider"></div>

        <div class="nav-item ${this._selectedView === 'feeds' && !this._selectedCollectionId ? 'active' : ''}" data-view="feeds">
          ${icon('rss', 15)}
          <span class="nav-label">My Feeds</span>
          ${this._feedUnread > 0 ? `<span class="nav-count">${this._feedUnread}</span>` : ''}
        </div>

        <div class="divider"></div>
        <div class="section-label">Collections</div>

        ${unpinned.map(c => this._renderCollectionItem(c)).join('')}

        <div slot="footer">
          ${this._addingCollection
            ? `<input class="new-collection-input" id="new-collection-input" placeholder="Collection name\u2026" />`
            : `<button class="new-collection-btn" id="new-collection-btn">
                 ${icon('plus', 13)} New Collection
               </button>`
          }
        </div>

      </pos-sidebar>
    `;

    if (this._addingCollection) {
      setTimeout(() => this.shadow.getElementById('new-collection-input')?.focus(), 0);
    }
    if (this._renamingId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById('rename-input');
        inp?.focus();
        inp?.select();
      }, 0);
    }
  }

  _renderCollectionItem(c) {
    if (this._renamingId === c.id) {
      return `<div class="rename-wrap">
        <input class="rename-input" id="rename-input" value="${this._escAttr(c.name)}" data-collection-id="${c.id}" />
      </div>`;
    }
    return `<div class="nav-item ${this._selectedCollectionId === c.id ? 'active' : ''}"
                data-collection-id="${c.id}" data-collection-name="${this._escAttr(c.name)}">
        ${icon(c.is_pinned ? 'bookmark' : 'folder', 15)}
        <span class="nav-label">${this._esc(c.name)}</span>
        ${c.item_count ? `<span class="nav-count">${c.item_count}</span>` : ''}
        <div class="nav-actions">
          <button class="nav-action-btn" data-action="pin-collection" data-id="${c.id}" data-pinned="${c.is_pinned}" title="${c.is_pinned ? 'Unpin' : 'Pin to top'}">
            ${icon(c.is_pinned ? 'chevron-down' : 'chevron-up', 13)}
          </button>
          <button class="nav-action-btn" data-action="rename-collection" data-id="${c.id}" title="Rename">
            ${icon('edit', 13)}
          </button>
          <button class="nav-action-btn delete" data-action="delete-collection" data-id="${c.id}" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>`;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // New collection button
      if (e.target.closest('#new-collection-btn')) {
        this._addingCollection = true;
        this._render();
        return;
      }

      // Action buttons — handle before nav-item so clicks don't also select
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        if (actionBtn.dataset.action === 'rename-collection') {
          this._renamingId = actionBtn.dataset.id;
          this._render();
        } else if (actionBtn.dataset.action === 'delete-collection') {
          this._deleteCollection(actionBtn.dataset.id);
        } else if (actionBtn.dataset.action === 'pin-collection') {
          this._togglePin(actionBtn.dataset.id, actionBtn.dataset.pinned === 'true');
        }
        return;
      }

      // Nav item selection
      const item = e.target.closest('.nav-item');
      if (!item) return;

      if (item.dataset.view) {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view: item.dataset.view },
        }));
      } else if (item.dataset.collectionId) {
        this.dispatchEvent(new CustomEvent('collection-select', {
          bubbles: true, composed: true,
          detail: { collectionId: item.dataset.collectionId, collectionName: item.dataset.collectionName },
        }));
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      // New collection input
      const newInput = e.target.closest('#new-collection-input');
      if (newInput) {
        if (e.key === 'Enter' && newInput.value.trim()) {
          this._createCollection(newInput.value.trim());
        }
        if (e.key === 'Escape') { this._addingCollection = false; this._render(); }
        return;
      }

      // Rename input
      const renameInput = e.target.closest('#rename-input');
      if (renameInput) {
        if (e.key === 'Enter' && renameInput.value.trim()) {
          this._renameCollection(renameInput.dataset.collectionId, renameInput.value.trim());
        }
        if (e.key === 'Escape') { this._renamingId = null; this._render(); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-collection-input')) {
        setTimeout(() => {
          if (this._addingCollection) { this._addingCollection = false; this._render(); }
        }, 150);
      }
      if (e.target.closest('#rename-input')) {
        setTimeout(() => {
          if (this._renamingId) { this._renamingId = null; this._render(); }
        }, 150);
      }
    });
  }

  async _createCollection(name) {
    try {
      await createCollection({ name });
      this._addingCollection = false;
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to create collection', err);
    }
  }

  async _renameCollection(id, name) {
    try {
      await updateCollection(id, { name });
      this._renamingId = null;
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to rename collection', err);
    }
  }

  async _togglePin(id, currentlyPinned) {
    try {
      await updateCollection(id, { is_pinned: !currentlyPinned });
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  }

  async _deleteCollection(id) {
    if (!await confirmDialog('Delete this collection?', { confirmLabel: 'Delete', danger: true })) return;
    try {
      await deleteCollection(id);
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to delete collection', err);
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

customElements.define('pos-kb-sidebar', PosKBSidebar);
