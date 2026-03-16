// pos-documents-recent-app — recently accessed documents page

import { getRecentDocuments } from '../services/documents-api.js';
import { navigate } from '../../../shared/services/router.js';

const TAG = 'pos-documents-recent-app';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fileIcon(contentType) {
  if (!contentType) return '📄';
  if (contentType.includes('pdf')) return '📕';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('spreadsheet') || contentType.includes('csv')) return '📊';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('zip') || contentType.includes('archive')) return '🗜️';
  return '📄';
}

class PosDocumentsRecentApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._items = [];
    this._loading = true;
    this._error = null;
  }

  async connectedCallback() {
    this.render();
    await this._load();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
  }

  async _load() {
    this._loading = true;
    this._error = null;
    this.render();
    try {
      this._items = await getRecentDocuments(50);
    } catch (e) {
      this._error = e.message;
    }
    this._loading = false;
    this.render();
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--pos-color-background-primary); }
        .header {
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--pos-color-border-default);
          display: flex; align-items: center; justify-content: space-between;
        }
        .header h2 { margin: 0; font-size: 16px; }
        .header-actions { display: flex; gap: 8px; align-items: center; }
        .back-btn {
          background: none; border: 1px solid var(--pos-color-border-default);
          border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 13px;
          color: var(--pos-color-text-secondary); font-family: inherit;
        }
        .back-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-background-secondary); }
        .count { font-size: 13px; color: var(--pos-color-text-secondary); }
        .scroll { flex: 1; overflow-y: auto; }
        .empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 200px;
          color: var(--pos-color-text-secondary); gap: 8px; font-size: 14px;
        }
        .empty-icon { font-size: 40px; }
        .list-header, .list-row {
          display: grid;
          grid-template-columns: 1fr 100px 80px;
          padding: 8px 20px; gap: 8px; align-items: center; font-size: 13px;
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
        .time { color: var(--pos-color-text-secondary); font-size: 12px; }
        .download-btn {
          background: none; border: none; cursor: pointer; font-size: 14px;
          color: var(--pos-color-text-secondary); padding: 2px 4px;
        }
        .download-btn:hover { color: var(--pos-color-action-primary); }
      </style>

      <div class="header">
        <h2>Recent Documents</h2>
        <div class="header-actions">
          ${!this._loading ? `<span class="count">${this._items.length} item${this._items.length !== 1 ? 's' : ''}</span>` : ''}
          <button class="back-btn" data-action="back">← All Documents</button>
        </div>
      </div>

      <div class="scroll">
        ${this._loading ? '<div class="empty"><div class="empty-icon">⏳</div><p>Loading...</p></div>' : ''}
        ${!this._loading && this._error ? `<div class="empty"><div class="empty-icon">⚠️</div><p>Failed to load: ${this._escapeHtml(this._error)}</p></div>` : ''}
        ${!this._loading && !this._error && this._items.length === 0 ? `
          <div class="empty">
            <div class="empty-icon">🕐</div>
            <p>No recently accessed documents</p>
          </div>
        ` : ''}
        ${!this._loading && !this._error && this._items.length > 0 ? `
          <div class="list-header">
            <div>Name</div><div>Accessed</div><div></div>
          </div>
          ${this._items.map(item => `
            <div class="list-row" data-attachment-id="${item.attachment_id || ''}">
              <div class="doc-name">
                <span>${fileIcon(item.content_type)}</span>
                <span class="doc-name-text">${this._escapeHtml(item.name)}</span>
              </div>
              <div class="time">${formatDate(item.accessed_at)}</div>
              <div>
                ${item.attachment_id ? `
                  <button class="download-btn" data-action="download" data-attachment-id="${item.attachment_id}" title="Download">⬇</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}
      </div>
    `;
  }

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') {
      navigate('#/documents');
      return;
    }
    if (action === 'download') {
      const attachmentId = e.target.closest('[data-attachment-id]').dataset.attachmentId;
      window.open(`/api/attachments/${attachmentId}/download`, '_blank');
      return;
    }
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosDocumentsRecentApp);
