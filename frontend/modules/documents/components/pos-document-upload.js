// pos-document-upload — modal upload dialog (Google Drive style)
// Public API:
//   open(folderId, folderName) — show the modal, set target folder context
//   close()                   — dismiss the modal
// Emits:
//   upload-complete  { documents: [...] }  — after all files finish

import { uploadDocument } from '../services/documents-api.js';

const TAG = 'pos-document-upload';

class PosDocumentUpload extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    // State
    this._open = false;
    this._folderId = null;
    this._folderName = '';
    this._dragging = false;

    // Per-file upload tracking: Array<{ file, progress, status, error }>
    // status: 'pending' | 'uploading' | 'done' | 'error'
    this._queue = [];
    this._completedDocs = [];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  open(folderId = null, folderName = '') {
    this._folderId = folderId;
    this._folderName = folderName;
    this._queue = [];
    this._completedDocs = [];
    this._dragging = false;
    this._open = true;
    this._render();
  }

  close() {
    if (this._isBusy()) return;
    this._open = false;
    this._render();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    this._render();

    // Event delegation — bound once, never re-bound on re-render
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('dragover', (e) => {
      if (!this.shadow.querySelector('.drop-zone')) return;
      e.preventDefault();
      if (!this._dragging) { this._dragging = true; this._render(); }
    });
    this.shadow.addEventListener('dragleave', (e) => {
      // Only clear if leaving the drop-zone itself (not a child element)
      if (e.target.classList?.contains('drop-zone')) {
        this._dragging = false;
        this._render();
      }
    });
    this.shadow.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dragging = false;
      this._render();
      this._enqueueFiles(e.dataTransfer.files);
    });
    this.shadow.addEventListener('keydown', (e) => {
      if (!this._open) return;
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    if (!this._open) {
      this.shadow.innerHTML = '';
      return;
    }

    const busy = this._isBusy();
    const hasQueue = this._queue.length > 0;
    const folderLabel = this._folderName
      ? `Uploading to: <strong>${this._esc(this._folderName)}</strong>`
      : 'Uploading to: <strong>Root</strong>';

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }

        /* Backdrop */
        .backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
        }

        /* Modal card */
        .modal {
          background: var(--pos-color-background-primary);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          width: 500px; max-width: 94vw;
          max-height: 90vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          font-family: inherit;
        }

        /* Header */
        .header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 20px 12px;
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }
        .header-text { display: flex; flex-direction: column; gap: 2px; }
        .title { font-size: 15px; font-weight: 600; color: var(--pos-color-text-primary); margin: 0; }
        .subtitle { font-size: 12px; color: var(--pos-color-text-secondary); }
        .subtitle strong { color: var(--pos-color-text-primary); }

        .close-btn {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-secondary);
          padding: 2px 4px; border-radius: 4px; line-height: 1;
          display: flex; align-items: center;
        }
        .close-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
        .close-btn svg { display: block; }

        /* Body */
        .body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          display: flex; flex-direction: column; gap: 16px;
        }

        /* Drop zone */
        .drop-zone {
          border: 2px dashed var(--pos-color-border-default);
          border-radius: 10px;
          padding: 40px 24px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          color: var(--pos-color-text-secondary);
          flex-shrink: 0;
        }
        .drop-zone.dragging {
          border-color: var(--pos-color-action-primary);
          background: var(--pos-color-action-primary-subtle, #eff6ff);
        }
        .drop-zone-icon { font-size: 32px; margin-bottom: 10px; }
        .drop-zone-text { font-size: 13px; margin: 0 0 4px; }
        .drop-zone-hint { font-size: 12px; color: var(--pos-color-text-tertiary, var(--pos-color-text-secondary)); margin: 0 0 14px; }

        /* Browse button */
        .browse-btn {
          display: inline-block;
          background: transparent;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 6px;
          padding: 7px 16px;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          color: var(--pos-color-text-primary);
          transition: background 0.1s, border-color 0.1s;
        }
        .browse-btn:hover {
          background: var(--pos-color-background-secondary);
          border-color: var(--pos-color-text-secondary);
        }

        input[type=file] { display: none; }

        /* Upload queue */
        .queue-section { flex-shrink: 0; }
        .queue-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          text-transform: uppercase; color: var(--pos-color-text-secondary);
          margin: 0 0 10px;
        }
        .queue-list { display: flex; flex-direction: column; gap: 8px; }

        /* File row */
        .file-row {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px;
        }
        .file-icon { flex-shrink: 0; font-size: 16px; }
        .file-info { flex: 1; min-width: 0; }
        .file-name {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--pos-color-text-primary);
          margin-bottom: 4px;
        }
        .progress-track {
          height: 4px; border-radius: 2px;
          background: var(--pos-color-background-secondary);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%; border-radius: 2px;
          background: var(--pos-color-action-primary);
          transition: width 0.2s;
        }
        .progress-fill.done { background: var(--pos-color-status-success, #22c55e); }
        .progress-fill.error { background: var(--pos-color-priority-urgent, #ef4444); }
        .file-status {
          flex-shrink: 0; font-size: 11px; min-width: 50px; text-align: right;
          color: var(--pos-color-text-secondary);
        }
        .file-status.done { color: var(--pos-color-status-success, #22c55e); }
        .file-status.error { color: var(--pos-color-priority-urgent, #ef4444); }

        /* Success banner */
        .success-banner {
          text-align: center; padding: 12px;
          background: var(--pos-color-action-primary-subtle, #eff6ff);
          border-radius: 8px; font-size: 13px;
          color: var(--pos-color-action-primary);
        }
      </style>

      <div class="backdrop" data-action="backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Upload Documents">

          <div class="header">
            <div class="header-text">
              <p class="title">Upload Documents</p>
              <p class="subtitle">${folderLabel}</p>
            </div>
            <button class="close-btn" data-action="close" title="Close" ${busy ? 'disabled' : ''}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="body">

            <div class="drop-zone ${this._dragging ? 'dragging' : ''}" data-action="dropzone">
              <div class="drop-zone-icon">📂</div>
              <p class="drop-zone-text">Drag &amp; drop files here</p>
              <p class="drop-zone-hint">or</p>
              <button class="browse-btn" data-action="browse">Browse files</button>
            </div>

            <input type="file" id="file-input" multiple />

            ${hasQueue ? `
              <div class="queue-section">
                <p class="queue-label">Uploading</p>
                <div class="queue-list">
                  ${this._queue.map((item, i) => this._renderFileRow(item, i)).join('')}
                </div>
              </div>
            ` : ''}

            ${this._isAllDone() ? `<div class="success-banner">All files uploaded successfully!</div>` : ''}

          </div>
        </div>
      </div>
    `;

    // File input must be re-bound after every innerHTML swap — it lives in shadow DOM
    // so document.querySelectorAll won't find it and MutationObserver won't help either.
    const input = this.shadow.getElementById('file-input');
    if (input) {
      input.addEventListener('change', (e) => {
        this._enqueueFiles(e.target.files);
        // Reset so same file can be selected again
        e.target.value = '';
      });
    }
  }

  _renderFileRow(item, index) {
    const pct = item.progress ?? 0;
    const fillClass = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : '';
    const statusClass = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : '';
    const statusText = item.status === 'done'
      ? 'Done'
      : item.status === 'error'
        ? 'Error'
        : item.status === 'uploading'
          ? `${pct}%`
          : 'Waiting…';

    return `
      <div class="file-row" data-index="${index}">
        <span class="file-icon">📄</span>
        <div class="file-info">
          <div class="file-name" title="${this._esc(item.file.name)}">${this._esc(item.file.name)}</div>
          <div class="progress-track">
            <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="file-status ${statusClass}">${statusText}</span>
      </div>
    `;
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'backdrop') {
      // Only close if click is directly on the backdrop (not on the modal card)
      if (e.target.dataset.action === 'backdrop' && !this._isBusy()) this.close();
      return;
    }
    if (action === 'close') { this.close(); return; }
    if (action === 'browse' || action === 'dropzone') {
      // Clicking the browse button or anywhere in the drop zone opens the picker
      if (action === 'dropzone' && e.target.closest('.browse-btn')) return; // let browse-btn handle it
      this.shadow.getElementById('file-input')?.click();
    }
  }

  // ── Upload logic ───────────────────────────────────────────────────────────

  _enqueueFiles(fileList) {
    if (!fileList?.length) return;
    const startIndex = this._queue.length;

    for (const file of fileList) {
      this._queue.push({ file, progress: 0, status: 'pending', doc: null });
    }
    this._render();
    this._processQueue(startIndex);
  }

  async _processQueue(startIndex) {
    for (let i = startIndex; i < this._queue.length; i++) {
      const item = this._queue[i];
      if (item.status !== 'pending') continue;

      item.status = 'uploading';
      this._updateFileRow(i);

      try {
        const doc = await uploadDocument({
          file: item.file,
          folderId: this._folderId,
          onProgress: (p) => {
            item.progress = p;
            this._updateFileRow(i);
          },
        });
        item.progress = 100;
        item.status = 'done';
        item.doc = doc;
        this._completedDocs.push(doc);
        this._updateFileRow(i);
      } catch (err) {
        item.status = 'error';
        item.progress = 0;
        this._updateFileRow(i);
        console.error(`Upload failed for ${item.file.name}:`, err);
      }
    }

    // After all files complete, emit event and auto-close
    if (this._isAllDone() && this._completedDocs.length > 0) {
      this._render(); // show success banner
      this.dispatchEvent(new CustomEvent('upload-complete', {
        detail: { documents: this._completedDocs },
        bubbles: true,
        composed: true,
      }));
      setTimeout(() => {
        this._open = false;
        this._render();
      }, 1500);
    }
  }

  // Surgically update a single file row without full re-render (avoids disrupting
  // in-progress drag state or file input listeners while uploads are running).
  _updateFileRow(index) {
    const item = this._queue[index];
    const row = this.shadow.querySelector(`.file-row[data-index="${index}"]`);
    if (!row) {
      // Queue section doesn't exist yet — do a full render instead
      this._render();
      return;
    }

    const pct = item.progress ?? 0;
    const fillClass = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : '';
    const statusClass = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : '';
    const statusText = item.status === 'done'
      ? 'Done'
      : item.status === 'error'
        ? 'Error'
        : item.status === 'uploading'
          ? `${pct}%`
          : 'Waiting…';

    const fill = row.querySelector('.progress-fill');
    const status = row.querySelector('.file-status');

    if (fill) {
      fill.style.width = `${pct}%`;
      fill.className = `progress-fill ${fillClass}`;
    }
    if (status) {
      status.textContent = statusText;
      status.className = `file-status ${statusClass}`;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _isBusy() {
    return this._queue.some(item => item.status === 'uploading' || item.status === 'pending');
  }

  _isAllDone() {
    return this._queue.length > 0 &&
      this._queue.every(item => item.status === 'done' || item.status === 'error');
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosDocumentUpload);
