// pos-document-home — Home/lobby view for the documents module
// Shows: folder cards + recently accessed docs

import { icon, fileTypeIcon } from '../../../shared/utils/icons.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';
import '../../../shared/components/pos-page-header.js';


function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function starIcon(isFavourite, size = 13) {
  const color = isFavourite ? '#f59e0b' : 'var(--pos-color-text-tertiary, #94a3b8)';
  const fill = isFavourite ? 'currentColor' : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" style="color:${color};display:block">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

class PosDocumentHome extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._recentDocuments = [];
    this._rootFolders = [];
  }

  set recentDocuments(val) { this._recentDocuments = val || []; this._render(); }
  set rootFolders(val) { this._rootFolders = val || []; this._render(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const recent = this._recentDocuments.slice(0, 8);
    const folders = this._rootFolders;

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow-y: auto;
        }
        .body {
          padding: var(--pos-space-lg) var(--pos-space-xl);
          flex: 1;
        }


        .section + .section { margin-top: var(--pos-space-xl); }
        .section-title {
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--pos-color-text-secondary);
          margin: 0 0 var(--pos-space-sm);
        }

        /* Folder cards grid */
        .folder-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: var(--pos-space-sm);
        }
        .folder-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: var(--pos-space-md) var(--pos-space-sm);
          border-radius: var(--pos-radius-md);
          border: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-primary);
          cursor: pointer;
          text-align: center;
          transition: background 0.1s, border-color 0.1s;
        }
        .folder-card:hover {
          background: var(--pos-color-background-secondary);
          border-color: var(--pos-color-action-primary);
        }
        .folder-card-icon { display: flex; align-items: center; justify-content: center; color: var(--pos-color-action-primary); }
        .folder-card-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-medium);
          color: var(--pos-color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }
        .folder-card-meta {
          font-size: 11px;
          color: var(--pos-color-text-secondary);
        }

        /* Recent docs list */
        .recent-list { display: flex; flex-direction: column; gap: 2px; }
        .recent-item {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 7px var(--pos-space-sm);
          border-radius: var(--pos-radius-sm);
          cursor: pointer;
          transition: background 0.1s;
        }
        .recent-item:hover { background: var(--pos-color-background-secondary); }
        .recent-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--pos-color-text-secondary); }
        .recent-name {
          flex: 1;
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .recent-time {
          font-size: 11px;
          color: var(--pos-color-text-secondary);
          flex-shrink: 0;
        }
        .comment-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; color: var(--pos-color-text-tertiary, #94a3b8);
          flex-shrink: 0;
        }
        .recent-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.1s;
        }
        .recent-item:hover .recent-actions { opacity: 1; }
        .recent-action-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          padding: 3px;
          border-radius: var(--pos-radius-sm);
          display: flex;
          align-items: center;
          line-height: 0;
        }
        .recent-action-btn:hover {
          background: var(--pos-color-border-default);
          color: var(--pos-color-text-primary);
        }
        .recent-star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 3px;
          border-radius: var(--pos-radius-sm);
          display: flex;
          align-items: center;
          flex-shrink: 0;
          line-height: 0;
        }
        .recent-star-btn:hover { background: var(--pos-color-border-default); }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 60px var(--pos-space-xl);
          color: var(--pos-color-text-secondary);
          text-align: center;
        }
        .empty-icon { display: flex; align-items: center; justify-content: center; color: var(--pos-color-text-secondary); }
        .empty-state p { margin: 0; font-size: var(--pos-font-size-sm); }
        .upload-cta {
          margin-top: var(--pos-space-sm);
          display: inline-flex;
          align-items: center;
          gap: var(--pos-space-xs);
          padding: 8px 16px;
          background: var(--pos-color-action-primary);
          color: white;
          border: none;
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
        }
        .upload-cta:hover { opacity: 0.9; }
      </style>

      <pos-page-header>
        Home
        <span slot="subtitle">${folders.length} folder${folders.length !== 1 ? 's' : ''} · ${recent.length} recently accessed</span>
      </pos-page-header>

      <div class="body">
      ${folders.length > 0 ? `
        <div class="section">
          <div class="section-title">Folders</div>
          <div class="folder-grid">
            ${folders.map(f => `
              <div class="folder-card" data-folder-id="${f.id}" data-folder-name="${this._esc(f.name)}">
                <div class="folder-card-icon">${icon('folder', 30)}</div>
                <div class="folder-card-name">${this._esc(f.name)}</div>
                <div class="folder-card-meta">${f.document_count || 0} doc${(f.document_count || 0) !== 1 ? 's' : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${recent.length > 0 ? `
        <div class="section">
          <div class="section-title">Recently Accessed</div>
          <div class="recent-list">
            ${recent.map(d => `
              <div class="recent-item" data-doc-id="${d.id}">
                <span class="recent-icon">${fileTypeIcon(d.content_type, 16)}</span>
                <span class="recent-name">${this._esc(d.name)}</span>
                ${d.comment_count ? `<span class="comment-badge" title="${d.comment_count} comment${d.comment_count !== 1 ? 's' : ''}">${icon('message-circle', 11)} ${d.comment_count}</span>` : ''}
                <span class="recent-time">${relativeTime(d.accessed_at)}</span>
                <button class="recent-star-btn" data-action="toggle-favourite"
                        data-doc-id="${d.id}" data-is-favourite="${d.is_favourite ? '1' : '0'}"
                        title="${d.is_favourite ? 'Remove from favourites' : 'Add to favourites'}">
                  ${starIcon(d.is_favourite, 13)}
                </button>
                <div class="recent-actions">
                  <button class="recent-action-btn" data-action="download"
                          data-attachment-id="${d.attachment_id}" data-doc-name="${this._esc(d.name)}" title="Download">
                    ${icon('download', 13)}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${folders.length === 0 && recent.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">${icon('folder-open', 48)}</div>
          <p>No documents yet</p>
          <button class="upload-cta" data-action="upload">
            ${icon('upload', 14)} Upload your first document
          </button>
        </div>
      ` : ''}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn?.dataset.action === 'download') {
        e.stopPropagation();
        this._downloadWithAuth(actionBtn.dataset.attachmentId, actionBtn.dataset.docName);
        return;
      }
      if (actionBtn?.dataset.action === 'upload') {
        this.dispatchEvent(new CustomEvent('open-upload', { bubbles: true, composed: true }));
        return;
      }
      if (actionBtn?.dataset.action === 'toggle-favourite') {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('toggle-favourite', {
          bubbles: true, composed: true,
          detail: {
            documentId: actionBtn.dataset.docId,
            isFavourite: actionBtn.dataset.isFavourite === '1',
          },
        }));
        return;
      }

      const folderCard = e.target.closest('[data-folder-id]');
      if (folderCard) {
        this.dispatchEvent(new CustomEvent('folder-select', {
          bubbles: true, composed: true,
          detail: { folderId: folderCard.dataset.folderId, folderName: folderCard.dataset.folderName },
        }));
        return;
      }

      const docItem = e.target.closest('[data-doc-id]');
      if (docItem && !e.target.closest('[data-action]')) {
        this.dispatchEvent(new CustomEvent('document-selected', {
          bubbles: true, composed: true,
          detail: { documentId: docItem.dataset.docId },
        }));
      }
    });
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

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-document-home', PosDocumentHome);
