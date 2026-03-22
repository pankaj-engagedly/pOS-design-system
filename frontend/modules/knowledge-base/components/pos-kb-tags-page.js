// pos-kb-tags-page — Tag management: list all KB tags, rename, delete

import { icon } from '../../../shared/utils/icons.js';
import { getTags, renameTag, deleteTag } from '../services/kb-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import { TABLE_STYLES } from '../../../../design-system/src/components/ui-table.js';
import '../../../shared/components/pos-page-header.js';
import '../../../../design-system/src/components/ui-search-input.js';

const pageSheet = new CSSStyleSheet();
pageSheet.replaceSync(`
  :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  ui-search-input { width: 160px; }

  .list {
    flex: 1; overflow-y: auto;
    padding: var(--pos-space-sm) var(--pos-space-lg);
  }

  .rename-input {
    padding: 4px 8px;
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); font-family: inherit;
    outline: none; background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    width: 200px;
  }

  .empty {
    text-align: center; padding: var(--pos-space-xl);
    color: var(--pos-color-text-tertiary); font-size: var(--pos-font-size-sm);
  }
`);

class PosKBTagsPage extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [TABLE_STYLES, pageSheet];
    this._tags = [];
    this._renamingId = null;
    this._searchQuery = '';
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
    this._load();
  }

  async _load() {
    try {
      this._tags = await getTags();
      this._renderList();
    } catch (e) {
      console.error('Failed to load tags', e);
    }
  }

  _getFiltered() {
    if (!this._searchQuery) return this._tags;
    const q = this._searchQuery.toLowerCase();
    return this._tags.filter(t => t.name.toLowerCase().includes(q));
  }

  _render() {
    this.shadow.innerHTML = `
      <pos-page-header>
        Tags
        <span slot="subtitle" id="tag-count"></span>
        <span slot="actions">
          <ui-search-input size="sm" placeholder="Filter tags..." id="search"></ui-search-input>
        </span>
      </pos-page-header>
      <div class="list" id="tag-list"></div>
    `;
  }

  _renderList() {
    const container = this.shadow.getElementById('tag-list');
    const countEl = this.shadow.getElementById('tag-count');
    if (!container) return;

    const filtered = this._getFiltered();
    if (countEl) countEl.textContent = `${this._tags.length} tag${this._tags.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty">${this._searchQuery ? 'No tags match your search' : 'No tags yet'}</div>`;
      return;
    }

    container.innerHTML = `
      <table class="pos-table">
        <thead>
          <tr>
            <th>Tag</th>
            <th class="num" style="width:80px">Items</th>
            <th style="width:70px"></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(t => {
            if (this._renamingId === t.id) {
              return `
                <tr>
                  <td colspan="3">
                    <input class="rename-input" id="rename-input" value="${this._escAttr(t.name)}" data-tag-id="${t.id}" />
                  </td>
                </tr>`;
            }
            return `
              <tr class="clickable" data-tag-id="${t.id}">
                <td>${icon('tag', 13)} ${this._esc(t.name)}</td>
                <td class="num">${t.kb_item_count}</td>
                <td>
                  <span class="row-actions">
                    <button class="row-action-btn" data-action="rename" data-id="${t.id}" title="Rename">${icon('edit', 13)}</button>
                    <button class="row-action-btn delete" data-action="delete" data-id="${t.id}" title="Delete">${icon('trash', 13)}</button>
                  </span>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    if (this._renamingId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById('rename-input');
        inp?.focus();
        inp?.select();
      }, 0);
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const id = e.target.closest('[data-id]')?.dataset.id;

      if (action === 'rename' && id) {
        this._renamingId = id;
        this._renderList();
        return;
      }

      if (action === 'delete' && id) {
        const tag = this._tags.find(t => t.id === id);
        if (!await confirmDialog(`Delete tag "${tag?.name}"? It will be removed from ${tag?.kb_item_count || 0} items.`, { confirmLabel: 'Delete', danger: true })) return;
        try {
          await deleteTag(id);
          await this._load();
          this.dispatchEvent(new CustomEvent('tags-changed', { bubbles: true, composed: true }));
        } catch (err) {
          console.error('Failed to delete tag', err);
        }
        return;
      }

      // Click on tag row → filter by tag
      const row = e.target.closest('tr[data-tag-id]');
      if (row && !e.target.closest('.row-action-btn') && !e.target.closest('.rename-input')) {
        const tag = this._tags.find(t => t.id === row.dataset.tagId);
        if (tag) {
          this.dispatchEvent(new CustomEvent('tag-filter', {
            bubbles: true, composed: true,
            detail: { tag: tag.name },
          }));
        }
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      const renameInput = e.target.closest('#rename-input');
      if (!renameInput) return;
      if (e.key === 'Enter' && renameInput.value.trim()) {
        this._doRename(renameInput.dataset.tagId, renameInput.value.trim());
      }
      if (e.key === 'Escape') {
        this._renamingId = null;
        this._renderList();
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#rename-input')) {
        setTimeout(() => {
          if (this._renamingId) { this._renamingId = null; this._renderList(); }
        }, 150);
      }
    });

    this.shadow.addEventListener('search-input', (e) => {
      this._searchQuery = e.detail.value;
      this._renderList();
    });
  }

  async _doRename(tagId, newName) {
    try {
      await renameTag(tagId, newName);
      this._renamingId = null;
      await this._load();
      this.dispatchEvent(new CustomEvent('tags-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to rename tag', err);
    }
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

customElements.define('pos-kb-tags-page', PosKBTagsPage);
