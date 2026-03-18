// pos-folder-picker — modal for selecting a destination folder (move document)
// Public API: open(documentId, documentName, currentFolderId)
// Emits: document-moved { documentId, folderId } on successful move

import { getFolders } from '../services/documents-api.js';
import { icon } from '../../../shared/utils/icons.js';

const TAG = 'pos-folder-picker';

class PosFolderPicker extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._documentId = null;
    this._documentName = '';
    this._currentFolderId = null;   // folder the doc currently lives in
    this._selected = null;          // null = nothing chosen yet, '' = root, '<uuid>' = folder
    this._folderMap = {};           // { parentKey: [...folders] }
    this._expanded = new Set();
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async open(documentId, documentName, currentFolderId) {
    this._documentId = documentId;
    this._documentName = documentName || 'document';
    this._currentFolderId = currentFolderId || null;
    this._selected = null;
    this._folderMap = {};
    this._expanded = new Set();
    this._open = true;
    this.render();   // show spinner immediately

    // Load the full tree (root + children of any pre-expanded folders)
    await this._loadFolders(null);
    // Pre-expand any ancestor of currentFolderId
    if (this._currentFolderId) {
      await this._expandAncestors(this._currentFolderId);
    }
    this.render();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async _loadFolders(parentId) {
    const key = parentId ?? 'root';
    if (this._folderMap[key]) return;   // already loaded
    try {
      const folders = await getFolders(parentId);
      this._folderMap[key] = folders;
    } catch {
      this._folderMap[key] = [];
    }
  }

  // Walk loaded folders to find ancestors of targetId and expand them
  async _expandAncestors(targetId) {
    const parentKey = this._findParentKey(targetId);
    if (!parentKey || parentKey === 'root') return;
    // parentKey is actually a folder id — expand it
    if (!this._expanded.has(parentKey)) {
      this._expanded.add(parentKey);
      await this._loadFolders(parentKey);
      // recurse up
      await this._expandAncestors(parentKey);
    }
  }

  _findParentKey(folderId) {
    for (const [key, list] of Object.entries(this._folderMap)) {
      if (list.find(f => f.id === folderId)) return key;
    }
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    if (!this._open) {
      this.shadow.innerHTML = '';
      return;
    }

    const name = this._esc(this._documentName);
    const moveDisabled = this._selected === null ? 'disabled' : '';

    this.shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
        }
        .dialog {
          background: var(--pos-color-background-primary);
          border-radius: 12px;
          width: 400px; max-width: 92vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          display: flex; flex-direction: column;
          max-height: 80vh;
          overflow: hidden;
        }

        /* Header */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }
        .header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--pos-color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .close-btn {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-secondary);
          padding: 4px; border-radius: 4px;
          display: flex; align-items: center;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .close-btn:hover { background: var(--pos-color-background-secondary); }

        /* Folder tree */
        .tree {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .root-row {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px;
          cursor: pointer;
          font-size: 13px;
          color: var(--pos-color-text-primary);
          border-radius: 0;
          user-select: none;
        }
        .root-row:hover { background: var(--pos-color-background-secondary); }
        .root-row.selected {
          background: var(--pos-color-action-primary-subtle, #eff6ff);
          color: var(--pos-color-action-primary);
          font-weight: 500;
        }

        .divider {
          height: 1px;
          background: var(--pos-color-border-default);
          margin: 4px 16px;
        }

        .folder-row {
          display: flex; align-items: center; gap: 0;
          padding: 6px 0;
          cursor: pointer;
          font-size: 13px;
          color: var(--pos-color-text-primary);
          user-select: none;
          position: relative;
        }
        .folder-row:hover { background: var(--pos-color-background-secondary); }
        .folder-row.selected {
          background: var(--pos-color-action-primary-subtle, #eff6ff);
          color: var(--pos-color-action-primary);
          font-weight: 500;
        }
        .folder-row.current-folder {
          opacity: 0.45;
          cursor: not-allowed;
          pointer-events: none;
        }

        .chevron-slot {
          width: 16px; height: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: var(--pos-color-text-secondary);
          border-radius: 3px;
          cursor: pointer;
        }
        .chevron-slot.clickable:hover { background: var(--pos-color-border-default); }

        .folder-icon {
          display: flex; align-items: center;
          color: var(--pos-color-text-secondary);
          flex-shrink: 0;
          margin-right: 6px;
        }
        .folder-row.selected .folder-icon { color: var(--pos-color-action-primary); }

        .folder-name {
          flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .current-label {
          font-size: 11px;
          color: var(--pos-color-text-secondary);
          flex-shrink: 0;
          margin-right: 12px;
          font-style: italic;
        }

        /* Footer */
        .footer {
          display: flex; gap: 8px; justify-content: flex-end;
          padding: 14px 20px;
          border-top: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }
        .cancel-btn {
          background: none;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm, 6px);
          padding: 6px 14px;
          cursor: pointer;
          font-size: 13px;
          font-family: inherit;
          color: var(--pos-color-text-primary);
        }
        .cancel-btn:hover { background: var(--pos-color-background-secondary); }
        .move-btn {
          background: var(--pos-color-action-primary);
          color: white;
          border: none;
          border-radius: var(--pos-radius-sm, 6px);
          padding: 6px 16px;
          cursor: pointer;
          font-size: 13px;
          font-family: inherit;
          font-weight: 500;
        }
        .move-btn:hover:not(:disabled) { opacity: 0.9; }
        .move-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .loading {
          padding: 24px 16px;
          color: var(--pos-color-text-secondary);
          font-size: 13px;
          text-align: center;
        }
      </style>

      <div class="overlay">
        <div class="dialog">
          <div class="header">
            <h3>Move "${name}"</h3>
            <button class="close-btn" data-action="close" title="Close">
              ${icon('x', 16)}
            </button>
          </div>

          <div class="tree">
            ${Object.keys(this._folderMap).length === 0
              ? '<div class="loading">Loading folders…</div>'
              : this._renderTree()
            }
          </div>

          <div class="footer">
            <button class="cancel-btn" data-action="close">Cancel</button>
            <button class="move-btn" data-action="move" ${moveDisabled}>Move here</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTree() {
    const isCurrent = this._currentFolderId === null;
    const isSelected = this._selected === '';

    const rootClasses = [
      'root-row',
      isSelected ? 'selected' : '',
      isCurrent ? 'current-folder' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${rootClasses}" data-action="select" data-folder-id="">
        ${icon('folder-open', 16)}
        <span style="margin-left:6px;flex:1">Root (no folder)</span>
        ${isCurrent ? '<span class="current-label">(current)</span>' : ''}
      </div>
      <div class="divider"></div>
      ${this._renderFolderRows(null, 0)}
    `;
  }

  _renderFolderRows(parentId, depth) {
    const key = parentId ?? 'root';
    const folders = this._folderMap[key] || [];

    return folders.map(f => {
      const isCurrent = f.id === this._currentFolderId;
      const isSelected = this._selected === f.id;
      const isExpanded = this._expanded.has(f.id);
      const hasChildren = f.child_count > 0;
      const indentLeft = 12 + depth * 20;

      const rowClasses = [
        'folder-row',
        isSelected ? 'selected' : '',
        isCurrent ? 'current-folder' : '',
      ].filter(Boolean).join(' ');

      const chevron = hasChildren
        ? `<span class="chevron-slot clickable" data-action="toggle-expand" data-folder-id="${f.id}">
             ${isExpanded ? icon('chevron-down', 11) : icon('chevron-right', 11)}
           </span>`
        : `<span class="chevron-slot"></span>`;

      const children = (isExpanded && this._folderMap[f.id])
        ? this._renderFolderRows(f.id, depth + 1)
        : '';

      return `
        <div class="${rowClasses}"
             data-action="select"
             data-folder-id="${f.id}"
             style="padding-left:${indentLeft}px">
          ${chevron}
          <span class="folder-icon">${icon('folder', 14)}</span>
          <span class="folder-name">${this._esc(f.name)}</span>
          ${isCurrent ? '<span class="current-label">(current)</span>' : ''}
        </div>
        ${children}
      `;
    }).join('');
  }

  // ── Event handling ────────────────────────────────────────────────────────

  async _handleClick(e) {
    // Dismiss when clicking the backdrop (the overlay itself, not the dialog)
    if (!e.target.closest('.dialog')) {
      this._close();
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const { action, folderId } = actionEl.dataset;

    if (action === 'close') {
      this._close();
      return;
    }

    if (action === 'toggle-expand') {
      e.stopPropagation();
      await this._toggleExpand(folderId);
      return;
    }

    if (action === 'select') {
      // folderId is '' for root, uuid for folder, skip if current folder
      const id = folderId;   // '' or uuid string
      const isCurrent = id === '' ? this._currentFolderId === null : id === this._currentFolderId;
      if (isCurrent) return;
      this._selected = id;
      this.render();
      return;
    }

    if (action === 'move') {
      if (this._selected === null) return;
      try {
        // Import lazily to avoid circular dep at module level
        const { updateDocument } = await import('../services/documents-api.js');
        await updateDocument(this._documentId, {
          folder_id: this._selected || null,
        });
        const movedFolderId = this._selected || null;
        this._close();
        this.dispatchEvent(new CustomEvent('document-moved', {
          bubbles: true, composed: true,
          detail: { documentId: this._documentId, folderId: movedFolderId },
        }));
      } catch {
        alert('Failed to move document. Please try again.');
      }
    }
  }

  async _toggleExpand(folderId) {
    if (this._expanded.has(folderId)) {
      this._expanded.delete(folderId);
    } else {
      this._expanded.add(folderId);
      await this._loadFolders(folderId);
    }
    this.render();
  }

  _close() {
    this._open = false;
    this.render();
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosFolderPicker);
