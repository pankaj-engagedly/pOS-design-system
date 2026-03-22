// pos-photos-sidebar — Smart views + albums + people + settings cog
// Composes: pos-sidebar (shell + scroll + footer)

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import { getAlbums, createAlbum, updateAlbum, deleteAlbum, getPeople, getStats } from '../services/photos-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import '../../../shared/components/pos-sidebar.js';

const photosSheet = new CSSStyleSheet();
photosSheet.replaceSync(`
  .new-item-btn {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }
  .new-item-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .new-item-input {
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
`);

const SMART_VIEWS = [
  { key: 'timeline',    label: 'Timeline',         iconName: 'clock' },
  { key: 'all',         label: 'All Photos',        iconName: 'image' },
  { key: 'favourites',  label: 'Favourites',        iconName: 'star' },
  { key: 'recent',      label: 'Recently Added',    iconName: 'upload' },
];

class PosPhotosSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, photosSheet];
    this._selectedView = 'timeline';
    this._selectedAlbumId = null;
    this._selectedPersonId = null;
    this._albums = [];
    this._people = [];
    this._stats = {};
    this._addingAlbum = false;
    this._renamingAlbumId = null;
    this._renamingPersonId = null;
  }

  set selectedView(val) { if (this._selectedView !== val) { this._selectedView = val; this._render(); } }
  set selectedAlbumId(val) { if (this._selectedAlbumId !== val) { this._selectedAlbumId = val; this._render(); } }
  set selectedPersonId(val) { if (this._selectedPersonId !== val) { this._selectedPersonId = val; this._render(); } }
  set stats(val) {
    const v = val || {};
    if (v.total !== this._stats.total || v.favourites !== this._stats.favourites) {
      this._stats = v; this._render();
    }
  }

  connectedCallback() {
    this._bindEvents();
    this._render();
    this.refreshData();
  }

  async refreshData() {
    try {
      const [albums, people, stats] = await Promise.all([
        getAlbums().catch(() => []),
        getPeople().catch(() => []),
        getStats().catch(() => ({})),
      ]);
      this._albums = albums;
      this._people = people;
      this._stats = stats;
      this._render();
    } catch (e) {
      console.error('Sidebar data load failed', e);
    }
  }

  _render() {
    const getCounts = (key) => {
      if (key === 'all') return this._stats.total || 0;
      if (key === 'favourites') return this._stats.favourites || 0;
      return 0;
    };

    this.shadow.innerHTML = `
      <pos-sidebar title="Photos">

        ${SMART_VIEWS.map(v => {
          const active = this._selectedView === v.key && !this._selectedAlbumId && !this._selectedPersonId;
          const count = getCounts(v.key);
          return `
            <div class="nav-item ${active ? 'active' : ''}" data-view="${v.key}">
              ${icon(v.iconName, 15)}
              <span class="nav-label">${v.label}</span>
              ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
            </div>`;
        }).join('')}

        <div class="divider"></div>
        <div class="section-label">Albums</div>

        ${this._albums.map(a => this._renderAlbumItem(a)).join('')}

        ${this._addingAlbum
          ? `<div style="padding: 2px var(--pos-space-xs);">
               <input class="new-item-input" id="new-album-input" placeholder="Album name\u2026" />
             </div>`
          : `<div style="padding: 2px var(--pos-space-xs);">
               <button class="new-item-btn" id="new-album-btn">
                 ${icon('plus', 13)} New Album
               </button>
             </div>`
        }

        <div class="divider"></div>
        <div class="section-label">People</div>

        ${this._people.map(p => this._renderPersonItem(p)).join('')}

        <div slot="footer">
          <button class="new-item-btn" id="upload-btn">
            ${icon('upload', 13)} Upload Photos
          </button>
        </div>

      </pos-sidebar>
    `;

    if (this._addingAlbum) {
      setTimeout(() => this.shadow.getElementById('new-album-input')?.focus(), 0);
    }
    if (this._renamingAlbumId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById('rename-input');
        inp?.focus();
        inp?.select();
      }, 0);
    }
    if (this._renamingPersonId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById('rename-person-input');
        inp?.focus();
        inp?.select();
      }, 0);
    }
  }

  _renderAlbumItem(a) {
    if (this._renamingAlbumId === a.id) {
      return `<div class="rename-wrap">
        <input class="rename-input" id="rename-input" value="${this._escAttr(a.name)}" data-album-id="${a.id}" />
      </div>`;
    }
    return `<div class="nav-item ${this._selectedAlbumId === a.id ? 'active' : ''}"
                data-album-id="${a.id}" data-album-name="${this._escAttr(a.name)}">
        ${icon('folder', 15)}
        <span class="nav-label">${this._esc(a.name)}</span>
        ${a.photo_count ? `<span class="nav-count">${a.photo_count}</span>` : ''}
        <div class="nav-actions">
          <button class="nav-action-btn" data-action="rename-album" data-id="${a.id}" title="Rename">
            ${icon('edit', 13)}
          </button>
          <button class="nav-action-btn delete" data-action="delete-album" data-id="${a.id}" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>`;
  }

  _renderPersonItem(p) {
    if (this._renamingPersonId === p.id) {
      return `<div class="rename-wrap">
        <input class="rename-input" id="rename-person-input" value="${this._escAttr(p.name)}" data-person-id="${p.id}" />
      </div>`;
    }
    return `<div class="nav-item ${this._selectedPersonId === p.id ? 'active' : ''}"
                data-person-id="${p.id}" data-person-name="${this._escAttr(p.name)}">
        ${icon('user', 15)}
        <span class="nav-label">${this._esc(p.name)}</span>
        ${p.photo_count ? `<span class="nav-count">${p.photo_count}</span>` : ''}
        <div class="nav-actions">
          <button class="nav-action-btn" data-action="rename-person" data-id="${p.id}" title="Rename">
            ${icon('edit', 13)}
          </button>
          <button class="nav-action-btn delete" data-action="delete-person" data-id="${p.id}" title="Delete">
            ${icon('trash', 13)}
          </button>
        </div>
      </div>`;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Upload button
      if (e.target.closest('#upload-btn')) {
        this.dispatchEvent(new CustomEvent('open-upload', { bubbles: true, composed: true }));
        return;
      }

      // New album button
      if (e.target.closest('#new-album-btn')) {
        this._addingAlbum = true;
        this._render();
        return;
      }

      // Action buttons
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        const { action, id } = actionBtn.dataset;
        if (action === 'rename-album') {
          this._renamingAlbumId = id;
          this._render();
        } else if (action === 'delete-album') {
          this._deleteAlbum(id);
        } else if (action === 'rename-person') {
          this._renamingPersonId = id;
          this._render();
        } else if (action === 'delete-person') {
          this._deletePerson(id);
        }
        return;
      }

      // Nav item selection
      const item = e.target.closest('.nav-item');
      if (!item) return;

      if (item.dataset.view) {
        this.dispatchEvent(new CustomEvent('view-select', {
          bubbles: true, composed: true,
          detail: { view: item.dataset.view },
        }));
      } else if (item.dataset.albumId) {
        this.dispatchEvent(new CustomEvent('album-select', {
          bubbles: true, composed: true,
          detail: { albumId: item.dataset.albumId, albumName: item.dataset.albumName },
        }));
      } else if (item.dataset.personId) {
        this.dispatchEvent(new CustomEvent('person-select', {
          bubbles: true, composed: true,
          detail: { personId: item.dataset.personId, personName: item.dataset.personName },
        }));
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      const newInput = e.target.closest('#new-album-input');
      if (newInput) {
        if (e.key === 'Enter' && newInput.value.trim()) {
          this._createAlbum(newInput.value.trim());
        }
        if (e.key === 'Escape') { this._addingAlbum = false; this._render(); }
        return;
      }

      const renameInput = e.target.closest('#rename-input');
      if (renameInput) {
        if (e.key === 'Enter' && renameInput.value.trim()) {
          this._renameAlbum(renameInput.dataset.albumId, renameInput.value.trim());
        }
        if (e.key === 'Escape') { this._renamingAlbumId = null; this._render(); }
        return;
      }

      const renamePersonInput = e.target.closest('#rename-person-input');
      if (renamePersonInput) {
        if (e.key === 'Enter' && renamePersonInput.value.trim()) {
          this._renamePerson(renamePersonInput.dataset.personId, renamePersonInput.value.trim());
        }
        if (e.key === 'Escape') { this._renamingPersonId = null; this._render(); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-album-input')) {
        setTimeout(() => {
          if (this._addingAlbum) { this._addingAlbum = false; this._render(); }
        }, 150);
      }
      if (e.target.closest('#rename-input')) {
        setTimeout(() => {
          if (this._renamingAlbumId) { this._renamingAlbumId = null; this._render(); }
        }, 150);
      }
      if (e.target.closest('#rename-person-input')) {
        setTimeout(() => {
          if (this._renamingPersonId) { this._renamingPersonId = null; this._render(); }
        }, 150);
      }
    });
  }

  async _createAlbum(name) {
    try {
      await createAlbum({ name });
      this._addingAlbum = false;
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to create album', err);
    }
  }

  async _renameAlbum(id, name) {
    try {
      await updateAlbum(id, { name });
      this._renamingAlbumId = null;
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to rename album', err);
    }
  }

  async _deleteAlbum(id) {
    if (!await confirmDialog('Delete this album? Photos will not be deleted.', { confirmLabel: 'Delete', danger: true })) return;
    try {
      await deleteAlbum(id);
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to delete album', err);
    }
  }

  async _renamePerson(id, name) {
    try {
      const { updatePerson } = await import('../services/photos-api.js');
      await updatePerson(id, { name });
      this._renamingPersonId = null;
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to rename person', err);
    }
  }

  async _deletePerson(id) {
    if (!await confirmDialog('Delete this person? Photos will be untagged but not deleted.', { confirmLabel: 'Delete', danger: true })) return;
    try {
      const { deletePerson } = await import('../services/photos-api.js');
      await deletePerson(id);
      await this.refreshData();
      this.dispatchEvent(new CustomEvent('sidebar-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Failed to delete person', err);
    }
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

customElements.define('pos-photos-sidebar', PosPhotosSidebar);
