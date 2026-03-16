// pos-folder-tree — recursive folder tree sidebar

import { getFolders, createFolder, updateFolder, deleteFolder } from '../services/documents-api.js';
import store from '../store.js';

const TAG = 'pos-folder-tree';

class PosFolderTree extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._expanded = new Set(); // expanded folder IDs
    this._editing = null;       // folder ID being renamed
    this._folders = {};         // {parentId: [folders]}
  }

  async connectedCallback() {
    await this._loadFolders(null);
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('dblclick', (e) => this._handleDblClick(e));
    this.shadow.addEventListener('keydown', (e) => this._handleKeydown(e));

    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadFolders(parentId) {
    try {
      const folders = await getFolders(parentId);
      this._folders[parentId ?? 'root'] = folders;
    } catch (e) {
      console.error('Failed to load folders', e);
    }
  }

  render() {
    const state = store.getState();
    const current = state.currentFolderId;

    this.shadow.innerHTML = `
      <style>
        :host { display: block; padding: 8px 0; }
        .tree-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 12px 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--pos-color-text-secondary);
        }
        .new-folder-btn {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: 16px; padding: 0 4px; line-height: 1;
          border-radius: var(--pos-radius-sm);
        }
        .new-folder-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-background-primary); }
        .folder-item {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 8px 4px; cursor: pointer; border-radius: 6px;
          font-size: 13px; color: var(--pos-color-text-secondary);
          user-select: none;
        }
        .folder-item:hover { background: var(--pos-color-background-primary); color: var(--pos-color-text-primary); }
        .folder-item.active { background: var(--pos-color-action-primary-subtle, #eff6ff); color: var(--pos-color-action-primary); font-weight: 500; }
        .toggle { width: 16px; text-align: center; font-size: 10px; flex-shrink: 0; }
        .folder-icon { flex-shrink: 0; }
        .folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .folder-name-input { flex: 1; font-size: 13px; border: 1px solid var(--pos-color-action-primary); border-radius: 4px; padding: 1px 4px; outline: none; }
        .all-docs { padding: 4px 12px; font-size: 13px; cursor: pointer; color: var(--pos-color-text-secondary); border-radius: 6px; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .all-docs:hover { background: var(--pos-color-background-primary); color: var(--pos-color-text-primary); }
        .all-docs.active { color: var(--pos-color-action-primary); font-weight: 500; }
      </style>

      <div class="tree-header">
        <span>Folders</span>
        <button class="new-folder-btn" data-action="new-root-folder" title="New folder">+</button>
      </div>

      <div class="all-docs ${!current ? 'active' : ''}" data-action="select-folder" data-folder-id="">
        📄 All Documents
      </div>

      <div class="folder-list">
        ${this._renderFolders(null, 0, current)}
      </div>
    `;
  }

  _renderFolders(parentId, depth, currentFolderId) {
    const key = parentId ?? 'root';
    const folders = this._folders[key] || [];
    if (!folders.length) return '';

    const indent = depth * 16;
    return folders.map(f => {
      const isExpanded = this._expanded.has(f.id);
      const isActive = f.id === currentFolderId;
      const hasChildren = f.child_count > 0;

      const childrenHtml = isExpanded
        ? this._renderFolders(f.id, depth + 1, currentFolderId)
        : '';

      return `
        <div class="folder-item ${isActive ? 'active' : ''}" data-folder-id="${f.id}" data-action="select-folder" style="padding-left: ${8 + indent}px">
          <span class="toggle">${hasChildren ? (isExpanded ? '▾' : '▸') : ''}</span>
          <span class="folder-icon">📁</span>
          ${this._editing === f.id
            ? `<input class="folder-name-input" data-folder-id="${f.id}" value="${this._escapeHtml(f.name)}" />`
            : `<span class="folder-name">${this._escapeHtml(f.name)}</span>`
          }
        </div>
        ${childrenHtml}
      `;
    }).join('');
  }

  async _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'select-folder') {
      const el = e.target.closest('[data-folder-id]');
      if (!el) return;
      const folderId = el.dataset.folderId || null;
      const folder = folderId ? this._findFolder(folderId) : null;

      // Toggle expand/collapse for non-leaf folders
      if (folderId && folder?.child_count > 0) {
        if (this._expanded.has(folderId)) {
          this._expanded.delete(folderId);
        } else {
          this._expanded.add(folderId);
          if (!this._folders[folderId]) {
            await this._loadFolders(folderId);
          }
        }
      }

      store.setState({ currentFolderId: folderId || null });
      this.dispatchEvent(new CustomEvent('folder-selected', {
        detail: { folderId: folderId || null },
        bubbles: true, composed: true,
      }));
      this.render();
    }

    if (action === 'new-root-folder') {
      const name = prompt('Folder name:');
      if (!name?.trim()) return;
      try {
        await createFolder(name.trim(), null);
        await this._loadFolders(null);
        this.render();
      } catch (e) {
        alert('Failed to create folder');
      }
    }
  }

  _handleDblClick(e) {
    const el = e.target.closest('[data-folder-id]');
    if (!el?.dataset.folderId) return;
    this._editing = el.dataset.folderId;
    this.render();
    const input = this.shadow.querySelector(`.folder-name-input[data-folder-id="${this._editing}"]`);
    input?.focus();
    input?.select();
  }

  async _handleKeydown(e) {
    if (!this._editing) return;
    if (e.key === 'Enter') {
      const input = this.shadow.querySelector(`.folder-name-input`);
      const newName = input?.value?.trim();
      if (newName) {
        try {
          await updateFolder(this._editing, { name: newName });
          const key = this._findParentKey(this._editing);
          await this._loadFolders(key === 'root' ? null : key);
        } catch (e) {
          alert('Failed to rename folder');
        }
      }
      this._editing = null;
      this.render();
    }
    if (e.key === 'Escape') {
      this._editing = null;
      this.render();
    }
  }

  _findFolder(id) {
    for (const folders of Object.values(this._folders)) {
      const f = folders.find(f => f.id === id);
      if (f) return f;
    }
    return null;
  }

  _findParentKey(folderId) {
    for (const [key, folders] of Object.entries(this._folders)) {
      if (folders.find(f => f.id === folderId)) return key;
    }
    return 'root';
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

customElements.define(TAG, PosFolderTree);
