// pos-note-editor — Rich text editor wrapping Tiptap
// Composes: pos-note-toolbar
// Dispatches: note-content-change { title, content }, note-title-change { title }

import { Editor, StarterKit, Link, Placeholder } from '../editor.bundle.js';
import './pos-note-toolbar.js';

class PosNoteEditor extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._editor = null;
    this._note = null;
    this._contentTimer = null;
    this._titleTimer = null;
    this._saving = false;
    this._saveStatus = ''; // '', 'saving', 'saved', 'error'
  }

  set note(val) {
    const prevId = this._note?.id;
    this._note = val;
    if (val?.id !== prevId) {
      // Note changed — rebuild DOM then mount fresh editor
      this._editor?.destroy();
      this._editor = null;
      this.render();
      if (val) this._mountEditor();
    } else if (val) {
      // Same note — only refresh tags area (don't destroy editor)
      this._renderTags();
    }
  }

  connectedCallback() {
    this._eventsBound = false;
    this.render();
    this._bindAllEvents();
  }

  disconnectedCallback() {
    this._editor?.destroy();
    this._editor = null;
  }

  _mountEditor() {
    const editorEl = this.shadow.querySelector('.editor-content');
    if (!editorEl || !this._note) return;

    this._editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: 'Start writing...' }),
      ],
      content: this._note.content || '',
      onUpdate: ({ editor }) => {
        this._scheduleContentSave(editor.getJSON());
        this._updateToolbarState(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        this._updateToolbarState(editor);
      },
    });
  }

  _updateToolbarState(editor) {
    const toolbar = this.shadow.querySelector('pos-note-toolbar');
    if (!toolbar) return;

    const active = [];
    if (editor.isActive('bold')) active.push('bold');
    if (editor.isActive('italic')) active.push('italic');
    if (editor.isActive('strike')) active.push('strike');
    if (editor.isActive('code')) active.push('code');
    if (editor.isActive('bulletList')) active.push('bulletList');
    if (editor.isActive('orderedList')) active.push('orderedList');
    if (editor.isActive('blockquote')) active.push('blockquote');
    if (editor.isActive('codeBlock')) active.push('codeBlock');
    if (editor.isActive('heading', { level: 1 })) active.push('heading-1');
    if (editor.isActive('heading', { level: 2 })) active.push('heading-2');
    if (editor.isActive('heading', { level: 3 })) active.push('heading-3');
    if (editor.isActive('paragraph')) active.push('paragraph');
    toolbar.activeFormats = active;
  }

  _scheduleContentSave(content) {
    clearTimeout(this._contentTimer);
    this._contentTimer = setTimeout(() => {
      this._setSaveStatus('saving');
      this.dispatchEvent(new CustomEvent('note-content-change', {
        bubbles: true,
        composed: true,
        detail: { title: this._note?.title || '', content },
      }));
    }, 500);
  }

  _scheduleTitleSave(title) {
    clearTimeout(this._titleTimer);
    this._titleTimer = setTimeout(() => {
      this._setSaveStatus('saving');
      this.dispatchEvent(new CustomEvent('note-title-change', {
        bubbles: true,
        composed: true,
        detail: { title },
      }));
    }, 500);
  }

  setSaveStatus(status) {
    this._setSaveStatus(status);
  }

  _setSaveStatus(status) {
    this._saveStatus = status;
    const indicator = this.shadow.querySelector('.save-status');
    if (indicator) {
      const labels = { saving: 'Saving…', saved: 'Saved', error: 'Error saving' };
      indicator.textContent = labels[status] || '';
      indicator.className = `save-status ${status}`;
    }
  }

  _bindAllEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Toolbar actions
    this.shadow.addEventListener('toolbar-action', (e) => {
      if (!this._editor) return;
      const { action, attrs } = e.detail;
      const chain = this._editor.chain().focus();
      const actionMap = {
        toggleBold: () => chain.toggleBold().run(),
        toggleItalic: () => chain.toggleItalic().run(),
        toggleStrike: () => chain.toggleStrike().run(),
        toggleCode: () => chain.toggleCode().run(),
        toggleBulletList: () => chain.toggleBulletList().run(),
        toggleOrderedList: () => chain.toggleOrderedList().run(),
        toggleBlockquote: () => chain.toggleBlockquote().run(),
        toggleCodeBlock: () => chain.toggleCodeBlock().run(),
        setHorizontalRule: () => chain.setHorizontalRule().run(),
        toggleHeading: () => chain.toggleHeading(attrs).run(),
        setParagraph: () => chain.setParagraph().run(),
        toggleLink: () => {
          const url = prompt('Enter URL:');
          if (url) chain.setLink({ href: url }).run();
          else chain.unsetLink().run();
        },
      };
      actionMap[action]?.();
      this._updateToolbarState(this._editor);
    });

    // Title input
    this.shadow.addEventListener('input', (e) => {
      if (e.target.classList.contains('title-input') && this._note) {
        this._note = { ...this._note, title: e.target.value };
        this._scheduleTitleSave(e.target.value);
      }
    });

    // Tag remove (event delegation — works after any DOM rebuild)
    this.shadow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-tag"]');
      if (btn) {
        this.dispatchEvent(new CustomEvent('tag-remove', {
          bubbles: true, composed: true,
          detail: { tagId: btn.dataset.tagId },
        }));
      }
    });

    // Tag add via input (use delegation to handle DOM rebuilds)
    this.shadow.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('tag-input')) return;
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const name = e.target.value.trim().replace(/,$/, '');
        if (name) {
          this.dispatchEvent(new CustomEvent('tag-add', {
            bubbles: true, composed: true, detail: { name },
          }));
          e.target.value = '';
        }
      }
    });
  }

  _renderTags() {
    const tagsArea = this.shadow.querySelector('.tags-area');
    if (!tagsArea || !this._note) return;
    tagsArea.innerHTML = `
      <span class="tag-label">Tags:</span>
      ${(this._note.tags || []).map(t => `
        <span class="tag-badge" data-tag-id="${t.id}">
          ${t.name}
          <button class="tag-remove" data-action="remove-tag" data-tag-id="${t.id}">✕</button>
        </span>
      `).join('')}
      <input class="tag-input" placeholder="Add tag…" />
    `;
  }

  render() {
    if (!this._note) {
      this.shadow.innerHTML = `
        <style>
          :host { display: flex; align-items: center; justify-content: center; height: 100%; }
          .empty {
            display: flex; flex-direction: column; align-items: center; gap: 12px;
            color: var(--pos-color-text-muted, #aaa); font-size: 15px;
          }
          .empty-icon { font-size: 48px; }
        </style>
        <div class="empty">
          <span class="empty-icon">📝</span>
          <span>Select a note or create a new one</span>
        </div>
      `;
      return;
    }

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--pos-color-surface, #fff);
        }

        .title-bar {
          display: flex;
          align-items: center;
          padding: 12px 20px 8px;
          border-bottom: 1px solid var(--pos-color-border, #e5e5e5);
          flex-shrink: 0;
          gap: 8px;
        }

        .title-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 20px;
          font-weight: 600;
          color: var(--pos-color-text-primary, #1a1a1a);
          background: transparent;
          font-family: inherit;
        }
        .title-input::placeholder { color: var(--pos-color-text-muted, #bbb); }

        .save-status {
          font-size: 11px;
          color: var(--pos-color-text-muted, #aaa);
          white-space: nowrap;
          min-width: 60px;
          text-align: right;
        }
        .save-status.saving { color: var(--pos-color-text-muted, #aaa); }
        .save-status.saved { color: var(--pos-color-success-600, #16a34a); }
        .save-status.error { color: var(--pos-color-danger-600, #dc2626); }

        pos-note-toolbar { flex-shrink: 0; }

        .editor-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .editor-content {
          outline: none;
          min-height: 100%;
          font-size: 15px;
          line-height: 1.7;
          color: var(--pos-color-text-primary, #1a1a1a);
          font-family: inherit;
        }

        /* Tiptap editor styles */
        .editor-content .ProseMirror {
          outline: none;
          min-height: 300px;
        }

        .editor-content .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--pos-color-text-muted, #bbb);
          pointer-events: none;
          float: left;
          height: 0;
        }

        .editor-content h1 { font-size: 1.6em; font-weight: 700; margin: 0.8em 0 0.4em; }
        .editor-content h2 { font-size: 1.3em; font-weight: 600; margin: 0.8em 0 0.4em; }
        .editor-content h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.4em; }
        .editor-content p { margin: 0 0 0.6em; }
        .editor-content ul, .editor-content ol { padding-left: 1.4em; margin: 0.4em 0; }
        .editor-content li { margin: 0.2em 0; }
        .editor-content code {
          background: var(--pos-color-surface-alt, #f5f5f5);
          border-radius: 3px;
          padding: 1px 4px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .editor-content pre {
          background: var(--pos-color-surface-alt, #f5f5f5);
          border-radius: 6px;
          padding: 12px 16px;
          overflow-x: auto;
          margin: 0.6em 0;
        }
        .editor-content pre code { background: none; padding: 0; }
        .editor-content blockquote {
          border-left: 3px solid var(--pos-color-primary-400, #4f8ef7);
          margin: 0.6em 0;
          padding: 4px 0 4px 14px;
          color: var(--pos-color-text-secondary, #555);
        }
        .editor-content hr {
          border: none;
          border-top: 1px solid var(--pos-color-border, #e5e5e5);
          margin: 1em 0;
        }
        .editor-content a { color: var(--pos-color-primary-600, #1a73e8); text-decoration: underline; }

        .tags-area {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 20px;
          border-top: 1px solid var(--pos-color-border, #e5e5e5);
          flex-wrap: wrap;
          flex-shrink: 0;
          background: var(--pos-color-surface-alt, #fafafa);
        }

        .tag-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--pos-color-primary-100, #e8f0fe);
          color: var(--pos-color-primary-700, #1557b0);
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
        }
        .tag-remove {
          cursor: pointer;
          opacity: 0.6;
          border: none;
          background: none;
          padding: 0;
          font-size: 12px;
          line-height: 1;
          color: inherit;
        }
        .tag-remove:hover { opacity: 1; }

        .tag-input {
          border: 1px dashed var(--pos-color-border, #ddd);
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          outline: none;
          width: 80px;
          background: transparent;
        }
        .tag-input:focus { border-color: var(--pos-color-primary-400, #4f8ef7); width: 120px; }

        .tag-label {
          font-size: 11px;
          color: var(--pos-color-text-muted, #aaa);
          margin-right: 2px;
        }
      </style>

      <div class="title-bar">
        <input
          class="title-input"
          placeholder="Untitled"
          value="${(this._note.title || '').replace(/"/g, '&quot;')}"
        />
        <span class="save-status"></span>
      </div>

      <pos-note-toolbar></pos-note-toolbar>

      <div class="editor-area">
        <div class="editor-content"></div>
      </div>

      <div class="tags-area">
        <span class="tag-label">Tags:</span>
        ${(this._note.tags || []).map(t => `
          <span class="tag-badge" data-tag-id="${t.id}">
            ${t.name}
            <button class="tag-remove" data-action="remove-tag" data-tag-id="${t.id}">✕</button>
          </span>
        `).join('')}
        <input class="tag-input" placeholder="Add tag…" />
      </div>
    `;

    // Re-bind after DOM rebuild (guard prevents stacking)
    this._eventsBound = false;
    this._bindAllEvents();
  }

}

customElements.define('pos-note-editor', PosNoteEditor);
