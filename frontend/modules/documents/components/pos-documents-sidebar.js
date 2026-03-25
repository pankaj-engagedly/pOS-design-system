// pos-documents-sidebar — Documents sidebar: smart views + nested folder tree
// Composes: pos-sidebar (shell + scroll + footer)

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../services/documents-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import '../../../shared/components/pos-sidebar.js';

const docSidebarSheet = new CSSStyleSheet();
docSidebarSheet.replaceSync(`
  .new-folder-btn {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    width: 100%;
    padding: 6px var(--pos-space-sm);
    margin-top: var(--pos-space-sm);
    border: 1px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
    box-sizing: border-box;
  }
  .new-folder-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .new-folder-input {
    width: 100%;
    padding: 6px var(--pos-space-sm);
    margin-top: var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
  .subfolder-input-wrap {
    padding: 2px var(--pos-space-xs);
  }
  .subfolder-input {
    width: 100%;
    padding: 4px var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
  .expand-chevron {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    color: var(--pos-color-text-secondary);
  }
  .expand-chevron.has-children:hover { background: var(--pos-color-border-default); }
`);

class PosDocumentsSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, docSidebarSheet];
    this._selectedView = 'home';
    this._selectedFolderId = null;
    this._folders = {};           // { 'root': [...], [folderId]: [...] }
    this._expanded = new Set();
    this._renamingId = null;
    this._showNewInput = false;
    this._creatingSubfolderId = null;   // parent folder ID for new subfolder input
  }

  set selectedView(val) { this._selectedView = val; this._render(); }
  set selectedFolderId(val) { this._selectedFolderId = val; this._render(); }

  async connectedCallback() {
    this._bindEvents();
    await this._loadFolders(null);
    this._render();
  }

  async _loadFolders(parentId) {
    try {
      const folders = await getFolders(parentId);
      this._folders[parentId ?? 'root'] = folders;
    } catch (e) {
      console.error('Failed to load folders', e);
    }
  }

  _render() {
    const SMART_VIEWS = [
      { view: 'home',       label: 'Home',              iconName: 'home' },
      { view: 'recent',     label: 'Recently Accessed',  iconName: 'file-text' },
      { view: 'favourites', label: 'Favourites',         iconName: 'star' },
    ];

    this.shadow.innerHTML = `
      <pos-sidebar title="Documents">

        ${SMART_VIEWS.map(v => `
          <div class="nav-item ${this._selectedView === v.view && !this._selectedFolderId ? 'active' : ''}"
               data-view="${v.view}">
            ${icon(v.iconName, 15)}
            <span class="nav-label">${v.label}</span>
          </div>
        `).join('')}

        <div class="divider"></div>
        <div class="section-label">Folders</div>

        ${this._renderFoldersFlat(null, 0)}

        ${this._showNewInput
          ? `<input class="new-folder-input" id="new-folder-input" placeholder="Folder name…" />`
          : `<button class="new-folder-btn" id="new-folder-btn">
               ${icon('plus', 13)} New folder
             </button>`
        }

      </pos-sidebar>
    `;

    if (this._showNewInput) {
      setTimeout(() => this.shadow.getElementById('new-folder-input')?.focus(), 0);
    }
    if (this._renamingId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById(`rename-${this._renamingId}`);
        inp?.focus();
        inp?.select();
      }, 0);
    }
    if (this._creatingSubfolderId !== null) {
      setTimeout(() => this.shadow.getElementById('subfolder-input')?.focus(), 0);
    }
  }

  _renderFoldersFlat(parentId, depth) {
    const key = parentId ?? 'root';
    const folders = this._folders[key] || [];

    return folders.map(f => {
      const isExpanded = this._expanded.has(f.id);
      const isActive = f.id === this._selectedFolderId;
      const hasChildren = f.child_count > 0;
      const count = f.document_count || 0;
      const paddingLeft = 6 + depth * 14;

      if (this._renamingId === f.id) {
        return `
          <div class="rename-wrap">
            <input class="rename-input" id="rename-${f.id}"
                   value="${this._escAttr(f.name)}" data-folder-id="${f.id}" />
          </div>
          ${this._creatingSubfolderId === f.id ? this._subfolderInputHtml(f.id, paddingLeft + 14) : ''}
          ${isExpanded && this._folders[f.id] ? this._renderFoldersFlat(f.id, depth + 1) : ''}
        `;
      }

      return `
        <div class="nav-item ${isActive ? 'active' : ''}"
             data-folder-id="${f.id}"
             style="padding-left:${paddingLeft}px">
          <span class="expand-chevron${hasChildren ? ' has-children' : ''}"
                ${hasChildren ? `data-action="toggle-expand" data-folder-id="${f.id}"` : ''}>
            ${hasChildren ? (isExpanded ? icon('chevron-down', 11) : icon('chevron-right', 11)) : ''}
          </span>
          ${icon('folder', 13)}
          <span class="nav-label">${this._esc(f.name)}</span>
          ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
          <div class="nav-actions">
            <button class="nav-action-btn" data-action="add-subfolder" data-folder-id="${f.id}" title="New subfolder">
              ${icon('plus', 11)}
            </button>
            <button class="nav-action-btn" data-action="rename" data-folder-id="${f.id}" title="Rename">
              ${icon('edit', 11)}
            </button>
            <button class="nav-action-btn delete" data-action="delete" data-folder-id="${f.id}" title="Delete">
              ${icon('trash', 11)}
            </button>
          </div>
        </div>
        ${this._creatingSubfolderId === f.id ? this._subfolderInputHtml(f.id, paddingLeft + 14) : ''}
        ${isExpanded && this._folders[f.id] ? this._renderFoldersFlat(f.id, depth + 1) : ''}
      `;
    }).join('');
  }

  _subfolderInputHtml(parentId, paddingLeft) {
    return `
      <div class="subfolder-input-wrap" style="padding-left:${paddingLeft}px">
        <input class="subfolder-input" id="subfolder-input"
               placeholder="Subfolder name…" data-parent-id="${parentId}" />
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      // New root folder button
      if (e.target.closest('#new-folder-btn')) {
        this._showNewInput = true;
        this._render();
        return;
      }

      // Action buttons — handle before nav-item to prevent selection
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const { action, folderId } = actionBtn.dataset;

        if (action === 'toggle-expand') {
          e.stopPropagation();
          await this._toggleExpand(folderId);
          return;
        }

        if (action === 'add-subfolder') {
          e.stopPropagation();
          this._creatingSubfolderId = folderId;
          if (!this._expanded.has(folderId)) {
            this._expanded.add(folderId);
            if (!this._folders[folderId]) {
              await this._loadFolders(folderId);
            }
          }
          this._render();
          return;
        }

        if (action === 'rename') {
          e.stopPropagation();
          this._renamingId = folderId;
          this._render();
          return;
        }

        if (action === 'delete') {
          e.stopPropagation();
          if (!await confirmDialog('Delete this folder and all its contents?', { confirmLabel: 'Delete', danger: true })) return;
          try {
            await deleteFolder(folderId);
            for (const key of Object.keys(this._folders)) {
              this._folders[key] = this._folders[key].filter(f => f.id !== folderId);
            }
            if (this._selectedFolderId === folderId) {
              this._selectedFolderId = null;
              this._selectedView = 'home';
              this.dispatchEvent(new CustomEvent('smart-view-select', {
                bubbles: true, composed: true,
                detail: { view: 'home' },
              }));
            }
            this.dispatchEvent(new CustomEvent('folders-changed', { bubbles: true, composed: true }));
            this._render();
          } catch {
            alert('Failed to delete folder');
          }
          return;
        }
        return;
      }

      // Nav item — smart view or folder selection
      const item = e.target.closest('.nav-item');
      if (!item) return;

      if (item.dataset.view) {
        this._selectedView = item.dataset.view;
        this._selectedFolderId = null;
        this._render();
        this.dispatchEvent(new CustomEvent('smart-view-select', {
          bubbles: true, composed: true,
          detail: { view: item.dataset.view },
        }));
      } else if (item.dataset.folderId) {
        const folderId = item.dataset.folderId;
        this._selectedView = null;
        this._selectedFolderId = folderId;
        // Also toggle expand if folder has children
        let folder = this._findFolder(folderId);
        if (folder?.child_count > 0) {
          await this._toggleExpand(folderId);
          folder = this._findFolder(folderId);
        } else {
          this._render();
        }
        this.dispatchEvent(new CustomEvent('folder-select', {
          bubbles: true, composed: true,
          detail: { folderId, folderName: folder?.name || '' },
        }));
      }
    });

    this.shadow.addEventListener('keydown', async (e) => {
      // New root folder input
      const newInput = e.target.closest('#new-folder-input');
      if (newInput) {
        if (e.key === 'Enter' && newInput.value.trim()) {
          await this._createFolder(newInput.value.trim(), null);
          this._showNewInput = false;
          this._render();
        }
        if (e.key === 'Escape') { this._showNewInput = false; this._render(); }
        return;
      }

      // New subfolder input
      const subInput = e.target.closest('#subfolder-input');
      if (subInput) {
        if (e.key === 'Enter' && subInput.value.trim()) {
          const parentId = subInput.dataset.parentId;
          await this._createFolder(subInput.value.trim(), parentId);
          this._creatingSubfolderId = null;
          this._render();
        }
        if (e.key === 'Escape') { this._creatingSubfolderId = null; this._render(); }
        return;
      }

      // Rename input
      const renameInput = e.target.closest('.rename-input');
      if (renameInput) {
        if (e.key === 'Enter' && renameInput.value.trim()) {
          try {
            await updateFolder(renameInput.dataset.folderId, { name: renameInput.value.trim() });
            const parentKey = this._findParentKey(renameInput.dataset.folderId);
            await this._loadFolders(parentKey === 'root' ? null : parentKey);
            this.dispatchEvent(new CustomEvent('folders-changed', { bubbles: true, composed: true }));
          } catch {
            alert('Failed to rename folder');
          }
          this._renamingId = null;
          this._render();
        }
        if (e.key === 'Escape') { this._renamingId = null; this._render(); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-folder-input')) {
        setTimeout(() => { if (this._showNewInput) { this._showNewInput = false; this._render(); } }, 150);
      }
      if (e.target.closest('#subfolder-input')) {
        setTimeout(() => { if (this._creatingSubfolderId !== null) { this._creatingSubfolderId = null; this._render(); } }, 150);
      }
      if (e.target.closest('.rename-input')) {
        setTimeout(() => { if (this._renamingId) { this._renamingId = null; this._render(); } }, 150);
      }
    });
  }

  async _createFolder(name, parentId) {
    try {
      await createFolder(name, parentId || null);
      await this._loadFolders(parentId || null);
      // Ensure parent is expanded so new folder is visible
      if (parentId && !this._expanded.has(parentId)) {
        this._expanded.add(parentId);
      }
      this.dispatchEvent(new CustomEvent('folders-changed', { bubbles: true, composed: true }));
    } catch {
      alert('Failed to create folder');
    }
  }

  async _toggleExpand(folderId) {
    const folder = this._findFolder(folderId);
    if (!folder || folder.child_count === 0) return;
    if (this._expanded.has(folderId)) {
      this._expanded.delete(folderId);
    } else {
      this._expanded.add(folderId);
      if (!this._folders[folderId]) {
        await this._loadFolders(folderId);
      }
    }
    this._render();
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

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-documents-sidebar', PosDocumentsSidebar);
