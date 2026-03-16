// pos-documents-shared-app — shared-with-me documents page

import { getSharedWithMe } from '../services/documents-api.js';

const TAG = 'pos-documents-shared-app';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

class PosDocumentsSharedApp extends HTMLElement {
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
  }

  async _load() {
    this._loading = true;
    this._error = null;
    this.render();
    try {
      this._items = await getSharedWithMe();
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
          grid-template-columns: 1fr 140px 100px;
          padding: 8px 20px; gap: 8px; align-items: center; font-size: 13px;
        }
        .list-header {
          border-bottom: 1px solid var(--pos-color-border-default);
          color: var(--pos-color-text-secondary); font-size: 11px;
          font-weight: 600; text-transform: uppercase;
        }
        .list-row {
          border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9);
          cursor: default;
        }
        .list-row:hover { background: var(--pos-color-background-secondary); }
        .doc-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .doc-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .download-btn {
          background: none; border: 1px solid var(--pos-color-border-default);
          border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px;
          color: var(--pos-color-text-secondary); font-family: inherit;
        }
        .download-btn:hover { color: var(--pos-color-action-primary); border-color: var(--pos-color-action-primary); }
      </style>

      <div class="header">
        <h2>Shared with Me</h2>
        ${!this._loading ? `<span class="count">${this._items.length} item${this._items.length !== 1 ? 's' : ''}</span>` : ''}
      </div>

      <div class="scroll">
        ${this._loading ? '<div class="empty"><div class="empty-icon">⏳</div><p>Loading...</p></div>' : ''}
        ${!this._loading && this._error ? `<div class="empty"><div class="empty-icon">⚠️</div><p>Failed to load: ${this._escapeHtml(this._error)}</p></div>` : ''}
        ${!this._loading && !this._error && this._items.length === 0 ? `
          <div class="empty">
            <div class="empty-icon">🤝</div>
            <p>Nothing shared with you yet</p>
          </div>
        ` : ''}
        ${!this._loading && !this._error && this._items.length > 0 ? `
          <div class="list-header">
            <div>Name</div><div>Shared by</div><div></div>
          </div>
          ${this._items.map(item => `
            <div class="list-row">
              <div class="doc-name">
                <span>${item.document ? fileIcon(item.document?.content_type) : '📁'}</span>
                <span class="doc-name-text">${this._escapeHtml(item.document?.name || item.folder?.name || 'Unknown')}</span>
              </div>
              <div style="font-size:12px;color:var(--pos-color-text-secondary)">${this._escapeHtml(item.owner_email || '')}</div>
              <div>
                ${item.document?.attachment_id ? `
                  <button class="download-btn" onclick="window.open('/api/attachments/${item.document.attachment_id}/download','_blank')">⬇ Download</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}
      </div>
    `;
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosDocumentsSharedApp);
