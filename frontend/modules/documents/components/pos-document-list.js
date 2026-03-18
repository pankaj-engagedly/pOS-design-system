// pos-document-list — list/grid toggle view of documents

import { deleteDocument } from '../services/documents-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import { icon, fileTypeIcon } from '../../../shared/utils/icons.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';
import '../../../shared/components/pos-page-header.js';
import store from '../store.js';

const TAG = 'pos-document-list';

function starIcon(isFavourite, size = 14) {
  const color = isFavourite ? '#f59e0b' : 'var(--pos-color-text-tertiary, #94a3b8)';
  const fill = isFavourite ? 'currentColor' : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" style="color:${color};display:block">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

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

function formatType(ct) {
  if (!ct) return '—';
  if (ct.includes('pdf')) return 'PDF';
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct === 'application/vnd.ms-excel') return 'Excel';
  if (ct.includes('wordprocessingml') || ct === 'application/msword') return 'Word';
  if (ct.includes('presentation') || ct.includes('powerpoint')) return 'PowerPoint';
  if (ct.includes('zip') || ct.includes('archive') || ct.includes('compressed')) return 'Archive';
  if (ct.startsWith('image/')) return ct.split('/')[1]?.toUpperCase() || 'Image';
  if (ct.startsWith('video/')) return 'Video';
  if (ct.startsWith('audio/')) return 'Audio';
  if (ct.startsWith('text/')) return ct.split('/')[1] || 'Text';
  if (ct === 'application/json') return 'JSON';
  if (ct === 'application/xml') return 'XML';
  return ct.split('/')[1] || ct;
}


