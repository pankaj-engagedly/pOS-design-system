// pos-folder-sidebar — Sidebar for notes: smart views + user folders
// Composes: pos-sidebar (shell + scroll + footer)
// Dispatches: folder-select, folder-create, folder-delete, folder-rename

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-sidebar.js';

const notesSheet = new CSSStyleSheet();
notesSheet.replaceSync(`
  .new-folder-btn {
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
  .new-folder-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .new-folder-input {
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
  { id: 'all',    label: 'All Notes', iconName: 'layers' },
  { id: 'pinned', label: 'Favourites', iconName: 'star' },
  { id: 'trash',  label: 'Trash',     iconName: 'trash' },
];

class PosFolderSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, notesSheet];
    this._folders = [];
    this._selectedFolderId = null;
    this._selectedView = 'all';
    this._editingFolderId = null;
    this._showNewInput = false;
    this._counts = {}; // { all: N, pinned: N, trash: N }
  }

  set folders(val) {
    this._folders = val || [];
    this.render();
  }

  set selectedFolderId(val) {
    this._selectedFolderId = val;
    this._selectedView = null;
    this.render();
  }

  set selectedView(val) {
    this._selectedView = val;
    this._selectedFolderId = null;
    this.render();
  }

  set counts(val) { this._counts = val || {}; this.render(); }

  connectedCallback() {
    this._bindShadowEvents();
    this.render();
  }

  _bindShadowEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Action buttons — handle before nav-item so clicks don't also select
      const action = e.target.closest('[data-action]');
      if (action) {
        e.stopPropagation();
        const folderId = action.dataset.folderId;
        const act = action.dataset.action;
        if (act === 'delete-folder' && folderId) {
          this._dispatch('folder-delete', { folderId });
        } else if (act === 'rename-folder' && folderId) {
          this._editingFolderId = folderId;
          this.render();
          requestAnimationFrame(() => {
            this.shadow.querySelector('.rename-input')?.select();
          });
        } else if (act === 'new-folder') {
          this._showNewInput = true;
          this.render();
          requestAnimationFrame(() => {
            this.shadow.querySelector('.new-folder-input')?.focus();
          });
        }
        return;
      }

      const view = e.target.closest('[data-view]');
      if (view) {
        this._dispatch('folder-select', { view: view.dataset.view });
        return;
      }

      const folder = e.target.closest('[data-folder-id]');
      if (folder) {
        if (this._editingFolderId === folder.dataset.folderId) return;
        this._dispatch('folder-select', { folderId: folder.dataset.folderId });
        return;
      }
    });

    this.shadow.addEventListener('dblclick', (e) => {
      const folder = e.target.closest('[data-folder-id]');
      if (folder) {
        this._editingFolderId = folder.dataset.folderId;
        this.render();
        requestAnimationFrame(() => {
          this.shadow.querySelector('.rename-input')?.select();
        });
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('rename-input')) {
        if (e.key === 'Enter') {
          const newName = e.target.value.trim();
          if (newName) {
            this._dispatch('folder-rename', {
              folderId: this._editingFolderId,
              name: newName,
            });
          }
          this._editingFolderId = null;
          this.render();
        } else if (e.key === 'Escape') {
          this._editingFolderId = null;
          this.render();
        }
      }

      if (e.target.classList.contains('new-folder-input')) {
        if (e.key === 'Enter') {
          const name = e.target.value.trim();
          if (name) this._dispatch('folder-create', { name });
          this._showNewInput = false;
          this.render();
        } else if (e.key === 'Escape') {
          this._showNewInput = false;
          this.render();
        }
      }
    });

    this.shadow.addEventListener('blur', (e) => {
      if (e.target.classList.contains('rename-input')) {
        this._editingFolderId = null;
        this.render();
      }
      if (e.target.classList.contains('new-folder-input')) {
        this._showNewInput = false;
        this.render();
      }
    }, true);
  }

  _dispatch(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _renderFolderItem(f) {
    if (this._editingFolderId === f.id) {
      return `<div class="rename-wrap">
        <input class="rename-input" value="${this._escAttr(f.name)}" />
      </div>`;
    }
    return `<div class="nav-item ${this._selectedFolderId === f.id ? 'active' : ''}"
                data-folder-id="${f.id}">
        ${icon('folder', 15)}
        <span class="nav-label">${this._esc(f.name)}</span>
        ${f.note_count > 0 ? `<span class="nav-count">${f.note_count}</span>` : ''}
        <div class="nav-actions">
          <button class="nav-action-btn" data-action="rename-folder" data-folder-id="${f.id}" title="Rename">
            ${icon('edit', 13)}
          </button>
          <button class="nav-action-btn delete" data-action="delete-folder" data-folder-id="${f.id}" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>`;
  }

  render() {
    this.shadow.innerHTML = `
      <pos-sidebar title="Notes">

        ${SMART_VIEWS.map(v => {
          const count = this._counts[v.id] || 0;
          return `
          <div class="nav-item ${this._selectedView === v.id ? 'active' : ''}"
               data-view="${v.id}">
            ${icon(v.iconName, 15)}
            <span class="nav-label">${v.label}</span>
            ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
          </div>`;
        }).join('')}

        ${this._folders.length > 0 ? `
          <div class="divider"></div>
          <div class="section-label">Folders</div>
          ${this._folders.map(f => this._renderFolderItem(f)).join('')}
        ` : ''}

        <div slot="footer">
          ${this._showNewInput
            ? `<input class="new-folder-input" placeholder="Folder name\u2026" />`
            : `<button class="new-folder-btn" data-action="new-folder">
                 ${icon('plus', 13)} New Folder
               </button>`
          }
        </div>

      </pos-sidebar>
    `;

    if (this._showNewInput) {
      requestAnimationFrame(() => {
        this.shadow.querySelector('.new-folder-input')?.focus();
      });
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

customElements.define('pos-folder-sidebar', PosFolderSidebar);
