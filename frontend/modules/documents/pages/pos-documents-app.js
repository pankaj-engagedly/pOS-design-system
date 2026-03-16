// pos-documents-app — main documents page: folder tree sidebar + document list + upload

import '../components/pos-folder-tree.js';
import '../components/pos-document-list.js';
import '../components/pos-document-upload.js';
import '../components/pos-share-dialog.js';
import '../components/pos-folder-picker.js';
import store from '../store.js';
import { getDocuments } from '../services/documents-api.js';

const TAG = 'pos-documents-app';

class PosDocumentsApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._showUpload = false;
    this._unsub = null;
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
    this._unsub = store.subscribe(() => this._onStoreChange());
    this._loadDocuments();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadDocuments() {
    const { currentFolderId, tagFilter } = store.getState();
    store.setState({ loading: true, error: null });
    try {
      const docs = await getDocuments({ folder_id: currentFolderId, tag: tagFilter });
      store.setState({ documents: docs, loading: false });
    } catch (e) {
      store.setState({ loading: false, error: e.message });
    }
  }

  _onStoreChange() {
    // re-render upload panel visibility only — child components handle their own updates
    const uploadArea = this.shadow.querySelector('.upload-panel');
    if (uploadArea) {
      uploadArea.style.display = this._showUpload ? 'block' : 'none';
    }
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          height: 100%;
          overflow: hidden;
          background: var(--pos-color-background-primary);
        }
        .sidebar {
          width: 220px;
          min-width: 220px;
          border-right: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .upload-panel {
          display: none;
          padding: 12px 16px;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        pos-document-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        pos-share-dialog, pos-folder-picker {
          position: fixed;
        }
      </style>

      <aside class="sidebar">
        <pos-folder-tree></pos-folder-tree>
      </aside>

      <div class="main">
        <div class="upload-panel">
          <pos-document-upload></pos-document-upload>
        </div>
        <pos-document-list></pos-document-list>
      </div>

      <pos-share-dialog></pos-share-dialog>
      <pos-folder-picker></pos-folder-picker>
    `;
  }

  _bindEvents() {
    // Folder selected — reload documents for that folder
    this.shadow.addEventListener('folder-selected', (e) => {
      store.setState({ currentFolderId: e.detail.folderId || null });
      this._loadDocuments();
    });

    // Toggle upload panel
    this.shadow.addEventListener('open-upload', () => {
      this._showUpload = !this._showUpload;
      const uploadArea = this.shadow.querySelector('.upload-panel');
      if (uploadArea) uploadArea.style.display = this._showUpload ? 'block' : 'none';
    });

    // Upload complete — reload list and hide upload area
    this.shadow.addEventListener('upload-complete', () => {
      this._showUpload = false;
      const uploadArea = this.shadow.querySelector('.upload-panel');
      if (uploadArea) uploadArea.style.display = 'none';
      this._loadDocuments();
    });

    // Document selected — open share or move dialogs as needed
    this.shadow.addEventListener('document-selected', (e) => {
      store.setState({ selectedDocumentId: e.detail.documentId });
    });

    // Open share dialog for a document
    this.shadow.addEventListener('share-document', (e) => {
      this.shadow.querySelector('pos-share-dialog')?.openForDocument(e.detail.documentId);
    });

    // Open move-to-folder picker
    this.shadow.addEventListener('move-document', (e) => {
      this.shadow.querySelector('pos-folder-picker')?.openForDocument(e.detail.documentId);
    });

    // Document moved — reload
    this.shadow.addEventListener('document-moved', () => {
      this._loadDocuments();
    });
  }
}

customElements.define(TAG, PosDocumentsApp);
