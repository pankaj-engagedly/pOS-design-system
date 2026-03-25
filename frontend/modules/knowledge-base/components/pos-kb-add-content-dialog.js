// pos-kb-add-content-dialog — Unified dialog for Add URL, Add Media, Add Text
// Shared fields: Tags (search/select/create) + Collections (multiselect)

import { icon } from '../../../shared/utils/icons.js';
import { Editor, StarterKit, Link, Placeholder } from '../../notes/editor.bundle.js';
import { saveURL, previewURL, createItem, updateItem, addTag, addToCollection, getTags, getCollections } from '../services/kb-api.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 1000;
    padding-top: 60px;
  }
  .dialog {
    background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-md);
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    width: 560px;
    max-width: 90vw;
    max-height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .dialog-header {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-md);
    border-bottom: 1px solid var(--pos-color-border-default);
    flex-shrink: 0;
  }
  .dialog-header h3 {
    margin: 0; flex: 1;
    font-size: var(--pos-font-size-md);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    display: flex; align-items: center; gap: var(--pos-space-xs);
  }
  .close-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border: none; border-radius: var(--pos-radius-sm);
    background: transparent; color: var(--pos-color-text-secondary); cursor: pointer;
  }
  .close-btn:hover { background: var(--pos-color-border-default); }

  /* Body */
  .dialog-body {
    padding: var(--pos-space-md);
    display: flex; flex-direction: column; gap: var(--pos-space-md);
    overflow-y: auto; flex: 1; min-height: 0;
  }

  /* Fields */
  .field-label {
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-secondary);
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: var(--pos-space-xs);
  }
  .text-input, .textarea-input {
    width: 100%; padding: var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none; box-sizing: border-box;
  }
  .text-input:focus, .textarea-input:focus { border-color: var(--pos-color-action-primary); }
  .textarea-input { resize: vertical; min-height: 60px; }

  /* URL Preview */
  .url-preview {
    display: flex; gap: var(--pos-space-sm);
    padding: var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-secondary);
  }
  .url-preview-img {
    width: 80px; height: 60px;
    border-radius: var(--pos-radius-sm);
    object-fit: cover; flex-shrink: 0;
    background: var(--pos-color-border-default);
  }
  .url-preview-text { flex: 1; min-width: 0; }
  .url-preview-title {
    font-size: var(--pos-font-size-sm);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    line-height: 1.3;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .url-preview-desc {
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
    margin-top: 2px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .url-preview-meta {
    font-size: 10px;
    color: var(--pos-color-text-secondary);
    margin-top: 4px;
    display: flex; gap: var(--pos-space-sm); align-items: center;
  }
  .preview-loading {
    padding: var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-secondary);
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
    text-align: center;
  }

  /* File upload */
  .file-drop {
    border: 2px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    padding: var(--pos-space-lg) var(--pos-space-md);
    text-align: center; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .file-drop:hover {
    border-color: var(--pos-color-action-primary);
    background: color-mix(in srgb, var(--pos-color-action-primary) 5%, transparent);
  }
  .file-drop-text {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
  }
  .file-drop-text strong { color: var(--pos-color-action-primary); }
  .file-info {
    display: flex; align-items: center; gap: var(--pos-space-sm);
    padding: var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-secondary);
  }
  .file-info-name {
    flex: 1; font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .file-info-size {
    font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); flex-shrink: 0;
  }
  .file-remove {
    background: none; border: none; cursor: pointer;
    color: var(--pos-color-text-secondary); display: flex; padding: 0;
  }
  .file-remove:hover { color: var(--pos-color-priority-urgent); }

  /* Rich text editor */
  .editor-wrap {
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    min-height: 180px;
    max-height: 300px;
    overflow-y: auto;
  }
  .editor-wrap:focus-within { border-color: var(--pos-color-action-primary); }
  .editor-content {
    padding: var(--pos-space-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    color: var(--pos-color-text-primary);
    outline: none;
    min-height: 150px;
  }
  .editor-content .tiptap { outline: none; }
  .editor-content .tiptap p { margin: 0 0 0.5em; }
  .editor-content .tiptap p:last-child { margin-bottom: 0; }
  .editor-content .tiptap p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left; color: var(--pos-color-text-secondary);
    pointer-events: none; height: 0;
  }
  .editor-content .tiptap h1, .editor-content .tiptap h2, .editor-content .tiptap h3 {
    margin: 0.5em 0 0.3em; color: var(--pos-color-text-primary);
  }
  .editor-content .tiptap ul, .editor-content .tiptap ol { padding-left: 1.5em; margin: 0.3em 0; }
  .editor-content .tiptap blockquote {
    border-left: 3px solid var(--pos-color-border-default);
    padding-left: var(--pos-space-sm); margin: 0.3em 0;
    color: var(--pos-color-text-secondary);
  }
  .editor-content .tiptap code {
    background: var(--pos-color-background-secondary);
    padding: 1px 4px; border-radius: 3px;
    font-size: 0.9em;
  }
  .editor-content .tiptap pre {
    background: var(--pos-color-background-secondary);
    padding: var(--pos-space-sm); border-radius: var(--pos-radius-sm);
    overflow-x: auto;
  }
  .editor-toolbar {
    display: flex; gap: 2px;
    padding: 4px var(--pos-space-sm);
    border-bottom: 1px solid var(--pos-color-border-default);
    background: var(--pos-color-background-secondary);
    border-radius: var(--pos-radius-sm) var(--pos-radius-sm) 0 0;
  }
  .toolbar-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border: none; border-radius: 3px;
    background: transparent; color: var(--pos-color-text-secondary);
    cursor: pointer; font-size: 13px; font-weight: bold; font-family: inherit;
    padding: 0;
  }
  .toolbar-btn:hover { background: var(--pos-color-background-primary); color: var(--pos-color-text-primary); }
  .toolbar-btn.active { background: var(--pos-color-action-primary); color: white; }
  .toolbar-sep { width: 1px; background: var(--pos-color-border-default); margin: 2px 4px; }

  /* Tags */
  .tag-field { position: relative; overflow: visible; }
  .tag-input-wrap {
    display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
    padding: 4px var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-primary);
    min-height: 32px; cursor: text;
  }
  .tag-input-wrap:focus-within { border-color: var(--pos-color-action-primary); }
  .tag-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 99px;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
    font-size: var(--pos-font-size-xs);
    border: 1px solid var(--pos-color-border-default);
  }
  .tag-remove {
    display: inline-flex; align-items: center;
    background: none; border: none; padding: 0; cursor: pointer;
    color: var(--pos-color-text-secondary); line-height: 1;
  }
  .tag-remove:hover { color: var(--pos-color-priority-urgent); }
  .tag-search-input {
    border: none; outline: none; background: transparent;
    font-size: var(--pos-font-size-xs); font-family: inherit;
    color: var(--pos-color-text-primary);
    flex: 1; min-width: 80px; padding: 2px 0;
  }
  .tag-suggestions {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    max-height: 150px; overflow-y: auto; z-index: 100;
    margin-top: 2px;
  }
  .tag-suggestion {
    padding: 6px var(--pos-space-sm);
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-primary);
    cursor: pointer;
  }
  .tag-suggestion:hover { background: var(--pos-color-background-secondary); }
  .tag-suggestion-new {
    color: var(--pos-color-action-primary);
    font-style: italic;
  }

  /* Collections multiselect */
  .collection-chips {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .collection-chip {
    padding: 4px 10px; border-radius: 99px;
    border: 1px solid var(--pos-color-border-default);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-xs); font-family: inherit;
    cursor: pointer; white-space: nowrap;
    transition: all 0.1s;
  }
  .collection-chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
  .collection-chip.selected {
    background: var(--pos-color-action-primary);
    color: white; border-color: var(--pos-color-action-primary);
  }

  /* Footer */
  .dialog-footer {
    display: flex; justify-content: flex-end; gap: var(--pos-space-sm);
    padding: var(--pos-space-md);
    border-top: 1px solid var(--pos-color-border-default);
    flex-shrink: 0;
  }
  .btn {
    padding: var(--pos-space-xs) var(--pos-space-md);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); font-family: inherit;
    cursor: pointer;
    border: 1px solid var(--pos-color-border-default);
    background: transparent; color: var(--pos-color-text-primary);
  }
  .btn:hover { background: var(--pos-color-background-secondary); }
  .btn-primary {
    background: var(--pos-color-action-primary);
    color: white; border-color: var(--pos-color-action-primary);
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: var(--pos-color-priority-urgent);
    font-size: var(--pos-font-size-xs);
    margin-top: var(--pos-space-xs);
  }
