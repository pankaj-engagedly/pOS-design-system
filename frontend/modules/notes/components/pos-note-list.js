// pos-note-list — Note list/grid container with toolbar
// Composes: pos-note-list-item, pos-note-card
// Dispatches: note-select, note-create, search-change, view-mode-change

import './pos-note-list-item.js';
import './pos-note-card.js';
import '../../../shared/components/pos-page-header.js';

class PosNoteList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._notes = [];
    this._selectedNoteId = null;
    this._viewMode = 'list';
    this._searchValue = '';
    this._searchTimer = null;
    this._eventsBound = false;
    this._folderName = 'Notes';
  }

  set notes(val) {
    this._notes = val || [];
    this._renderNotes();
    this._updateHeader();
  }

  set selectedNoteId(val) {
    this._selectedNoteId = val;
    this._renderNotes();
  }

  set viewMode(val) {
    this._viewMode = val;
    this._renderNotes();
    this._updateToolbar();
  }

  set folderName(val) {
    this._folderName = val || 'Notes';
    this._updateHeader();
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this.shadow.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'new-note') {
        this.dispatchEvent(new CustomEvent('note-create', { bubbles: true, composed: true }));
      } else if (action === 'toggle-grid') {
        const newMode = this._viewMode === 'grid' ? 'list' : 'grid';
        this.dispatchEvent(new CustomEvent('view-mode-change', {
          bubbles: true, composed: true, detail: { viewMode: newMode },
        }));
      }
    });

    this.shadow.addEventListener('input', (e) => {
      if (e.target.classList.contains('search-input')) {
        this._searchValue = e.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.dispatchEvent(new CustomEvent('search-change', {
            bubbles: true, composed: true, detail: { query: this._searchValue },
          }));
        }, 300);
      }
    });

    // Note selection events bubble up from child components
    this.shadow.addEventListener('note-select', (e) => {
      this.dispatchEvent(new CustomEvent('note-select', {
        bubbles: true, composed: true, detail: e.detail,
      }));
    });
  }

  _updateToolbar() {
    const btn = this.shadow.querySelector('[data-action="toggle-grid"]');
    if (btn) btn.textContent = this._viewMode === 'grid' ? '☰' : '⊞';
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--pos-color-border, #e5e5e5);
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          border: 1px solid var(--pos-color-border, #e0e0e0);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          outline: none;
          background: var(--pos-color-surface-alt, #f9f9f9);
        }
        .search-input:focus {
          border-color: var(--pos-color-primary-400, #4f8ef7);
          background: #fff;
        }

        .toolbar-btn {
          border: 1px solid var(--pos-color-border, #e0e0e0);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          background: var(--pos-color-surface, #fff);
          font-size: 16px;
          line-height: 1;
          color: var(--pos-color-text-secondary, #555);
        }
        .toolbar-btn:hover {
          background: var(--pos-color-surface-hover, #f0f0f0);
        }

        .new-note-btn {
          border: none;
          border-radius: 6px;
          padding: 7px 14px;
          cursor: pointer;
          background: var(--pos-color-primary-600, #1a73e8);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
        }
        .new-note-btn:hover {
          background: var(--pos-color-primary-700, #1557b0);
        }

        .notes-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
          padding: 4px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--pos-color-text-muted, #aaa);
          font-size: 14px;
          gap: 8px;
        }

        .empty-icon { font-size: 40px; }
      </style>

      <pos-page-header id="page-header">
        ${this._esc(this._folderName)}
        <span slot="subtitle">${this._notes.length} note${this._notes.length !== 1 ? 's' : ''}</span>
      </pos-page-header>

      <div class="toolbar">
        <input class="search-input" placeholder="Search notes..." value="${this._searchValue}" />
        <button class="toolbar-btn" data-action="toggle-grid" title="Toggle view">
          ${this._viewMode === 'grid' ? '☰' : '⊞'}
        </button>
        <button class="new-note-btn" data-action="new-note">＋ New Note</button>
      </div>

      <div class="notes-container">
        ${this._renderNotesHTML()}
      </div>
    `;

  }

  _renderNotesHTML() {
    if (this._notes.length === 0) {
      return `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <span>No notes yet</span>
        </div>
      `;
    }

    if (this._viewMode === 'grid') {
      return `<div class="notes-grid" id="notes-grid"></div>`;
    }
    return `<div id="notes-list"></div>`;
  }

  _renderNotes() {
    const container = this.shadow.querySelector('#notes-list, #notes-grid');
    if (!container) {
      // Need full re-render (switching view modes)
      this.render();
      return;
    }

    if (this._viewMode === 'grid') {
      container.innerHTML = '';
      this._notes.forEach(note => {
        const card = document.createElement('pos-note-card');
        card.note = note;
        card.active = note.id === this._selectedNoteId;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = '';
      this._notes.forEach(note => {
        const item = document.createElement('pos-note-list-item');
        item.note = note;
        item.active = note.id === this._selectedNoteId;
        container.appendChild(item);
      });
    }
  }

  _updateHeader() {
    const header = this.shadow.querySelector('#page-header');
    if (!header) return;
    header.innerHTML = `
      ${this._esc(this._folderName)}
      <span slot="subtitle">${this._notes.length} note${this._notes.length !== 1 ? 's' : ''}</span>
    `;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-note-list', PosNoteList);
