// pos-note-card — Card for grid view
// Dispatches: note-select, note-pin, note-delete

import { icon } from '../../../shared/utils/icons.js';

function relativeDate(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return 'Today';
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

const cardSheet = new CSSStyleSheet();
cardSheet.replaceSync(`
  :host { display: block; }
  .card {
    position: relative;
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: box-shadow 0.15s, transform 0.1s;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
  .header {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .title {
    flex: 1;
    font-size: var(--pos-font-size-sm, 13px);
    font-weight: 600;
    color: var(--pos-color-text-primary, #1a1a1a);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .fav-icon {
    flex-shrink: 0;
    color: var(--pos-color-action-primary, #1a73e8);
    display: flex;
  }
  .preview {
    font-size: var(--pos-font-size-xs, 11px);
    color: var(--pos-color-text-secondary, #555);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: auto;
  }
  .tag {
    font-size: 10px;
    background: rgba(0,0,0,0.08);
    border-radius: 10px;
    padding: 1px 6px;
    color: var(--pos-color-text-secondary, #555);
  }
  .date {
    font-size: 10px;
    color: var(--pos-color-text-muted, #aaa);
    margin-left: auto;
  }

  /* Hover actions */
  .actions {
    display: none;
    position: absolute;
    top: 6px;
    right: 6px;
    align-items: center;
    gap: 2px;
    background: inherit;
    border-radius: var(--pos-radius-sm, 4px);
    padding: 2px;
  }
  .card:hover .actions { display: flex; }
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--pos-radius-sm, 4px);
    background: transparent;
    color: var(--pos-color-text-secondary, #777);
    cursor: pointer;
    padding: 0;
  }
  .action-btn:hover {
    background: rgba(0,0,0,0.08);
    color: var(--pos-color-text-primary, #333);
  }
  .action-btn.delete:hover {
    color: var(--pos-color-priority-urgent, #dc2626);
  }
  .action-btn svg { pointer-events: none; }
`);

class PosNoteCard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [cardSheet];
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

    const bgColor = note.color ? (COLOR_MAP[note.color] || '#fff') : 'var(--pos-color-background-primary, #fff)';
    const borderColor = this._active ? 'var(--pos-color-action-primary, #4f8ef7)' : 'var(--pos-color-border-default, #e5e5e5)';
    const tags = (note.tags || []).slice(0, 3);
    const date = relativeDate(note.updated_at);

    this.shadow.innerHTML = `
      <div class="card" style="background:${bgColor};border:1px solid ${borderColor};${this._active ? 'box-shadow:0 0 0 2px color-mix(in srgb, var(--pos-color-action-primary) 30%, transparent)' : ''}">
        <div class="actions">
          <button class="action-btn" data-action="favourite" title="${note.is_pinned ? 'Unfavourite' : 'Favourite'}">
            ${icon('star', 13)}
          </button>
          <button class="action-btn delete" data-action="delete" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
        <div class="header">
          <span class="title">${note.title || 'Untitled'}</span>
          ${note.is_pinned ? `<span class="fav-icon">${icon('star', 12)}</span>` : ''}
        </div>
        ${note.preview_text ? `<div class="preview">${note.preview_text}</div>` : ''}
        <div class="footer">
          ${tags.map(t => `<span class="tag">${t.name}</span>`).join('')}
          <span class="date">${date}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('pos-note-card', PosNoteCard);
