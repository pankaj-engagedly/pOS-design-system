// pos-note-card — Card for grid view
// Dispatches: note-select

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

class PosNoteCard extends HTMLElement {
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

    const bgColor = note.color ? (COLOR_MAP[note.color] || '#fff') : 'var(--pos-color-surface, #fff)';
    const tags = (note.tags || []).slice(0, 3);
    const date = relativeDate(note.updated_at);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          background: ${bgColor};
          border: 1px solid ${this._active ? 'var(--pos-color-primary-400, #4f8ef7)' : 'var(--pos-color-border, #e5e5e5)'};
          border-radius: 10px;
          padding: 14px;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.1s;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: ${this._active ? '0 0 0 2px var(--pos-color-primary-300, #93b4fb)' : 'none'};
        }
        .card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transform: translateY(-1px);
        }
        .header {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .title {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: var(--pos-color-text-primary, #1a1a1a);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .pin { font-size: 12px; flex-shrink: 0; }
        .preview {
          font-size: 12px;
          color: var(--pos-color-text-secondary, #555);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 4;
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
          padding: 2px 7px;
          color: var(--pos-color-text-secondary, #555);
        }
        .date {
          font-size: 11px;
          color: var(--pos-color-text-muted, #aaa);
          margin-left: auto;
        }
      </style>
      <div class="card">
        <div class="header">
          <span class="title">${note.title || 'Untitled'}</span>
          ${note.is_pinned ? '<span class="pin">📌</span>' : ''}
        </div>
        ${note.preview_text
          ? `<div class="preview">${note.preview_text}</div>`
          : ''
        }
        <div class="footer">
          ${tags.map(t => `<span class="tag">${t.name}</span>`).join('')}
          <span class="date">${date}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('pos-note-card', PosNoteCard);
