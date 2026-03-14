// pos-folder-sidebar — Sidebar for notes: smart views + user folders
// Dispatches: folder-select, folder-create, folder-delete, folder-rename

class PosFolderSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._folders = [];
    this._selectedFolderId = null;
    this._selectedView = 'all';
    this._editingFolderId = null;
    this._showNewInput = false;
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

  connectedCallback() {
    this._bindShadowEvents();
    this.render();
  }

  _bindShadowEvents() {
    this.shadow.addEventListener('click', (e) => {
      const view = e.target.closest('[data-view]');
      if (view) {
        this._dispatch('folder-select', { view: view.dataset.view });
        return;
      }

      const folder = e.target.closest('[data-folder-id]');
      if (folder && !e.target.closest('[data-action]')) {
        if (this._editingFolderId === folder.dataset.folderId) return;
        this._dispatch('folder-select', { folderId: folder.dataset.folderId });
        return;
      }

      const action = e.target.closest('[data-action]');
      if (action) {
        const folderId = action.closest('[data-folder-id]')?.dataset.folderId;
        const act = action.dataset.action;
        if (act === 'delete-folder' && folderId) {
          this._dispatch('folder-delete', { folderId });
        } else if (act === 'new-folder') {
          this._showNewInput = true;
          this.render();
          requestAnimationFrame(() => {
            this.shadow.querySelector('.new-folder-input')?.focus();
          });
        }
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

  render() {
    const smartViews = [
      { id: 'all', label: 'All Notes', icon: '📋' },
      { id: 'pinned', label: 'Pinned', icon: '📌' },
      { id: 'trash', label: 'Trash', icon: '🗑️' },
    ];

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 8px 0;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--pos-color-text-muted, #888);
          padding: 8px 16px 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px;
          cursor: pointer;
          border-radius: 6px;
          margin: 1px 8px;
          font-size: 14px;
          color: var(--pos-color-text-primary, #1a1a1a);
          user-select: none;
        }

        .nav-item:hover {
          background: var(--pos-color-surface-hover, #f0f0f0);
        }

        .nav-item.active {
          background: var(--pos-color-primary-100, #e8f0fe);
          color: var(--pos-color-primary-600, #1a73e8);
          font-weight: 500;
        }

        .nav-item .icon { width: 18px; text-align: center; font-style: normal; }
        .nav-item .label { flex: 1; }
        .nav-item .count {
          font-size: 12px;
          color: var(--pos-color-text-muted, #888);
          background: var(--pos-color-surface-alt, #f5f5f5);
          border-radius: 10px;
          padding: 1px 6px;
          min-width: 20px;
          text-align: center;
        }

        .nav-item .delete-btn {
          opacity: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          color: var(--pos-color-text-muted, #888);
          font-size: 14px;
          line-height: 1;
        }

        .nav-item:hover .delete-btn { opacity: 1; }
        .nav-item .delete-btn:hover {
          background: var(--pos-color-danger-100, #fee);
          color: var(--pos-color-danger-600, #e53e3e);
        }

        .rename-input, .new-folder-input {
          flex: 1;
          border: 1px solid var(--pos-color-primary-400, #4f8ef7);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 14px;
          outline: none;
          background: var(--pos-color-surface, #fff);
        }

        .new-folder-wrap {
          padding: 4px 8px;
        }

        .new-folder-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          cursor: pointer;
          color: var(--pos-color-text-muted, #888);
          font-size: 13px;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          margin-top: auto;
        }

        .new-folder-btn:hover { color: var(--pos-color-primary-600, #1a73e8); }

        .divider {
          height: 1px;
          background: var(--pos-color-border, #e5e5e5);
          margin: 8px 16px;
        }

        .spacer { flex: 1; }
      </style>

      <div class="section-label">Views</div>
      ${smartViews.map(v => `
        <div class="nav-item ${this._selectedView === v.id ? 'active' : ''}"
             data-view="${v.id}">
          <span class="icon">${v.icon}</span>
          <span class="label">${v.label}</span>
        </div>
      `).join('')}

      ${this._folders.length > 0 ? `
        <div class="divider"></div>
        <div class="section-label">Folders</div>
        ${this._folders.map(f => `
          <div class="nav-item ${this._selectedFolderId === f.id ? 'active' : ''}"
               data-folder-id="${f.id}">
            <span class="icon">📁</span>
            ${this._editingFolderId === f.id
              ? `<input class="rename-input" value="${f.name}" />`
              : `<span class="label">${f.name}</span>`
            }
            ${f.note_count > 0
              ? `<span class="count">${f.note_count}</span>`
              : ''
            }
            <button class="delete-btn" data-action="delete-folder" title="Delete folder">✕</button>
          </div>
        `).join('')}
      ` : ''}

      <div class="spacer"></div>
      <div class="divider"></div>

      ${this._showNewInput ? `
        <div class="new-folder-wrap">
          <input class="new-folder-input" placeholder="Folder name..." />
        </div>
      ` : `
        <button class="new-folder-btn" data-action="new-folder">
          ＋ New Folder
        </button>
      `}
    `;
  }
}

customElements.define('pos-folder-sidebar', PosFolderSidebar);
