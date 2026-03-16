// pos-document-list — list/grid toggle view of documents

import { getDocuments, deleteDocument } from '../services/documents-api.js';
import store from '../store.js';

const TAG = 'pos-document-list';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileIcon(contentType) {
  if (!contentType) return '📄';
  if (contentType.includes('pdf')) return '📕';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('spreadsheet') || contentType.includes('csv')) return '📊';
  if (contentType.includes('presentation')) return '📊';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('zip') || contentType.includes('archive')) return '🗜️';
  return '📄';
}

class PosDocumentList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    await this._load();
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this._unsub = store.subscribe((state) => {
      this.render();
    });
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _load() {
    const { currentFolderId, tagFilter } = store.getState();
    store.setState({ loading: true });
    try {
      const docs = await getDocuments({
        folder_id: currentFolderId,
        tag: tagFilter,
      });
      store.setState({ documents: docs, loading: false });
    } catch (e) {
      store.setState({ loading: false, error: e.message });
    }
  }

  render() {
    const { documents, viewMode, loading } = store.getState();

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 16px; border-bottom: 1px solid var(--pos-color-border-default);
        }
        .toolbar-left { flex: 1; }
        .view-toggle { display: flex; gap: 4px; }
        .view-btn {
          background: none; border: 1px solid var(--pos-color-border-default);
          border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 14px;
          color: var(--pos-color-text-secondary);
        }
        .view-btn.active { background: var(--pos-color-action-primary); color: #fff; border-color: var(--pos-color-action-primary); }
        .upload-btn {
          background: var(--pos-color-action-primary); color: white;
          border: none; border-radius: 6px; padding: 6px 14px;
          cursor: pointer; font-size: 13px; font-family: inherit;
        }
        .upload-btn:hover { opacity: 0.9; }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
          flex: 1; color: var(--pos-color-text-secondary); gap: 8px; }

        /* List view */
        .list-header, .list-row {
          display: grid;
          grid-template-columns: 1fr 80px 100px 100px 60px;
          padding: 8px 16px; gap: 8px; align-items: center;
          font-size: 13px;
        }
        .list-header {
          border-bottom: 1px solid var(--pos-color-border-default);
          color: var(--pos-color-text-secondary); font-size: 11px;
          font-weight: 600; text-transform: uppercase;
        }
        .list-row {
          border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9);
          cursor: pointer;
        }
        .list-row:hover { background: var(--pos-color-background-secondary); }
        .doc-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .doc-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .doc-actions { display: flex; gap: 4px; justify-content: flex-end; }
        .action-btn {
          background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;
          color: var(--pos-color-text-secondary); border-radius: 4px;
        }
        .action-btn:hover { background: var(--pos-color-background-primary); }

        /* Grid view */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 16px; }
        .grid-card {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 16px 8px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary);
          text-align: center;
        }
        .grid-card:hover { background: var(--pos-color-background-secondary); }
        .grid-icon { font-size: 32px; }
        .grid-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }

        .scroll { flex: 1; overflow-y: auto; }
      </style>

      <div class="toolbar">
        <div class="toolbar-left">
          <span style="font-size:13px;color:var(--pos-color-text-secondary)">${documents.length} document${documents.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="view-toggle">
          <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="set-view" data-view="list">☰</button>
          <button class="view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="set-view" data-view="grid">⊞</button>
        </div>
        <button class="upload-btn" data-action="upload">↑ Upload</button>
      </div>

      <div class="scroll">
        ${loading ? '<div class="empty">Loading...</div>' : ''}
        ${!loading && documents.length === 0 ? '<div class="empty"><div style="font-size:40px">📂</div><p>No documents yet</p></div>' : ''}
        ${!loading && documents.length > 0 && viewMode === 'list' ? this._renderList(documents) : ''}
        ${!loading && documents.length > 0 && viewMode === 'grid' ? this._renderGrid(documents) : ''}
      </div>
    `;
  }

  _renderList(docs) {
    return `
      <div class="list-header">
        <div>Name</div><div>Type</div><div>Size</div><div>Modified</div><div></div>
      </div>
      ${docs.map(d => `
        <div class="list-row" data-doc-id="${d.id}">
          <div class="doc-name">
            <span>${fileIcon(d.content_type)}</span>
            <span class="doc-name-text">${this._escapeHtml(d.name)}</span>
          </div>
          <div>${d.content_type?.split('/')[1] || '—'}</div>
          <div>${formatBytes(d.file_size)}</div>
          <div>${formatDate(d.updated_at)}</div>
          <div class="doc-actions">
            <button class="action-btn" data-action="download" data-attachment-id="${d.attachment_id}" title="Download">⬇</button>
            <button class="action-btn" data-action="delete" data-doc-id="${d.id}" title="Delete">🗑</button>
          </div>
        </div>
      `).join('')}
    `;
  }

  _renderGrid(docs) {
    return `
      <div class="grid">
        ${docs.map(d => `
          <div class="grid-card" data-doc-id="${d.id}">
            <div class="grid-icon">${fileIcon(d.content_type)}</div>
            <div class="grid-name">${this._escapeHtml(d.name)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset;
    if (!action) return;

    if (action.action === 'set-view') {
      store.setState({ viewMode: action.view });
      return;
    }

    if (action.action === 'upload') {
      this.dispatchEvent(new CustomEvent('open-upload', { bubbles: true, composed: true }));
      return;
    }

    if (action.action === 'download') {
      window.open(`/api/attachments/${action.attachmentId}/download`, '_blank');
      return;
    }

    if (action.action === 'delete') {
      if (!confirm('Delete this document?')) return;
      try {
        await deleteDocument(action.docId);
        await this._load();
      } catch (e) {
        alert('Failed to delete document');
      }
      return;
    }

    // Click on list row or grid card
    const docEl = e.target.closest('[data-doc-id]');
    if (docEl && !e.target.closest('[data-action]')) {
      store.setState({ selectedDocumentId: docEl.dataset.docId });
      this.dispatchEvent(new CustomEvent('document-selected', {
        detail: { documentId: docEl.dataset.docId },
        bubbles: true, composed: true,
      }));
    }
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosDocumentList);
