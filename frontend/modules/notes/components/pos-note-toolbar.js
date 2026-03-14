// pos-note-toolbar — Rich text formatting toolbar
// Dispatches: toolbar-action { action, attrs }

class PosNoteToolbar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._activeFormats = new Set();
    this._showHeadings = false;
    this._eventsBound = false;
  }

  set activeFormats(val) {
    this._activeFormats = new Set(val || []);
    this._updateActiveButtons();
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this.shadow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const attrs = btn.dataset.attrs ? JSON.parse(btn.dataset.attrs) : undefined;

      if (action === 'toggleHeadings') {
        this._showHeadings = !this._showHeadings;
        this._renderHeadingMenu();
        return;
      }

      this._showHeadings = false;
      this._renderHeadingMenu();
      this.dispatchEvent(new CustomEvent('toolbar-action', {
        bubbles: true,
        composed: true,
        detail: { action, attrs },
      }));
    });
  }

  _updateActiveButtons() {
    this.shadow.querySelectorAll('.btn[data-format]').forEach(btn => {
      btn.classList.toggle('active', this._activeFormats.has(btn.dataset.format));
    });
    // Also update heading menu items if visible
    this.shadow.querySelectorAll('.heading-item[data-format]').forEach(btn => {
      btn.classList.toggle('active', this._activeFormats.has(btn.dataset.format));
    });
  }

  _renderHeadingMenu() {
    const existing = this.shadow.querySelector('.heading-menu');
    if (this._showHeadings) {
      if (existing) return; // already shown
      const menu = document.createElement('div');
      menu.className = 'heading-menu';
      menu.innerHTML = `
        <button class="heading-item h1 ${this._activeFormats.has('heading-1') ? 'active' : ''}"
                data-action="toggleHeading" data-attrs='{"level":1}' data-format="heading-1">H1 Heading</button>
        <button class="heading-item h2 ${this._activeFormats.has('heading-2') ? 'active' : ''}"
                data-action="toggleHeading" data-attrs='{"level":2}' data-format="heading-2">H2 Heading</button>
        <button class="heading-item h3 ${this._activeFormats.has('heading-3') ? 'active' : ''}"
                data-action="toggleHeading" data-attrs='{"level":3}' data-format="heading-3">H3 Heading</button>
        <button class="heading-item ${this._activeFormats.has('paragraph') ? 'active' : ''}"
                data-action="setParagraph" data-format="paragraph">Normal text</button>
      `;
      this.shadow.appendChild(menu);
    } else {
      existing?.remove();
    }
  }

  render() {
    const groups = [
      [
        { action: 'toggleHeadings', label: 'H', title: 'Heading' },
      ],
      [
        { action: 'toggleBold', label: '<b>B</b>', title: 'Bold', format: 'bold' },
        { action: 'toggleItalic', label: '<i>I</i>', title: 'Italic', format: 'italic' },
        { action: 'toggleStrike', label: '<s>S</s>', title: 'Strikethrough', format: 'strike' },
        { action: 'toggleCode', label: '`', title: 'Inline Code', format: 'code' },
      ],
      [
        { action: 'toggleBulletList', label: '•≡', title: 'Bullet List', format: 'bulletList' },
        { action: 'toggleOrderedList', label: '1≡', title: 'Ordered List', format: 'orderedList' },
        { action: 'toggleBlockquote', label: '❝', title: 'Blockquote', format: 'blockquote' },
        { action: 'toggleCodeBlock', label: '⌨', title: 'Code Block', format: 'codeBlock' },
      ],
      [
        { action: 'setHorizontalRule', label: '—', title: 'Horizontal Rule' },
        { action: 'toggleLink', label: '🔗', title: 'Link' },
      ],
    ];

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 8px;
          border-bottom: 1px solid var(--pos-color-border, #e5e5e5);
          flex-wrap: wrap;
          flex-shrink: 0;
          background: var(--pos-color-surface-alt, #fafafa);
          position: relative;
        }

        .group {
          display: flex;
          align-items: center;
          gap: 1px;
          padding: 0 3px;
          border-right: 1px solid var(--pos-color-border, #e5e5e5);
        }
        .group:last-child { border-right: none; }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 26px;
          border: none;
          border-radius: 5px;
          background: none;
          cursor: pointer;
          font-size: 13px;
          color: var(--pos-color-text-secondary, #555);
          position: relative;
        }
        .btn:hover { background: var(--pos-color-surface-hover, #ebebeb); }
        .btn.active {
          background: var(--pos-color-primary-100, #e8f0fe);
          color: var(--pos-color-primary-700, #1557b0);
        }

        .heading-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 8px;
          background: var(--pos-color-surface, #fff);
          border: 1px solid var(--pos-color-border, #e5e5e5);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 100;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 120px;
        }

        .heading-item {
          display: flex;
          align-items: center;
          padding: 6px 12px;
          cursor: pointer;
          border-radius: 5px;
          font-size: 13px;
          color: var(--pos-color-text-primary, #1a1a1a);
          border: none;
          background: none;
          text-align: left;
        }
        .heading-item:hover { background: var(--pos-color-surface-hover, #f5f5f5); }
        .heading-item.active { color: var(--pos-color-primary-600, #1a73e8); font-weight: 600; }
        .h1 { font-size: 16px; font-weight: 700; }
        .h2 { font-size: 15px; font-weight: 600; }
        .h3 { font-size: 14px; font-weight: 600; }
      </style>

      ${groups.map(group => `
        <div class="group">
          ${group.map(btn => `
            <button
              class="btn ${btn.format && this._activeFormats.has(btn.format) ? 'active' : ''}"
              data-action="${btn.action}"
              ${btn.format ? `data-format="${btn.format}"` : ''}
              ${btn.attrs ? `data-attrs='${JSON.stringify(btn.attrs)}'` : ''}
              title="${btn.title}"
            >${btn.label}</button>
          `).join('')}
        </div>
      `).join('')}
    `;

    this._eventsBound = false;
    this._bindEvents();
  }
}

customElements.define('pos-note-toolbar', PosNoteToolbar);
