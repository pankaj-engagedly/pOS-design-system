// pos-note-list — Note list/grid container with toolbar
// Composes: pos-note-list-item, pos-note-card
// Dispatches: note-select, note-create, search-change, view-mode-change

import { icon } from '../../../shared/utils/icons.js';
import './pos-note-list-item.js';
import './pos-note-card.js';

const listSheet = new CSSStyleSheet();
listSheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Header row */
  .header {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-md) var(--pos-space-md) var(--pos-space-sm);
    flex-shrink: 0;
  }
  .header-title {
    font-size: var(--pos-font-size-lg);
    font-weight: var(--pos-font-weight-bold);
    color: var(--pos-color-text-primary);
    margin: 0;
    flex: 1;
  }
  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    font-family: inherit;
  }
  .header-btn:hover { background: var(--pos-color-background-secondary); }
  .header-btn.active {
    background: var(--pos-color-action-primary);
    color: #fff;
    border-color: var(--pos-color-action-primary);
  }
  .header-btn svg { pointer-events: none; }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-sm);
    border-bottom: 1px solid var(--pos-color-border-default);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    padding: 6px 10px;
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    outline: none;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
  }
  .search-input:focus {
    border-color: var(--pos-color-action-primary);
    background: var(--pos-color-background-primary);
  }

  .notes-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--pos-space-md);
    padding: 4px;
  }
  .notes-grid pos-note-card {
    display: block;
    min-width: 0;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    gap: 8px;
  }
  .empty-icon {
    display: flex;
    color: var(--pos-color-text-secondary);
    opacity: 0.4;
  }
`);

class PosNoteList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [listSheet];
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
  }

  set selectedNoteId(val) {
    this._selectedNoteId = val;
    this._renderNotes();
  }

  set viewMode(val) {
    this._viewMode = val;
    this._renderNotes();
    this._updateViewButtons();
  }

  set folderName(val) {
    this._folderName = val || 'Notes';
    this._updateTitle();
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this.shadow.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      if (action === 'new-note') {
        this.dispatchEvent(new CustomEvent('note-create', { bubbles: true, composed: true }));
      } else if (action === 'set-view') {
        const view = actionEl.dataset.view;
        if (view !== this._viewMode) {
          this.dispatchEvent(new CustomEvent('view-mode-change', {
            bubbles: true, composed: true, detail: { viewMode: view },
          }));
        }
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

    this.shadow.addEventListener('note-select', (e) => {
      this.dispatchEvent(new CustomEvent('note-select', {
        bubbles: true, composed: true, detail: e.detail,
      }));
    });
  }

  _updateViewButtons() {
    this.shadow.querySelectorAll('[data-action="set-view"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this._viewMode);
    });
  }

  _updateTitle() {
    const el = this.shadow.querySelector('#header-title');
    if (el) el.textContent = this._folderName;
  }

  render() {
    this.shadow.innerHTML = `
      <div class="header">
        <h2 class="header-title" id="header-title">${this._esc(this._folderName)}</h2>
        <button class="header-btn ${this._viewMode === 'list' ? 'active' : ''}" data-action="set-view" data-view="list" title="List view">${icon('list', 14)}</button>
        <button class="header-btn ${this._viewMode === 'grid' ? 'active' : ''}" data-action="set-view" data-view="grid" title="Grid view">${icon('grid', 14)}</button>
        <button class="header-btn" data-action="new-note" title="New Note">${icon('plus', 14)}</button>
      </div>

      <div class="toolbar">
        <input class="search-input" placeholder="Search notes..." value="${this._searchValue}" />
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
          <div class="empty-icon">${icon('file-text', 40)}</div>
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

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-note-list', PosNoteList);
