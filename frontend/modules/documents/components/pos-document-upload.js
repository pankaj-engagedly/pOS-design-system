// pos-document-upload — drag-and-drop upload area + progress indicator

import { uploadDocument } from '../services/documents-api.js';
import store from '../store.js';

const TAG = 'pos-document-upload';

class PosDocumentUpload extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._dragging = false;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('dragover', (e) => { e.preventDefault(); this._setDragging(true); });
    this.shadow.addEventListener('dragleave', () => this._setDragging(false));
    this.shadow.addEventListener('drop', (e) => { e.preventDefault(); this._setDragging(false); this._handleFiles(e.dataTransfer.files); });
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  _setDragging(val) {
    this._dragging = val;
    this.render();
  }

  render() {
    const { uploading, uploadProgress } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .drop-area {
          border: 2px dashed var(--pos-color-border-default);
          border-radius: 8px; padding: 24px; text-align: center;
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
          color: var(--pos-color-text-secondary); font-size: 13px;
        }
        .drop-area.dragging {
          border-color: var(--pos-color-action-primary);
          background: var(--pos-color-action-primary-subtle, #eff6ff);
        }
        .drop-area.uploading { pointer-events: none; opacity: 0.8; }
        .drop-icon { font-size: 28px; margin-bottom: 8px; }
        .pick-btn {
          display: inline-block; margin-top: 8px;
          background: var(--pos-color-action-primary); color: white;
          border: none; border-radius: 6px; padding: 6px 14px;
          cursor: pointer; font-size: 13px; font-family: inherit;
        }
        .progress-bar {
          height: 4px; border-radius: 2px; margin-top: 12px;
          background: var(--pos-color-background-secondary);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%; border-radius: 2px;
          background: var(--pos-color-action-primary);
          transition: width 0.2s;
        }
        input[type=file] { display: none; }
      </style>

      <div class="drop-area ${this._dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}">
        <div class="drop-icon">📎</div>
        ${uploading
          ? `<div>Uploading... ${uploadProgress}%</div><div class="progress-bar"><div class="progress-fill" style="width:${uploadProgress}%"></div></div>`
          : `<div>Drop files here to upload</div><button class="pick-btn" data-action="pick">Choose Files</button>`
        }
      </div>
      <input type="file" id="file-input" multiple />
    `;

    // Bind file input change listener directly after each render.
    // Cannot use a MutationObserver on document.body because this element lives
    // inside a shadow root — document.querySelectorAll() does not pierce shadow
    // boundaries, so the observer callback would never find the input.
    const input = this.shadow.getElementById('file-input');
    if (input) {
      input.addEventListener('change', (e) => this._handleFiles(e.target.files));
    }
  }

  _handleClick(e) {
    if (e.target.dataset.action === 'pick') {
      this.shadow.getElementById('file-input')?.click();
    }
  }

  async _handleFiles(files) {
    if (!files?.length) return;
    const { currentFolderId } = store.getState();

    for (const file of files) {
      store.setState({ uploading: true, uploadProgress: 0 });
      try {
        const doc = await uploadDocument({
          file,
          folderId: currentFolderId,
          onProgress: (p) => store.setState({ uploadProgress: p }),
        });
        store.setState({ uploading: false, uploadProgress: 0 });
        this.dispatchEvent(new CustomEvent('upload-complete', {
          detail: { document: doc },
          bubbles: true, composed: true,
        }));
      } catch (e) {
        store.setState({ uploading: false, uploadProgress: 0 });
        alert(`Upload failed: ${e.message}`);
      }
    }
  }
}

customElements.define(TAG, PosDocumentUpload);