`);

const TITLES = { url: 'Add URL', media: 'Add Media', text: 'Add Text' };
const ICONS = { url: 'bookmark', media: 'upload', text: 'file-text' };

class PosKBAddContentDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._open = false;
    this._mode = 'url';
    this._saving = false;
    this._error = null;
    this._editor = null;

    // URL mode
    this._urlPreview = null;
    this._loadingPreview = false;

    // Media mode
    this._file = null;

    // Shared
    this._tags = [];
    this._tagQuery = '';
    this._allTags = [];
    this._collections = [];
    this._selectedCollectionIds = new Set();
    this._showSuggestions = false;
  }

  open(mode = 'url', context = {}) {
    this._open = true;
    this._mode = mode;
    this._context = context; // { isFavourite, collectionId, tag }
    this._saving = false;
    this._error = null;
    this._urlPreview = null;
    this._loadingPreview = false;
    this._file = null;
    this._tags = context.tag ? [context.tag] : [];
    this._tagQuery = '';
    this._selectedCollectionIds = context.collectionId ? new Set([context.collectionId]) : new Set();
    this._showSuggestions = false;
    this._editor?.destroy();
    this._editor = null;
    this._loadReferenceData();
    this._render();
    this._bindEvents();
    if (this._mode === 'text') {
      this._mountEditor();
    }
    setTimeout(() => {
      this.shadow.getElementById('primary-input')?.focus();
    }, 50);
  }

  close() {
    this._open = false;
    this._editor?.destroy();
    this._editor = null;
    this.shadow.innerHTML = '';
  }

  async _loadReferenceData() {
    try {
      const [tags, collections] = await Promise.all([getTags(), getCollections()]);
      this._allTags = tags;
      this._collections = collections;
      this._renderCollections();
    } catch (e) {
      console.error('Failed to load reference data', e);
    }
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>${icon(ICONS[this._mode], 18)} ${TITLES[this._mode]}</h3>
            <button class="close-btn" id="close-btn">${icon('x', 16)}</button>
          </div>
          <div class="dialog-body">
            ${this._renderModeFields()}
            ${this._renderTagField()}
            ${this._renderCollectionField()}
          </div>
          <div class="dialog-footer">
            <button class="btn" id="cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="save-btn" ${this._saving ? 'disabled' : ''}>
              ${this._saving ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderModeFields() {
    if (this._mode === 'url') {
      return `
        <div>
          <div class="field-label">URL</div>
          <input class="text-input" id="primary-input" placeholder="https://example.com/article" type="url" />
          ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
        </div>
        <div id="preview-area">${this._renderUrlPreview()}</div>
      `;
    }

    if (this._mode === 'media') {
      return `
        <div>
          <div class="field-label">File</div>
          <div id="file-area">${this._renderFileArea()}</div>
          ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
          <input type="file" id="file-input" style="display:none" />
        </div>
        <div>
          <div class="field-label">Description</div>
          <textarea class="textarea-input" id="primary-input" placeholder="Describe this file\u2026" rows="3"></textarea>
        </div>
      `;
    }

    // text mode
    return `
      <div>
        <div class="field-label">Title</div>
        <input class="text-input" id="primary-input" placeholder="Title\u2026" />
        ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
      </div>
      <div>
        <div class="field-label">Content</div>
        <div class="editor-wrap">
          <div class="editor-toolbar" id="editor-toolbar">
            <button class="toolbar-btn" data-cmd="bold" title="Bold"><b>B</b></button>
            <button class="toolbar-btn" data-cmd="italic" title="Italic"><i>I</i></button>
            <button class="toolbar-btn" data-cmd="strike" title="Strikethrough"><s>S</s></button>
            <div class="toolbar-sep"></div>
            <button class="toolbar-btn" data-cmd="bulletList" title="Bullet List">${icon('list', 14)}</button>
            <button class="toolbar-btn" data-cmd="blockquote" title="Quote">${icon('chevron-right', 14)}</button>
            <button class="toolbar-btn" data-cmd="code" title="Code">&lt;/&gt;</button>
          </div>
          <div class="editor-content" id="editor-area"></div>
        </div>
      </div>
    `;
  }

  _mountEditor() {
    const editorEl = this.shadow.getElementById('editor-area');
    if (!editorEl) return;

    this._editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: 'Start writing...' }),
      ],
      content: '',
      onSelectionUpdate: ({ editor }) => this._updateToolbarActive(editor),
    });
  }

  _updateToolbarActive(editor) {
    const toolbar = this.shadow.getElementById('editor-toolbar');
    if (!toolbar) return;
    toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
      const cmd = btn.dataset.cmd;
      btn.classList.toggle('active', editor.isActive(cmd));
    });
  }

  _renderUrlPreview() {
    if (this._loadingPreview) {
      return `<div class="preview-loading">Fetching preview\u2026</div>`;
    }
    if (!this._urlPreview) return '';
    const p = this._urlPreview;
    return `
      <div class="url-preview">
        ${p.image ? `<img class="url-preview-img" src="${this._escAttr(p.image)}" alt="" />` : ''}
        <div class="url-preview-text">
          <div class="url-preview-title">${this._esc(p.title || 'Untitled')}</div>
          ${p.description ? `<div class="url-preview-desc">${this._esc(p.description)}</div>` : ''}
          <div class="url-preview-meta">
            ${p.site_name ? `<span>${this._esc(p.site_name)}</span>` : ''}
            ${p.author ? `<span>${this._esc(p.author)}</span>` : ''}
            ${p.reading_time_min ? `<span>${p.reading_time_min} min read</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderFileArea() {
    if (this._file) {
      const size = this._file.size < 1024 * 1024
        ? `${(this._file.size / 1024).toFixed(1)} KB`
        : `${(this._file.size / (1024 * 1024)).toFixed(1)} MB`;
      return `
        <div class="file-info">
          ${icon('file', 16)}
          <span class="file-info-name">${this._esc(this._file.name)}</span>
          <span class="file-info-size">${size}</span>
          <button class="file-remove" id="remove-file">${icon('x', 14)}</button>
        </div>
      `;
    }
    return `
      <div class="file-drop" id="file-drop">
        <div class="file-drop-text">${icon('upload', 20)}<br><strong>Browse</strong> or drop file here</div>
      </div>
    `;
  }

  _renderTagField() {
    return `
      <div class="tag-field" id="tag-field">
        <div class="field-label">Tags</div>
        <div class="tag-input-wrap" id="tag-input-wrap">
          ${this._tags.map((t, i) => `
            <span class="tag-chip">
              ${this._esc(t)}
              <button class="tag-remove" data-tag-index="${i}">${icon('x', 10)}</button>
            </span>
          `).join('')}
          <input class="tag-search-input" id="tag-search" placeholder="${this._tags.length ? '' : 'Search or create tags\u2026'}" value="${this._escAttr(this._tagQuery)}" autocomplete="off" />
        </div>
      </div>
    `;
  }

  _renderCollectionField() {
    if (!this._collections.length) return '';
    return `
      <div>
        <div class="field-label">Collections</div>
        <div class="collection-chips" id="collection-chips">
          ${this._collections.map(c => `
            <button class="collection-chip ${this._selectedCollectionIds.has(c.id) ? 'selected' : ''}"
                    data-collection-id="${c.id}">
              ${this._esc(c.name)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderCollections() {
    if (!this._collections.length) return;
    const container = this.shadow.getElementById('collection-chips');
    if (container) {
      container.innerHTML = this._collections.map(c => `
        <button class="collection-chip ${this._selectedCollectionIds.has(c.id) ? 'selected' : ''}"
                data-collection-id="${c.id}">
          ${this._esc(c.name)}
        </button>
      `).join('');
    } else {
      // Collections loaded after initial render — inject the field into dialog body
      const body = this.shadow.querySelector('.dialog-body');
      if (!body) return;
      const div = document.createElement('div');
      div.innerHTML = this._renderCollectionField();
      if (div.firstElementChild) body.appendChild(div.firstElementChild);
    }
  }

  _getTagSuggestions() {
    const q = this._tagQuery.toLowerCase().trim();
    if (!q) return [];

    const existing = new Set(this._tags.map(t => t.toLowerCase()));
    const matches = this._allTags
      .filter(t => t.name.toLowerCase().includes(q) && !existing.has(t.name.toLowerCase()))
      .slice(0, 8)
      .map(t => ({ name: t.name, isNew: false }));

    const exactMatch = this._allTags.some(t => t.name.toLowerCase() === q) || existing.has(q);
    if (!exactMatch && q.length > 0) {
      matches.push({ name: this._tagQuery.trim(), isNew: true });
    }

    return matches;
  }

  _bindEvents() {
    // Overlay close
    this.shadow.getElementById('overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'overlay') this.close();
    });
    this.shadow.getElementById('close-btn')?.addEventListener('click', () => this.close());
    this.shadow.getElementById('cancel-btn')?.addEventListener('click', () => this.close());
    this.shadow.getElementById('save-btn')?.addEventListener('click', () => this._save());

    // URL: auto-preview on paste or blur
    if (this._mode === 'url') {
      const urlInput = this.shadow.getElementById('primary-input');
      urlInput?.addEventListener('paste', () => {
        setTimeout(() => this._fetchPreview(urlInput.value.trim()), 100);
      });
      urlInput?.addEventListener('blur', () => {
        const url = urlInput.value.trim();
        if (url && !this._urlPreview) this._fetchPreview(url);
      });
      urlInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._save(); }
      });
    }

    // Media: file upload
    if (this._mode === 'media') {
      this.shadow.getElementById('file-drop')?.addEventListener('click', () => {
        this.shadow.getElementById('file-input')?.click();
      });
      this.shadow.getElementById('file-input')?.addEventListener('change', (e) => {
        if (e.target.files?.[0]) {
          this._file = e.target.files[0];
          const area = this.shadow.getElementById('file-area');
          if (area) area.innerHTML = this._renderFileArea();
          this.shadow.getElementById('remove-file')?.addEventListener('click', () => {
            this._file = null;
            const area2 = this.shadow.getElementById('file-area');
            if (area2) area2.innerHTML = this._renderFileArea();
            this._rebindFileDrop();
          });
        }
      });
    }

    // Text: toolbar buttons
    if (this._mode === 'text') {
      this.shadow.getElementById('editor-toolbar')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cmd]');
        if (!btn || !this._editor) return;
        const cmd = btn.dataset.cmd;
        if (cmd === 'bold') this._editor.chain().focus().toggleBold().run();
        else if (cmd === 'italic') this._editor.chain().focus().toggleItalic().run();
        else if (cmd === 'strike') this._editor.chain().focus().toggleStrike().run();
        else if (cmd === 'bulletList') this._editor.chain().focus().toggleBulletList().run();
        else if (cmd === 'blockquote') this._editor.chain().focus().toggleBlockquote().run();
        else if (cmd === 'code') this._editor.chain().focus().toggleCode().run();
        this._updateToolbarActive(this._editor);
      });
    }

    // Tag search
    this._bindTagEvents();

    // Tag suggestion & remove clicks + collection toggle
    this.shadow.addEventListener('click', (e) => {
      const suggestion = e.target.closest('[data-tag-name]');
      if (suggestion) {
        const name = suggestion.dataset.tagName;
        if (!this._tags.includes(name)) {
          this._tags.push(name);
          this._tagQuery = '';
          this._showSuggestions = false;
          this._updateTagField();
        }
        return;
      }

      const removeBtn = e.target.closest('[data-tag-index]');
      if (removeBtn) {
        this._tags.splice(parseInt(removeBtn.dataset.tagIndex), 1);
        this._updateTagField();
        return;
      }

      const collChip = e.target.closest('[data-collection-id]');
      if (collChip) {
        const id = collChip.dataset.collectionId;
        if (this._selectedCollectionIds.has(id)) {
          this._selectedCollectionIds.delete(id);
          collChip.classList.remove('selected');
        } else {
          this._selectedCollectionIds.add(id);
          collChip.classList.add('selected');
        }
      }
    });

    // Close suggestions on click outside tag field
    this.shadow.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#tag-field')) {
        this._showSuggestions = false;
        this._removeSuggestions();
      }
    });

    // Escape to close dialog (but not when suggestions are showing)
    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this._showSuggestions && !e.target.closest('#tag-search')) {
        this.close();
      }
    });
  }

  _bindTagEvents() {
    const tagSearch = this.shadow.getElementById('tag-search');
    if (!tagSearch) return;

    tagSearch.addEventListener('input', (e) => {
      this._tagQuery = e.target.value;
      this._showSuggestions = true;
      this._updateSuggestionsDropdown();
    });
    tagSearch.addEventListener('focus', () => {
      if (this._tagQuery) {
        this._showSuggestions = true;
        this._updateSuggestionsDropdown();
      }
    });
    tagSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const q = this._tagQuery.trim();
        if (q && !this._tags.includes(q)) {
          this._tags.push(q);
          this._tagQuery = '';
          this._showSuggestions = false;
          this._updateTagField();
        }
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        this._showSuggestions = false;
        this._removeSuggestions();
      }
      if (e.key === 'Backspace' && !this._tagQuery && this._tags.length) {
        this._tags.pop();
        this._updateTagField();
      }
    });
  }

  _rebindFileDrop() {
    this.shadow.getElementById('file-drop')?.addEventListener('click', () => {
      this.shadow.getElementById('file-input')?.click();
    });
  }

  _updateTagField() {
    const field = this.shadow.getElementById('tag-field');
    if (!field) return;
    field.innerHTML = `
      <div class="field-label">Tags</div>
      <div class="tag-input-wrap" id="tag-input-wrap">
        ${this._tags.map((t, i) => `
          <span class="tag-chip">
            ${this._esc(t)}
            <button class="tag-remove" data-tag-index="${i}">${icon('x', 10)}</button>
          </span>
        `).join('')}
        <input class="tag-search-input" id="tag-search" placeholder="${this._tags.length ? '' : 'Search or create tags\u2026'}" value="" autocomplete="off" />
      </div>
    `;
    this._bindTagEvents();
    this.shadow.getElementById('tag-search')?.focus();
  }

  _updateSuggestionsDropdown() {
    this._removeSuggestions();
    if (!this._showSuggestions) return;

    const suggestions = this._getTagSuggestions();
    if (!suggestions.length) return;

    const field = this.shadow.getElementById('tag-field');
    if (!field) return;

    const div = document.createElement('div');
    div.className = 'tag-suggestions';
    div.id = 'tag-suggestions';
    div.innerHTML = suggestions.map(s => `
      <div class="tag-suggestion ${s.isNew ? 'tag-suggestion-new' : ''}" data-tag-name="${this._escAttr(s.name)}">
        ${s.isNew ? `Create "${this._esc(s.name)}"` : this._esc(s.name)}
      </div>
    `).join('');
    field.appendChild(div);
  }

  _removeSuggestions() {
    this.shadow.getElementById('tag-suggestions')?.remove();
  }

  async _fetchPreview(url) {
    if (!url) return;
    try { new URL(url); } catch { return; }

    this._loadingPreview = true;
    const area = this.shadow.getElementById('preview-area');
    if (area) area.innerHTML = this._renderUrlPreview();

    try {
      this._urlPreview = await previewURL(url);
    } catch {
      this._urlPreview = null;
    }

    this._loadingPreview = false;
    if (area) area.innerHTML = this._renderUrlPreview();
  }

  async _save() {
    this._error = null;

    if (this._mode === 'url') {
      const urlInput = this.shadow.getElementById('primary-input');
      const url = urlInput?.value.trim();
      if (!url) { this._showError('Please enter a URL'); return; }
      try { new URL(url); } catch { this._showError('Please enter a valid URL'); return; }

      this._setSaving(true);

      try {
        const item = await saveURL(url, this._urlPreview);
        await this._applyTagsAndCollections(item.id);
        this._emitSaved();
      } catch (err) {
        this._showError(err.message || 'Failed to save URL');
        this._setSaving(false);
      }
    } else if (this._mode === 'media') {
      if (!this._file) { this._showError('Please select a file'); return; }

      this._setSaving(true);

      try {
        // Step 1: Upload file to attachments service
        const formData = new FormData();
        formData.append('file', this._file);

        const attachment = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/attachments/upload');
          const token = getAccessToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload network error')));
          xhr.send(formData);
        });

        // Step 2: Create KB item with download URL
        const desc = this.shadow.querySelector('.textarea-input')?.value?.trim() || '';
        const isImage = this._file.type.startsWith('image/');
        const isMediaType = this._file.type.startsWith('video/') || this._file.type.startsWith('audio/');
        const itemType = isImage ? 'image' : isMediaType ? 'media' : 'document';
        const downloadUrl = `/api/attachments/${attachment.id}/download`;
        const item = await createItem({
          title: this._file.name,
          item_type: itemType,
          preview_text: desc || null,
          url: downloadUrl,
          thumbnail_url: isImage ? downloadUrl : null,
        });
        await this._applyTagsAndCollections(item.id);
        this._emitSaved();
      } catch (err) {
        this._showError(err.message || 'Failed to save');
        this._setSaving(false);
      }
    } else {
      // text mode
      const titleInput = this.shadow.getElementById('primary-input');
      const title = titleInput?.value.trim();
      if (!title) { this._showError('Please enter a title'); return; }

      this._setSaving(true);

      try {
        const editorContent = this._editor?.getJSON() || null;
        const plainText = this._editor?.getText()?.trim() || '';

        const item = await createItem({
          title,
          item_type: 'text',
          content: editorContent,
          preview_text: plainText.substring(0, 300) || null,
        });
        await this._applyTagsAndCollections(item.id);
        this._emitSaved();
      } catch (err) {
        this._showError(err.message || 'Failed to save');
        this._setSaving(false);
      }
    }
  }

  _showError(msg) {
    this._error = msg;
    // Only update the error display, don't re-render the entire dialog
    const existing = this.shadow.querySelector('.error');
    if (existing) {
      existing.textContent = msg;
    } else {
      const primaryInput = this.shadow.getElementById('primary-input');
      if (primaryInput) {
        const errDiv = document.createElement('div');
        errDiv.className = 'error';
        errDiv.textContent = msg;
        primaryInput.parentElement.appendChild(errDiv);
      }
    }
  }

  _setSaving(val) {
    this._saving = val;
    const btn = this.shadow.getElementById('save-btn');
    if (btn) {
      btn.disabled = val;
      btn.textContent = val ? 'Saving\u2026' : 'Save';
    }
  }

  async _applyTagsAndCollections(itemId) {
    // Auto-favourite if added from favourites view
    if (this._context?.isFavourite) {
      try { await updateItem(itemId, { is_favourite: true }); } catch (e) { console.warn('Favourite failed:', e); }
    }
    for (const tagName of this._tags) {
      try { await addTag(itemId, tagName); } catch (e) { console.warn('Tag failed:', tagName, e); }
    }
    for (const colId of this._selectedCollectionIds) {
      try { await addToCollection(colId, itemId); } catch (e) { console.warn('Collection failed:', colId, e); }
    }
  }

  _emitSaved() {
    this.close();
    this.dispatchEvent(new CustomEvent('item-saved', { bubbles: true, composed: true }));
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

customElements.define('pos-kb-add-content-dialog', PosKBAddContentDialog);