class PosDocumentList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._title = '';
    this._folderPath = [];
  }

  set listTitle(val) { this._title = val || ''; this.render(); }
  set folderPath(val) { this._folderPath = Array.isArray(val) ? val : []; this.render(); }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  render() {
    const { documents, childFolders, viewMode, loading } = store.getState();
    const folders = childFolders || [];

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; flex: 1; min-width: 0; }

        .view-btn {
          background: none;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          padding: 4px 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--pos-color-text-secondary);
          line-height: 1;
        }
        .view-btn.active {
          background: var(--pos-color-action-primary);
          color: #fff;
          border-color: var(--pos-color-action-primary);
        }
        .upload-btn {
          background: var(--pos-color-action-primary);
          color: white;
          border: none;
          border-radius: var(--pos-radius-sm);
          padding: 5px 12px;
          cursor: pointer;
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
        }
        .upload-btn:hover { opacity: 0.9; }

        .empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; flex: 1;
          color: var(--pos-color-text-secondary); gap: 8px;
        }

        /* List view */
        .list-header, .list-row {
          display: grid;
          grid-template-columns: 1fr 80px 100px 100px 80px;
          padding: 8px 16px; gap: 8px; align-items: center; font-size: 13px;
        }
        .list-header {
          border-bottom: 1px solid var(--pos-color-border-default);
          color: var(--pos-color-text-secondary); font-size: 11px;
          font-weight: 600; text-transform: uppercase;
        }
        .list-row { border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9); cursor: pointer; }
        .list-row:hover { background: var(--pos-color-background-secondary); }
        .doc-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .doc-name-text {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          cursor: pointer;
        }
        .doc-name-text:hover {
          color: var(--pos-color-action-primary);
          text-decoration: underline;
        }
        .doc-actions { display: flex; gap: 4px; justify-content: flex-end; }
        .action-btn {
          background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;
          color: var(--pos-color-text-secondary); border-radius: 4px;
          display: flex; align-items: center;
        }
        .action-btn:hover { background: var(--pos-color-background-primary); }
        .star-btn {
          background: none; border: none; cursor: pointer; padding: 2px 3px;
          border-radius: 4px; display: flex; align-items: center; flex-shrink: 0;
          line-height: 0;
        }
        .star-btn:hover { background: var(--pos-color-background-secondary); }
        .comment-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; color: var(--pos-color-text-tertiary, #94a3b8);
          flex-shrink: 0; margin-left: 2px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--pos-color-text-secondary);
          padding: 16px 16px 6px;
        }

        /* Folder rows in list view */
        .folder-row {
          display: grid;
          grid-template-columns: 1fr 80px 100px 100px 80px;
          padding: 8px 16px; gap: 8px; align-items: center; font-size: 13px;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9);
          cursor: pointer;
        }
        .folder-row:hover { background: var(--pos-color-background-secondary); }
        .folder-name {
          display: flex; align-items: center; gap: 8px; min-width: 0;
          color: var(--pos-color-text-primary); font-weight: 500;
        }
        .folder-name-icon { display: flex; align-items: center; color: var(--pos-color-action-primary); flex-shrink: 0; }
        .folder-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .folder-meta { color: var(--pos-color-text-secondary); font-size: 12px; }

        /* Folder card in grid view */
        .grid-folder-card {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 16px 8px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary); text-align: center;
        }
        .grid-folder-card:hover { background: var(--pos-color-background-secondary); }
        .grid-folder-icon { display: flex; align-items: center; color: var(--pos-color-action-primary); }
        .grid-folder-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
        .grid-folder-meta { font-size: 10px; color: var(--pos-color-text-secondary); }

        /* Grid view */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 16px; }
        .grid-card {
          position: relative;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 16px 8px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary); text-align: center;
        }
        .grid-card:hover { background: var(--pos-color-background-secondary); }
        .grid-icon { display: flex; align-items: center; justify-content: center; color: var(--pos-color-text-secondary); }
        .grid-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
        .grid-actions {
          position: absolute; top: 4px; right: 4px;
          display: none; gap: 2px;
        }
        .grid-card:hover .grid-actions { display: flex; }
        .grid-star {
          position: absolute; top: 4px; left: 4px;
          line-height: 0;
        }
        .grid-action-btn {
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: 4px; cursor: pointer; padding: 3px;
          color: var(--pos-color-text-secondary);
          display: flex; align-items: center;
        }
        .grid-action-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
        .grid-star-btn {
          background: none; border: none; cursor: pointer; padding: 2px;
          border-radius: 4px; display: flex; align-items: center; line-height: 0;
        }
        .grid-star-btn:hover { background: var(--pos-color-border-default); }

        .scroll { flex: 1; overflow-y: auto; }

        /* Breadcrumb in header */
        .breadcrumb-link {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-size: inherit;
          font-family: inherit;
          color: var(--pos-color-text-secondary);
        }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-sep {
          color: var(--pos-color-text-secondary);
          opacity: 0.5;
          display: inline-flex;
          align-items: center;
          padding: 0 2px;
          vertical-align: middle;
        }
      </style>

      <pos-page-header>
        ${this._renderTitle()}
        <span slot="subtitle">${folders.length > 0 ? `${folders.length} folder${folders.length !== 1 ? 's' : ''} · ` : ''}${documents.length} file${documents.length !== 1 ? 's' : ''}</span>
        <div slot="actions">
          <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" data-action="set-view" data-view="list" title="List view">☰</button>
          <button class="view-btn ${viewMode === 'grid' ? 'active' : ''}" data-action="set-view" data-view="grid" title="Grid view">⊞</button>
          <button class="upload-btn" data-action="upload">${icon('upload', 14)} Upload</button>
        </div>
      </pos-page-header>

      <div class="scroll">
        ${loading ? '<div class="empty">Loading...</div>' : ''}
        ${!loading && folders.length === 0 && documents.length === 0 ? `<div class="empty"><div style="color:var(--pos-color-text-secondary)">${icon('folder', 40)}</div><p>This folder is empty</p></div>` : ''}
        ${!loading && folders.length > 0 ? `
          <div class="section-title">Folders</div>
          ${viewMode === 'list' ? this._renderFolderRows(folders) : this._renderFolderGrid(folders)}
        ` : ''}
        ${!loading && documents.length > 0 ? `
          <div class="section-title">Files</div>
          ${viewMode === 'list' ? this._renderList(documents) : this._renderGrid(documents)}
        ` : ''}
      </div>
    `;
  }

  _renderTitle() {
    // Smart views (Recent, Favourites) — just show the view name
    if (!this._folderPath || this._folderPath.length === 0) {
      return this._escapeHtml(this._title);
    }

    // Folder view — breadcrumb: parent folders are clickable links, current folder is plain text
    const sep = `<span class="breadcrumb-sep">${icon('chevron-right', 12)}</span>`;

    // Ancestor folders (all but last) are clickable
    const ancestors = this._folderPath.slice(0, -1).map(item =>
      `<button class="breadcrumb-link" data-action="breadcrumb-folder" data-folder-id="${item.id}" data-folder-name="${this._escapeHtml(item.name)}">${this._escapeHtml(item.name)}</button>${sep}`
    ).join('');

    // Current folder (last) — plain text, rendered as the main title
    const last = this._folderPath[this._folderPath.length - 1];

    return `${ancestors}${this._escapeHtml(last.name)}`;
  }

  _renderFolderRows(folders) {
    return folders.map(f => `
      <div class="folder-row" data-folder-id="${f.id}" data-folder-name="${this._escapeAttr(f.name)}">
        <div class="folder-name">
          <span class="folder-name-icon">${icon('folder', 16)}</span>
          <span class="folder-name-text">${this._escapeHtml(f.name)}</span>
        </div>
        <div class="folder-meta">Folder</div>
        <div class="folder-meta">${f.document_count || 0} file${(f.document_count || 0) !== 1 ? 's' : ''}</div>
        <div></div>
        <div></div>
      </div>
    `).join('');
  }

  _renderFolderGrid(folders) {
    return `
      <div class="grid">
        ${folders.map(f => `
          <div class="grid-folder-card" data-folder-id="${f.id}" data-folder-name="${this._escapeAttr(f.name)}">
            <div class="grid-folder-icon">${icon('folder', 32)}</div>
            <div class="grid-folder-name">${this._escapeHtml(f.name)}</div>
            <div class="grid-folder-meta">${f.document_count || 0} file${(f.document_count || 0) !== 1 ? 's' : ''}</div>
          </div>
        `).join('')}
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
            <button class="star-btn" data-action="toggle-favourite" data-doc-id="${d.id}" data-is-favourite="${d.is_favourite ? '1' : '0'}" title="${d.is_favourite ? 'Remove from favourites' : 'Add to favourites'}">
              ${starIcon(d.is_favourite, 14)}
            </button>
            <span style="display:flex;align-items:center;color:var(--pos-color-text-secondary);flex-shrink:0">${fileTypeIcon(d.content_type, 16)}</span>
            <span class="doc-name-text">${this._escapeHtml(d.name)}</span>
            ${d.comment_count ? `<span class="comment-badge" title="${d.comment_count} comment${d.comment_count !== 1 ? 's' : ''}">${icon('message-circle', 12)} ${d.comment_count}</span>` : ''}
          </div>
          <div>${formatType(d.content_type)}</div>
          <div>${formatBytes(d.file_size)}</div>
          <div>${formatDate(d.updated_at)}</div>
          <div class="doc-actions">
            <button class="action-btn" data-action="download" data-attachment-id="${d.attachment_id}" data-doc-name="${this._escapeAttr(d.name)}" title="Download">${icon('download', 14)}</button>
            <button class="action-btn" data-action="move" data-doc-id="${d.id}" data-doc-name="${this._escapeAttr(d.name)}" data-folder-id="${d.folder_id || ''}" title="Move to folder">${icon('folder-input', 14)}</button>
            <button class="action-btn" data-action="delete" data-doc-id="${d.id}" title="Delete">${icon('trash-2', 14)}</button>
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
            <div class="grid-star">
              <button class="grid-star-btn" data-action="toggle-favourite" data-doc-id="${d.id}" data-is-favourite="${d.is_favourite ? '1' : '0'}" title="${d.is_favourite ? 'Remove from favourites' : 'Add to favourites'}">
                ${starIcon(d.is_favourite, 13)}
              </button>
            </div>
            <div class="grid-actions">
              <button class="grid-action-btn" data-action="download" data-attachment-id="${d.attachment_id}" data-doc-name="${this._escapeAttr(d.name)}" title="Download">${icon('download', 12)}</button>
              <button class="grid-action-btn" data-action="move" data-doc-id="${d.id}" data-doc-name="${this._escapeAttr(d.name)}" data-folder-id="${d.folder_id || ''}" title="Move to folder">${icon('folder-input', 12)}</button>
              <button class="grid-action-btn" data-action="delete" data-doc-id="${d.id}" title="Delete">${icon('trash-2', 12)}</button>
            </div>
            <div class="grid-icon">${fileTypeIcon(d.content_type, 32)}</div>
            <div class="grid-name">${this._escapeHtml(d.name)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset;
    if (!action) {
      // No action button — check for folder row click (navigate) or document row click (preview)
      const folderEl = e.target.closest('[data-folder-id]');
      if (folderEl) {
        this.dispatchEvent(new CustomEvent('folder-select', {
          detail: { folderId: folderEl.dataset.folderId, folderName: folderEl.dataset.folderName },
          bubbles: true, composed: true,
        }));
        return;
      }
      const docEl = e.target.closest('[data-doc-id]');
      if (docEl) {
        store.setState({ selectedDocumentId: docEl.dataset.docId });
        this.dispatchEvent(new CustomEvent('document-selected', {
          detail: { documentId: docEl.dataset.docId },
          bubbles: true, composed: true,
        }));
      }
      return;
    }

    if (action.action === 'breadcrumb-home') {
      this.dispatchEvent(new CustomEvent('breadcrumb-home', { bubbles: true, composed: true }));
      return;
    }

    if (action.action === 'breadcrumb-folder') {
      this.dispatchEvent(new CustomEvent('folder-select', {
        detail: { folderId: action.folderId, folderName: action.folderName },
        bubbles: true, composed: true,
      }));
      return;
    }

    if (action.action === 'set-view') {
      store.setState({ viewMode: action.view });
      return;
    }

    if (action.action === 'upload') {
      this.dispatchEvent(new CustomEvent('open-upload', { bubbles: true, composed: true }));
      return;
    }

    if (action.action === 'download') {
      this._downloadWithAuth(action.attachmentId, action.docName);
      return;
    }

    if (action.action === 'move') {
      this.dispatchEvent(new CustomEvent('move-document', {
        bubbles: true, composed: true,
        detail: {
          documentId: action.docId,
          documentName: action.docName,
          currentFolderId: action.folderId || null,
        },
      }));
      return;
    }

    if (action.action === 'toggle-favourite') {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('toggle-favourite', {
        bubbles: true, composed: true,
        detail: { documentId: action.docId, isFavourite: action.isFavourite === '1' },
      }));
      return;
    }

    if (action.action === 'delete') {
      if (!await confirmDialog('Delete this document?', { confirmLabel: 'Delete', danger: true })) return;
      try {
        await deleteDocument(action.docId);
        this.dispatchEvent(new CustomEvent('document-deleted', { bubbles: true, composed: true }));
      } catch (e) {
        alert('Failed to delete document');
      }
      return;
    }

  }

  async _downloadWithAuth(attachmentId, filename) {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download file');
    }
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define(TAG, PosDocumentList);
