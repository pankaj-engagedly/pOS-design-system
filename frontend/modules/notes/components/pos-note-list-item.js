// pos-note-list-item — Compact row for list view
// Dispatches: note-select

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

class PosNoteListItem extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._note = null;
    this._active = false;
  }

  set note(val) {
    this._note = val;
    this.render();
  }

  set active(val) {
    this._active = val;
    this.render();
  }

  connectedCallback() {
    this.shadow.addEventListener('click', () => {
      if (this._note) {
        this.dispatchEvent(new CustomEvent('note-select', {
          bubbles: true,
          composed: true,
          detail: { noteId: this._note.id },
        }));
      }
    });
    this.render();
  }

  render() {
    const note = this._note;
    if (!note) { this.shadow.innerHTML = ''; return; }

    const colorBg = note.color ? COLOR_MAP[note.color] || '#fff' : 'transparent';
    const date = relativeDate(note.updated_at);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .item {
          display: flex;
          align-items: stretch;
          cursor: pointer;
          border-radius: 8px;
          margin: 2px 0;
          overflow: hidden;
          border: 1px solid transparent;
          transition: background 0.1s;
        }
        .item:hover { background: var(--pos-color-surface-hover, #f5f5f5); }
        .item.active {
          background: var(--pos-color-primary-50, #f0f4ff);
          border-color: var(--pos-color-primary-200, #c7d7fd);
        }
        .color-stripe {
          width: 4px;
          flex-shrink: 0;
          background: ${colorBg !== 'transparent' ? colorBg : 'transparent'};
        }
        .content {
          flex: 1;
          padding: 10px 12px;
          min-width: 0;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }
        .title {
          font-size: 14px;
          font-weight: 500;
          color: var(--pos-color-text-primary, #1a1a1a);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .pin { font-size: 12px; flex-shrink: 0; }
        .preview {
          font-size: 12px;
          color: var(--pos-color-text-muted, #777);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        .meta {
          font-size: 11px;
          color: var(--pos-color-text-muted, #aaa);
        }
      </style>
      <div class="item ${this._active ? 'active' : ''}">
        <div class="color-stripe"></div>
        <div class="content">
          <div class="title-row">
            <span class="title">${note.title || 'Untitled'}</span>
            ${note.is_pinned ? '<span class="pin">📌</span>' : ''}
          </div>
          <div class="preview">${note.preview_text || 'No content'}</div>
          <div class="meta">${date}</div>
        </div>
      </div>
    `;
  }
}

customElements.define('pos-note-list-item', PosNoteListItem);
