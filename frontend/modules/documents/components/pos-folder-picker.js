// pos-folder-picker — dialog for selecting a destination folder (move documents)

import { getFolders, updateDocument } from '../services/documents-api.js';

const TAG = 'pos-folder-picker';

class PosFolderPicker extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._documentId = null;
    this._folders = [];
    this._selected = null;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
  }

  async openForDocument(documentId) {
    this._documentId = documentId;
    this._selected = null;
    this._open = true;
    const folders = await getFolders(null);
    this._folders = folders;
    this.render();
  }

  render() {
    if (!this._open) {
      this.shadow.innerHTML = '';
      return;
    }

    this.shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .dialog {
          background: var(--pos-color-background-primary); border-radius: 12px;
          padding: 24px; width: 360px; max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        h3 { margin: 0 0 16px; font-size: 16px; }
        .folder-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; margin-bottom: 16px; }
        .folder-opt {
          padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;
          display: flex; align-items: center; gap: 8px;
        }
        .folder-opt:hover { background: var(--pos-color-background-secondary); }
        .folder-opt.selected { background: var(--pos-color-action-primary-subtle, #eff6ff); font-weight: 500; }
        .actions { display: flex; gap: 8px; justify-content: flex-end; }
        .cancel-btn, .move-btn {
          border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; font-family: inherit;
        }
        .cancel-btn { background: none; border: 1px solid var(--pos-color-border-default); }
        .move-btn { background: var(--pos-color-action-primary); color: white; border: none; }
        .move-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .root-opt { padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .root-opt:hover { background: var(--pos-color-background-secondary); }
        .root-opt.selected { background: var(--pos-color-action-primary-subtle, #eff6ff); }
      </style>

      <div class="overlay">
        <div class="dialog">
          <h3>Move to Folder</h3>
          <div class="folder-list">
            <div class="root-opt ${this._selected === '' ? 'selected' : ''}" data-action="select" data-folder-id="">
              📂 Root (no folder)
            </div>
            ${this._folders.map(f => `
              <div class="folder-opt ${this._selected === f.id ? 'selected' : ''}" data-action="select" data-folder-id="${f.id}">
                📁 ${this._escapeHtml(f.name)}
              </div>
            `).join('')}
          </div>
          <div class="actions">
            <button class="cancel-btn" data-action="close">Cancel</button>
            <button class="move-btn" data-action="move" ${this._selected === null ? 'disabled' : ''}>Move Here</button>
          </div>
        </div>
      </div>
    `;
  }

  async _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') {
      this._open = false;
      this.render();
      return;
    }
    if (action === 'select') {
      const folderId = e.target.closest('[data-folder-id]').dataset.folderId;
      this._selected = folderId;
      this.render();
      return;
    }
    if (action === 'move') {
      if (this._selected === null) return;
      try {
        await updateDocument(this._documentId, {
          folder_id: this._selected || null,
        });
        this._open = false;
        this.render();
        this.dispatchEvent(new CustomEvent('document-moved', {
          bubbles: true, composed: true,
          detail: { documentId: this._documentId, folderId: this._selected || null },
        }));
      } catch (e) {
        alert('Failed to move document');
      }
    }
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosFolderPicker);
