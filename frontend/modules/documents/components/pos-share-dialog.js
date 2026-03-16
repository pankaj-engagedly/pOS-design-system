// pos-share-dialog — sharing management dialog

import { createShare, getShares, revokeShare } from '../services/documents-api.js';

const TAG = 'pos-share-dialog';

class PosShareDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._shares = [];
    this._documentId = null;
    this._folderId = null;
    this._loading = false;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('submit', (e) => this._handleSubmit(e));
  }

  async openForDocument(documentId) {
    this._documentId = documentId;
    this._folderId = null;
    this._open = true;
    this.render();
    await this._loadShares();
  }

  async openForFolder(folderId) {
    this._folderId = folderId;
    this._documentId = null;
    this._open = true;
    this.render();
    await this._loadShares();
  }

  async _loadShares() {
    this._loading = true;
    this.render();
    try {
      const all = await getShares();
      this._shares = all.filter(s =>
        (this._documentId && s.document_id === this._documentId) ||
        (this._folderId && s.folder_id === this._folderId)
      );
    } catch (e) {
      console.error('Failed to load shares', e);
    }
    this._loading = false;
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
          background: var(--pos-color-background-primary);
          border-radius: 12px; padding: 24px; width: 400px; max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        h3 { margin: 0 0 16px; font-size: 16px; }
        .share-form { display: flex; gap: 8px; margin-bottom: 16px; }
        .email-input {
          flex: 1; padding: 8px 12px; border: 1px solid var(--pos-color-border-default);
          border-radius: 6px; font-size: 13px; font-family: inherit;
          background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary);
        }
        .share-btn {
          background: var(--pos-color-action-primary); color: white;
          border: none; border-radius: 6px; padding: 8px 14px;
          cursor: pointer; font-size: 13px; font-family: inherit;
        }
        .share-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; max-height: 200px; overflow-y: auto; }
        .share-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px; border-radius: 6px; background: var(--pos-color-background-secondary);
          font-size: 13px;
        }
        .revoke-btn {
          background: none; border: 1px solid var(--pos-color-border-default);
          border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px;
          color: var(--pos-color-text-secondary);
        }
        .revoke-btn:hover { color: #ef4444; border-color: #ef4444; }
        .close-btn {
          background: none; border: 1px solid var(--pos-color-border-default);
          border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px;
          font-family: inherit; float: right;
        }
        .empty-shares { color: var(--pos-color-text-secondary); font-size: 13px; font-style: italic; }
      </style>

      <div class="overlay" data-action="close-overlay">
        <div class="dialog">
          <h3>Share ${this._documentId ? 'Document' : 'Folder'}</h3>
          <form class="share-form">
            <input class="email-input" type="email" placeholder="Email address" required />
            <button class="share-btn" type="submit">Share</button>
          </form>
          <div class="share-list">
            ${this._loading ? '<div class="empty-shares">Loading...</div>' : ''}
            ${!this._loading && this._shares.length === 0 ? '<div class="empty-shares">Not shared with anyone yet</div>' : ''}
            ${this._shares.map(s => `
              <div class="share-item">
                <span>Shared with user ${s.shared_with_user_id.slice(0, 8)}… (read)</span>
                <button class="revoke-btn" data-action="revoke" data-share-id="${s.id}">Remove</button>
              </div>
            `).join('')}
          </div>
          <button class="close-btn" data-action="close">Close</button>
        </div>
      </div>
    `;
  }

  async _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close' || action === 'close-overlay') {
      if (action === 'close-overlay' && !e.target.classList.contains('overlay')) return;
      this._open = false;
      this.render();
      return;
    }
    if (action === 'revoke') {
      const shareId = e.target.closest('[data-share-id]').dataset.shareId;
      try {
        await revokeShare(shareId);
        await this._loadShares();
      } catch (e) {
        alert('Failed to revoke share');
      }
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();
    const email = this.shadow.querySelector('.email-input').value.trim();
    if (!email) return;
    try {
      await createShare({
        email,
        document_id: this._documentId,
        folder_id: this._folderId,
      });
      this.shadow.querySelector('.email-input').value = '';
      await this._loadShares();
    } catch (e) {
      alert('Failed to share: ' + (e.message || 'Unknown error'));
    }
  }
}

customElements.define(TAG, PosShareDialog);
