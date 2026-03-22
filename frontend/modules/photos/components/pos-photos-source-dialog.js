// pos-photos-source-dialog — Sync sources management panel
// Lists existing sources with status/actions + add new source form

import { icon } from '../../../shared/utils/icons.js';
import {
  getSources, createSource, deleteSource, updateSource, triggerSync, getProviders,
  getGoogleAuthUrl,
} from '../services/photos-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';

class PosPhotosSourceDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._sources = [];
    this._adding = false;
    this._provider = 'folder';
    this._error = null;
    this._submitting = false;
    this._providers = [
      { id: 'folder', name: 'Folder', available: true },
      { id: 'apple_photos', name: 'Apple Photos', available: true },
    ];
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  async open() {
    this._open = true;
    this._adding = false;
    this._error = null;
    this._submitting = false;
    await this._loadData();
    this._render();
  }

  close() {
    this._open = false;
    this._render();
  }

  async _loadData() {
    try {
      const [sources, provData] = await Promise.all([
        getSources().catch(() => []),
        getProviders().catch(() => null),
      ]);
      this._sources = sources;
      if (provData?.providers) this._providers = provData.providers;
    } catch { /* ignore */ }
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: ${this._open ? 'block' : 'none'}; }
        .backdrop {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
        }
        .dialog {
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          padding: var(--pos-space-lg);
          width: 500px;
          max-width: 90vw;
          max-height: 80vh;
          overflow-y: auto;
        }
        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--pos-space-md);
        }
        h3 {
          margin: 0;
          font-size: var(--pos-font-size-md);
          font-weight: 600;
          color: var(--pos-color-text-primary);
        }
        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
        }
        .close-btn:hover { background: var(--pos-color-background-secondary); }

        /* Source list */
        .source-list { margin-bottom: var(--pos-space-md); }
        .source-item {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 10px 12px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          margin-bottom: var(--pos-space-xs);
        }
        .source-icon {
          flex-shrink: 0;
          color: var(--pos-color-text-secondary);
        }
        .source-info { flex: 1; min-width: 0; }
        .source-label {
          font-size: var(--pos-font-size-sm);
          font-weight: 500;
          color: var(--pos-color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .source-meta {
          font-size: 11px;
          color: var(--pos-color-text-tertiary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .source-status {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .sync-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
        }
        .sync-dot.idle { background: var(--pos-color-text-tertiary); }
        .sync-dot.syncing { background: var(--pos-color-action-primary); animation: pulse 1s infinite; }
        .sync-dot.error { background: var(--pos-color-danger, #e53e3e); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .status-text {
          font-size: 10px;
          color: var(--pos-color-text-tertiary);
        }
        .source-actions {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          padding: 0;
        }
        .icon-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
        .icon-btn.danger:hover { color: var(--pos-color-danger, #e53e3e); }
        .icon-btn svg { pointer-events: none; }

        .empty-msg {
          text-align: center;
          padding: var(--pos-space-md);
          color: var(--pos-color-text-tertiary);
          font-size: var(--pos-font-size-sm);
        }

        /* Add form */
        .add-section { border-top: 1px solid var(--pos-color-border-default); padding-top: var(--pos-space-md); }
        .add-btn {
          display: flex;
          align-items: center;
          gap: var(--pos-space-xs);
          width: 100%;
          padding: 8px 12px;
          border: 1px dashed var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
        }
        .add-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
        .field { margin-bottom: var(--pos-space-sm); }
        .field label {
          display: block;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          margin-bottom: 4px;
        }
        .provider-tabs {
          display: flex; gap: var(--pos-space-xs);
          margin-bottom: var(--pos-space-sm);
        }
        .provider-tab {
          flex: 1;
          padding: 7px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          display: flex; align-items: center; gap: 5px;
          justify-content: center;
        }
        .provider-tab.active {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
          background: color-mix(in srgb, var(--pos-color-action-primary) 8%, transparent);
        }
        input {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
          box-sizing: border-box;
        }
        input:focus { border-color: var(--pos-color-action-primary); }
        .hint {
          font-size: 11px;
          color: var(--pos-color-text-tertiary);
          margin-top: 3px;
        }
        .error {
          color: var(--pos-color-danger, #e53e3e);
          font-size: var(--pos-font-size-xs);
          margin-bottom: var(--pos-space-xs);
        }
        .form-actions {
          display: flex; gap: var(--pos-space-xs);
          justify-content: flex-end;
          margin-top: var(--pos-space-sm);
        }
        .btn {
          padding: 6px 14px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
        }
        .btn:hover { border-color: var(--pos-color-text-tertiary); }
        .btn.primary {
          background: var(--pos-color-action-primary);
          border-color: var(--pos-color-action-primary);
          color: #fff;
        }
        .btn.primary:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>

      ${this._open ? `
        <div class="backdrop" id="backdrop">
          <div class="dialog">
            <div class="dialog-header">
              <h3>Sync Sources</h3>
              <button class="close-btn" id="close-btn">${icon('x', 16)}</button>
            </div>

            <div class="source-list">
              ${this._sources.length === 0 ? `
                <div class="empty-msg">No sync sources configured yet.</div>
              ` : this._sources.map(s => `
                <div class="source-item" data-source-id="${s.id}">
                  <div class="source-icon">${icon(s.provider === 'apple_photos' ? 'aperture' : s.provider === 'google_photos' ? 'cloud' : 'folder', 18)}</div>
                  <div class="source-info">
                    <div class="source-label">${this._esc(s.label || s.source_path.split('/').pop())}</div>
                    <div class="source-meta">${this._esc(s.source_path)} · ${s.photo_count} photos</div>
                  </div>
                  <div class="source-status">
                    <span class="sync-dot ${s.sync_status}" title="${s.sync_status === 'error' ? this._escAttr(s.last_error || 'Error') : s.sync_status}"></span>
                    <span class="status-text">${this._formatStatus(s)}</span>
                  </div>
                  <div class="source-actions">
                    <button class="icon-btn" data-action="sync" data-id="${s.id}" title="Sync now">
                      ${icon('refresh-cw', 14)}
                    </button>
                    <button class="icon-btn" data-action="toggle" data-id="${s.id}" data-active="${s.is_active}" title="${s.is_active ? 'Pause' : 'Resume'}">
                      ${icon(s.is_active ? 'pause' : 'play', 14)}
                    </button>
                    <button class="icon-btn danger" data-action="delete" data-id="${s.id}" title="Remove source">
                      ${icon('trash', 14)}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="add-section">
              ${this._renderGoogleConnect()}
              ${this._adding ? this._renderAddForm() : `
                <button class="add-btn" id="add-btn">
                  ${icon('plus', 14)} Add Source
                </button>
              `}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  _renderGoogleConnect() {
    const google = this._providers.find(p => p.id === 'google_photos');
    if (!google || !google.available) return '';
    if (google.connected) {
      return `
        <div class="source-item" style="margin-bottom:var(--pos-space-sm);border-color:var(--pos-color-action-primary);background:color-mix(in srgb, var(--pos-color-action-primary) 5%, transparent);">
          <div class="source-icon" style="color:var(--pos-color-action-primary);">${icon('cloud', 18)}</div>
          <div class="source-info">
            <div class="source-label">Google Photos</div>
            <div class="source-meta">${this._esc(google.email)} · Connected</div>
          </div>
        </div>
      `;
    }
    return `
      <button class="add-btn" id="google-connect-btn" style="margin-bottom:var(--pos-space-sm);">
        ${icon('cloud', 14)} Connect Google Photos
      </button>
    `;
  }

  _renderAddForm() {
    const localProviders = this._providers.filter(p => p.available && p.id !== 'google_photos');
    return `
      <div class="provider-tabs">
        ${localProviders.map(p => `
          <button class="provider-tab ${this._provider === p.id ? 'active' : ''}" data-provider="${p.id}">
            ${icon(p.id === 'apple_photos' ? 'aperture' : 'folder', 14)} ${p.name}
          </button>
        `).join('')}
      </div>

      <div class="field">
        <label for="source-path">Path</label>
        <input type="text" id="source-path"
          placeholder="${this._provider === 'apple_photos'
            ? '/Users/you/Pictures/Photos Library.photoslibrary'
            : '/Users/you/Google Drive/Photos'}" />
        <div class="hint">${this._provider === 'apple_photos'
          ? 'Path to your .photoslibrary file'
          : 'Absolute path to a folder with photos/videos'}</div>
      </div>

      <div class="field">
        <label for="source-label">Label (optional)</label>
        <input type="text" id="source-label" placeholder="e.g. iCloud Photos, Google Drive" />
      </div>

      ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}

      <div class="form-actions">
        <button class="btn" id="cancel-add-btn">Cancel</button>
        <button class="btn primary" id="save-btn" ${this._submitting ? 'disabled' : ''}>
          ${this._submitting ? 'Adding...' : 'Add Source'}
        </button>
      </div>
    `;
  }

  _formatStatus(s) {
    if (s.sync_status === 'syncing') return 'Syncing...';
    if (s.sync_status === 'error') return 'Error';
    if (!s.is_active) return 'Paused';
    if (s.last_sync_at) {
      const ago = Date.now() - new Date(s.last_sync_at).getTime();
      const mins = Math.floor(ago / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    }
    return 'Never synced';
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      // Close
      if (e.target.closest('#close-btn') || e.target.id === 'backdrop') {
        this.close();
        return;
      }

      // Provider tabs
      const tab = e.target.closest('[data-provider]');
      if (tab) {
        this._provider = tab.dataset.provider;
        this._render();
        setTimeout(() => this.shadow.getElementById('source-path')?.focus(), 50);
        return;
      }

      // Google connect
      if (e.target.closest('#google-connect-btn')) {
        try {
          const data = await getGoogleAuthUrl();
          if (data?.auth_url) {
            window.location.href = data.auth_url;
          }
        } catch (err) {
          this._error = err.message || 'Failed to start Google auth';
          this._render();
        }
        return;
      }

      // Add button
      if (e.target.closest('#add-btn')) {
        this._adding = true;
        this._error = null;
        this._render();
        setTimeout(() => this.shadow.getElementById('source-path')?.focus(), 50);
        return;
      }

      // Cancel add
      if (e.target.closest('#cancel-add-btn')) {
        this._adding = false;
        this._error = null;
        this._render();
        return;
      }

      // Save
      if (e.target.closest('#save-btn')) {
        await this._save();
        return;
      }

      // Source actions
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const { action, id } = actionBtn.dataset;
        if (action === 'sync') {
          try { await triggerSync(id); } catch { /* ignore */ }
          await this._loadData();
          this._render();
        } else if (action === 'toggle') {
          const active = actionBtn.dataset.active === 'true';
          try { await updateSource(id, { is_active: !active }); } catch { /* ignore */ }
          await this._loadData();
          this._render();
          this._notifyChanged();
        } else if (action === 'delete') {
          if (!await confirmDialog('Remove this source? Imported photos will not be deleted.', { confirmLabel: 'Remove', danger: true })) return;
          try { await deleteSource(id); } catch { /* ignore */ }
          await this._loadData();
          this._render();
          this._notifyChanged();
        }
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._adding) {
          this._adding = false;
          this._error = null;
          this._render();
        } else {
          this.close();
        }
      }
      if (e.key === 'Enter' && this._adding) this._save();
    });
  }

  async _save() {
    const path = this.shadow.getElementById('source-path')?.value?.trim();
    const label = this.shadow.getElementById('source-label')?.value?.trim() || null;

    if (!path) {
      this._error = 'Path is required';
      this._render();
      return;
    }

    if (this._provider === 'apple_photos' && !path.endsWith('.photoslibrary')) {
      this._error = 'Path must end with .photoslibrary';
      this._render();
      return;
    }

    this._submitting = true;
    this._error = null;
    this._render();

    try {
      await createSource({ provider: this._provider, source_path: path, label });
      this._adding = false;
      this._submitting = false;
      await this._loadData();
      this._render();
      this._notifyChanged();
    } catch (err) {
      this._error = err.message || 'Failed to add source';
      this._submitting = false;
      this._render();
    }
  }

  _notifyChanged() {
    this.dispatchEvent(new CustomEvent('source-changed', { bubbles: true, composed: true }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-photos-source-dialog', PosPhotosSourceDialog);
