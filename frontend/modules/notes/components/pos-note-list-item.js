// pos-note-list-item — Compact row for list view
// Dispatches: note-select, note-pin, note-delete

import { icon } from '../../../shared/utils/icons.js';

function relativeDate(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const COLOR_MAP = {
  yellow: '#fef9c3',
  red: '#fee2e2',
  green: '#dcfce7',
  blue: '#dbeafe',
  purple: '#ede9fe',
  pink: '#fce7f3',
  orange: '#ffedd5',
};

const listItemSheet = new CSSStyleSheet();
listItemSheet.replaceSync(`
  :host { display: block; }
  .item {
    position: relative;
    display: flex;
    align-items: stretch;
    cursor: pointer;
    border-radius: 8px;
    margin: 2px 0;
    overflow: hidden;
    border: 1px solid transparent;
    transition: background 0.1s;
  }
  .item:hover { background: var(--pos-color-background-secondary, #f5f5f5); }
  .item.active {
    background: color-mix(in srgb, var(--pos-color-action-primary) 8%, transparent);
    border-color: color-mix(in srgb, var(--pos-color-action-primary) 25%, transparent);
  }
  .color-stripe {
    width: 4px;
    flex-shrink: 0;
  }
  .content {
    flex: 1;
    padding: 8px 12px;
    min-width: 0;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
  }
  .title {
    font-size: var(--pos-font-size-sm, 13px);
    font-weight: 500;
    color: var(--pos-color-text-primary, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .fav-icon {
    flex-shrink: 0;
    color: var(--pos-color-action-primary, #1a73e8);
    display: flex;
  }
  .preview {
    font-size: var(--pos-font-size-xs, 11px);
    color: var(--pos-color-text-secondary, #777);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }
  .meta {
    font-size: 10px;
    color: var(--pos-color-text-muted, #aaa);
  }

  /* Hover actions */
  .actions {
    display: none;
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    align-items: center;
    gap: 2px;
    background: inherit;
    border-radius: var(--pos-radius-sm, 4px);
    padding: 2px;
  }
  .item:hover .actions { display: flex; }
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: var(--pos-radius-sm, 4px);
    background: transparent;
    color: var(--pos-color-text-secondary, #777);
    cursor: pointer;
    padding: 0;
  }
  .action-btn:hover {
    background: var(--pos-color-border-default, #e5e5e5);
    color: var(--pos-color-text-primary, #333);
  }
  .action-btn.delete:hover {
    color: var(--pos-color-priority-urgent, #dc2626);
  }
  .action-btn svg { pointer-events: none; }
`);

class PosNoteListItem extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [listItemSheet];
    this._note = null;
    this._active = false;
  }

  set note(val) {
    this._note = val;
    this._render();
  }

  set active(val) {
    this._active = val;
    this._render();
  }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        if (action === 'favourite') {
          this.dispatchEvent(new CustomEvent('note-pin', {
            bubbles: true, composed: true,
            detail: { noteId: this._note.id, is_pinned: !this._note.is_pinned },
          }));
        } else if (action === 'delete') {
          this.dispatchEvent(new CustomEvent('note-delete', {
            bubbles: true, composed: true,
            detail: { noteId: this._note.id },
          }));
        }
        return;
      }
      if (this._note) {
        this.dispatchEvent(new CustomEvent('note-select', {
          bubbles: true, composed: true,
          detail: { noteId: this._note.id },
        }));
      }
    });
  }

  _render() {
    const note = this._note;
    if (!note) { this.shadow.innerHTML = ''; return; }

    const colorBg = note.color ? COLOR_MAP[note.color] || 'transparent' : 'transparent';
    const date = relativeDate(note.updated_at);

    this.shadow.innerHTML = `
      <div class="item ${this._active ? 'active' : ''}">
        <div class="color-stripe" style="background:${colorBg}"></div>
        <div class="content">
          <div class="title-row">
            <span class="title">${note.title || 'Untitled'}</span>
            ${note.is_pinned ? `<span class="fav-icon">${icon('star', 11)}</span>` : ''}
          </div>
          <div class="preview">${note.preview_text || 'No content'}</div>
          <div class="meta">${date}</div>
        </div>
        <div class="actions">
          <button class="action-btn" data-action="favourite" title="${note.is_pinned ? 'Unfavourite' : 'Favourite'}">
            ${icon('star', 13)}
          </button>
          <button class="action-btn delete" data-action="delete" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('pos-note-list-item', PosNoteListItem);
