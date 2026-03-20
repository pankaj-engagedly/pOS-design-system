// pos-photos-upload-dialog — Drag-drop upload dialog with progress

import { icon } from '../../../shared/utils/icons.js';
import { uploadPhotoBulk } from '../services/photos-api.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: none; }
  :host([open]) {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: 900;
    align-items: center;
    justify-content: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .dialog {
    position: relative;
    z-index: 1;
    background: var(--pos-color-background-secondary);
    border-radius: var(--pos-radius-lg);
    padding: var(--pos-space-lg);
    width: 520px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--pos-shadow-lg, 0 20px 40px rgba(0,0,0,0.3));
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--pos-space-md);
  }

  .dialog-title {
    font-size: var(--pos-font-size-lg);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
  }
  .close-btn:hover { background: var(--pos-color-background-primary); }

  .drop-zone {
    border: 2px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    padding: var(--pos-space-xl);
    text-align: center;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    margin-bottom: var(--pos-space-md);
  }
  .drop-zone.dragover {
    border-color: var(--pos-color-action-primary);
    background: color-mix(in srgb, var(--pos-color-action-primary) 5%, transparent);
  }

  .drop-icon {
    margin-bottom: var(--pos-space-sm);
    color: var(--pos-color-text-secondary);
  }

  .drop-text {
    font-size: var(--pos-font-size-sm);
    margin-bottom: var(--pos-space-xs);
  }

  .drop-subtext {
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
  }

  .browse-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: 6px 16px;
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-action-primary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    margin-top: var(--pos-space-sm);
  }
  .browse-btn:hover { background: color-mix(in srgb, var(--pos-color-action-primary) 10%, transparent); }

  .file-input { display: none; }

  .file-list {
    margin-top: var(--pos-space-sm);
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: 6px 0;
    border-bottom: 1px solid var(--pos-color-border-default);
    font-size: var(--pos-font-size-sm);
  }
  .file-name { flex: 1; color: var(--pos-color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-size { color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs); }

  .upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--pos-space-xs);
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-action-primary);
    color: white;
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    margin-top: var(--pos-space-md);
    transition: opacity 0.15s;
  }
  .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .result {
    padding: var(--pos-space-md);
    text-align: center;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
  }
  .result .count {
    font-size: var(--pos-font-size-lg);
    font-weight: var(--pos-font-weight-semibold);
    margin-bottom: var(--pos-space-xs);
  }

  .uploading-status {
    text-align: center;
    padding: var(--pos-space-md);
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
  }
`);

class PosPhotosUploadDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._files = [];
    this._uploading = false;
    this._result = null;
  }

  open() {
    this._files = [];
    this._uploading = false;
    this._result = null;
    this.setAttribute('open', '');
    this._render();
  }

  close() {
    this.removeAttribute('open');
    if (this._result) {
      this.dispatchEvent(new CustomEvent('upload-complete', {
        bubbles: true, composed: true,
        detail: { photoIds: this._result.photoIds || [] },
      }));
    }
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    if (this._result) {
      this.shadow.innerHTML = `
        <div class="backdrop"></div>
        <div class="dialog">
          <div class="dialog-header">
            <span class="dialog-title">Upload Complete</span>
            <button class="close-btn" id="close-btn">${icon('x', 18)}</button>
          </div>
          <div class="result">
            <div class="count">${this._result.uploaded} photo${this._result.uploaded !== 1 ? 's' : ''} uploaded</div>
            ${this._result.duplicates > 0 ? `<div>${this._result.duplicates} duplicate${this._result.duplicates !== 1 ? 's' : ''} skipped</div>` : ''}
          </div>
          <button class="upload-btn" id="done-btn">Done</button>
        </div>
      `;
      return;
    }

    if (this._uploading) {
      this.shadow.innerHTML = `
        <div class="backdrop"></div>
        <div class="dialog">
          <div class="dialog-header">
            <span class="dialog-title">Uploading...</span>
          </div>
          <div class="uploading-status">
            Uploading ${this._files.length} file${this._files.length !== 1 ? 's' : ''}...
          </div>
        </div>
      `;
      return;
    }

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">Upload Photos</span>
          <button class="close-btn" id="close-btn">${icon('x', 18)}</button>
        </div>

        <div class="drop-zone" id="drop-zone">
          <div class="drop-icon">${icon('upload', 40)}</div>
          <div class="drop-text">Drag and drop photos here</div>
          <div class="drop-subtext">or</div>
          <button class="browse-btn" id="browse-btn">${icon('folder', 14)} Browse Files</button>
          <input type="file" class="file-input" id="file-input" multiple accept="image/*" />
        </div>

        ${this._files.length > 0 ? `
          <div class="file-list">
            ${this._files.map((f, i) => `
              <div class="file-item">
                <span class="file-name">${this._esc(f.name)}</span>
                <span class="file-size">${this._formatSize(f.size)}</span>
              </div>
            `).join('')}
          </div>
          <button class="upload-btn" id="upload-btn">
            ${icon('upload', 14)} Upload ${this._files.length} Photo${this._files.length !== 1 ? 's' : ''}
          </button>
        ` : ''}
      </div>
    `;

    // Bind file input change directly (change event doesn't always bubble in shadow DOM)
    const fileInput = this.shadow.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        this._addFiles(Array.from(fileInput.files));
      });
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('.backdrop') || e.target.closest('#close-btn') || e.target.closest('#done-btn')) {
        this.close();
        return;
      }

      if (e.target.closest('#browse-btn')) {
        this.shadow.getElementById('file-input')?.click();
        return;
      }

      if (e.target.closest('#upload-btn')) {
        this._doUpload();
        return;
      }
    });

    // Drag and drop
    this.shadow.addEventListener('dragover', (e) => {
      e.preventDefault();
      const zone = this.shadow.getElementById('drop-zone');
      if (zone) zone.classList.add('dragover');
    });

    this.shadow.addEventListener('dragleave', (e) => {
      const zone = this.shadow.getElementById('drop-zone');
      if (zone) zone.classList.remove('dragover');
    });

    this.shadow.addEventListener('drop', (e) => {
      e.preventDefault();
      const zone = this.shadow.getElementById('drop-zone');
      if (zone) zone.classList.remove('dragover');

      const files = Array.from(e.dataTransfer?.files || []).filter(f =>
        f.type.startsWith('image/')
      );
      if (files.length) this._addFiles(files);
    });
  }

  _addFiles(newFiles) {
    // Dedup by name+size
    const existing = new Set(this._files.map(f => `${f.name}:${f.size}`));
    for (const f of newFiles) {
      const key = `${f.name}:${f.size}`;
      if (!existing.has(key)) {
        this._files.push(f);
        existing.add(key);
      }
    }
    this._render();
  }

  async _doUpload() {
    if (!this._files.length) return;
    this._uploading = true;
    this._render();

    try {
      const result = await uploadPhotoBulk(this._files);
      this._result = {
        ...result,
        photoIds: (result.photos || []).map(p => p.id),
      };
      this._uploading = false;
      this._render();
    } catch (err) {
      this._uploading = false;
      this._result = { uploaded: 0, duplicates: 0, photoIds: [], error: err.message };
      this._render();
    }
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-photos-upload-dialog', PosPhotosUploadDialog);
