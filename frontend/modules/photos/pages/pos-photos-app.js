// pos-photos-app — 2-panel photos app: sidebar + content area + lightbox

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-photos-sidebar.js';
import '../components/pos-photos-grid.js';
import '../components/pos-photos-timeline.js';
import '../components/pos-photos-lightbox.js';
import '../components/pos-photos-upload-dialog.js';
import '../components/pos-photos-album-detail.js';
import '../components/pos-photos-source-dialog.js';
import { icon } from '../../../shared/utils/icons.js';
import store from '../store.js';
import {
  getPhotos, getTimeline, getPhoto, updatePhoto, deletePhoto,
  getAlbums, getAlbum, getPeople, getPersonPhotos, getStats,
  addTag, removeTag, addComment, tagPhotoWithPerson, untagPhotoPerson, createPerson,
  addPhotosToAlbum,
} from '../services/photos-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';

const TAG = 'pos-photos-app';
const PHOTOS_VIEW_KEY = 'pos-photos-view';

class PosPhotosApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
  }

  connectedCallback() {
    this._render();
    this._restoreViewState();
    this._unsub = store.subscribe(() => this._update());
    this._bindEvents();
    this._loadCurrentView();
    this._handleOAuthReturn();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  // ── Data Loading ──────────────────────────────────────

  async _loadCurrentView() {
    const { selectedView, selectedAlbumId, selectedPersonId } = store.getState();

    if (selectedAlbumId) {
      await this._loadAlbum(selectedAlbumId);
    } else if (selectedPersonId) {
      await this._loadPersonPhotos(selectedPersonId);
    } else if (selectedView === 'timeline') {
      await this._loadTimeline();
    } else {
      await this._loadPhotos();
    }
  }

  async _loadTimeline() {
    store.setState({ loading: true });
    try {
      const [groups, stats] = await Promise.all([
        getTimeline({ limit: 300 }),
        getStats().catch(() => ({})),
      ]);
      // Flatten for lightbox navigation
      const allPhotos = groups.flatMap(g => g.photos);
      store.setState({ timelineGroups: groups, photos: allPhotos, stats, loading: false });
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadPhotos() {
    const { selectedView, searchQuery } = store.getState();
    store.setState({ loading: true });

    try {
      const params = { limit: 200 };

      if (searchQuery) {
        // Search not yet implemented on backend — use tag filter as proxy
        params.tag = searchQuery;
      } else if (selectedView === 'favourites') {
        params.favourite = true;
      } else if (selectedView === 'recent') {
        params.sort_by = 'created_at';
        params.limit = 100;
      }
      // 'all' — no extra filter

      const [photos, stats] = await Promise.all([
        getPhotos(params),
        getStats().catch(() => ({})),
      ]);
      store.setState({ photos, stats, loading: false });
    } catch (err) {
      store.setState({ photos: [], loading: false, error: err.message });
    }
  }

  async _loadAlbum(albumId) {
    store.setState({ loading: true });
    try {
      const album = await getAlbum(albumId);
      store.setState({ photos: album.photos || [], loading: false });

      const albumDetail = this.shadow.querySelector('pos-photos-album-detail');
      if (albumDetail) {
        albumDetail.album = album;
        albumDetail.photos = album.photos || [];
      }
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadPersonPhotos(personId) {
    store.setState({ loading: true });
    try {
      const photos = await getPersonPhotos(personId);
      store.setState({ photos, loading: false });
    } catch (err) {
      store.setState({ photos: [], loading: false, error: err.message });
    }
  }

  // ── Render ────────────────────────────────────────────

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .main {
          position: relative;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        pos-photos-timeline,
        pos-photos-grid,
        pos-photos-album-detail {
          flex: 1;
          min-height: 0;
        }
        pos-photos-grid {
          overflow-y: auto;
          padding: var(--pos-space-sm);
        }
        pos-photos-upload-dialog {
          position: fixed;
        }
        pos-photos-lightbox {
          position: fixed;
        }
        .header-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 12px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
        }
        .header-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
        .header-btn svg { pointer-events: none; }

        /* Bulk action bar */
        .bulk-bar {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-lg);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          z-index: 10;
          animation: bulk-bar-in 0.15s ease-out;
        }
        @keyframes bulk-bar-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .bulk-count {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          white-space: nowrap;
          padding-right: 4px;
        }
        .bulk-divider {
          width: 1px;
          height: 20px;
          background: var(--pos-color-border-default);
        }
        .bulk-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
          white-space: nowrap;
        }
        .bulk-btn:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }
        .bulk-btn.danger:hover {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }
        .bulk-btn svg { pointer-events: none; }
        .bulk-cancel {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          padding: 0;
          transition: background 0.1s;
        }
        .bulk-cancel:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }
        .bulk-cancel svg { pointer-events: none; }
      </style>

      <pos-module-layout>
        <pos-photos-sidebar slot="panel"></pos-photos-sidebar>
        <div class="main">
          <pos-page-header id="page-header">
            <span id="header-title">Timeline</span>
            <span slot="subtitle" id="header-meta"></span>
            <span slot="actions" id="header-actions"></span>
          </pos-page-header>
          <div class="content">
            <pos-photos-timeline style="display:none"></pos-photos-timeline>
            <pos-photos-grid style="display:none"></pos-photos-grid>
            <pos-photos-album-detail style="display:none"></pos-photos-album-detail>
          </div>
          <div class="bulk-bar" id="bulk-bar" style="display:none">
            <span class="bulk-count" id="bulk-count"></span>
            <div class="bulk-divider"></div>
            <button class="bulk-btn" id="bulk-fav">${icon('star', 13)} Favourite</button>
            <button class="bulk-btn" id="bulk-album">${icon('folder', 13)} Add to Album</button>
            <button class="bulk-btn danger" id="bulk-delete">${icon('trash', 13)} Delete</button>
            <div class="bulk-divider"></div>
            <button class="bulk-cancel" id="bulk-cancel" title="Clear selection">${icon('x', 12)}</button>
          </div>
        </div>
      </pos-module-layout>

      <pos-photos-lightbox></pos-photos-lightbox>
      <pos-photos-upload-dialog></pos-photos-upload-dialog>
      <pos-photos-source-dialog></pos-photos-source-dialog>
    `;

    this._update();
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-photos-sidebar');
    const timeline = this.shadow.querySelector('pos-photos-timeline');
    const grid = this.shadow.querySelector('pos-photos-grid');
    const albumDetail = this.shadow.querySelector('pos-photos-album-detail');
    const lightbox = this.shadow.querySelector('pos-photos-lightbox');

    const isTimeline = state.selectedView === 'timeline' && !state.selectedAlbumId && !state.selectedPersonId;
    const isAlbum = !!state.selectedAlbumId;
    const isGrid = !isTimeline && !isAlbum;

    // ── Page header ──
    this._updateHeader(state, isTimeline, isAlbum);

    if (sidebar) {
      sidebar.selectedView = state.selectedView;
      sidebar.selectedAlbumId = state.selectedAlbumId;
      sidebar.selectedPersonId = state.selectedPersonId;
      sidebar.stats = state.stats;
    }

    if (timeline) {
      timeline.style.display = isTimeline ? '' : 'none';
      if (isTimeline) {
        timeline.groups = state.timelineGroups;
        timeline.selectedIds = state.selectedPhotoIds;
      }
    }

    if (grid) {
      grid.style.display = isGrid ? '' : 'none';
      if (isGrid) {
        grid.photos = state.photos;
        grid.selectedIds = state.selectedPhotoIds;
      }
    }

    if (albumDetail) {
      albumDetail.style.display = isAlbum ? '' : 'none';
      if (isAlbum) {
        albumDetail.photos = state.photos;
        albumDetail.selectedIds = state.selectedPhotoIds;
      }
    }

    if (lightbox) {
      lightbox.photos = state.photos;
    }

    // Bulk action bar
    const bulkBar = this.shadow.getElementById('bulk-bar');
    const bulkCount = this.shadow.getElementById('bulk-count');
    if (bulkBar) {
      const count = state.selectedPhotoIds?.length || 0;
      bulkBar.style.display = count > 0 ? '' : 'none';
      if (bulkCount) bulkCount.textContent = `${count} selected`;
    }
  }

  _updateHeader(state, isTimeline, isAlbum) {
    const titleEl = this.shadow.getElementById('header-title');
    const metaEl = this.shadow.getElementById('header-meta');
    const actionsEl = this.shadow.getElementById('header-actions');
    if (!titleEl) return;

    const photoCount = state.photos?.length || 0;
    const totalCount = state.stats?.total || 0;

    // Determine title + count
    let title = 'Timeline';
    let count = totalCount;

    if (isAlbum) {
      title = state.selectedAlbumName || 'Album';
      count = photoCount;
    } else if (state.selectedPersonId) {
      title = state.selectedPersonName || 'Person';
      count = photoCount;
    } else if (state.selectedView === 'all') {
      title = 'All Photos';
      count = totalCount;
    } else if (state.selectedView === 'favourites') {
      title = 'Favourites';
      count = state.stats?.favourites || photoCount;
    } else if (state.selectedView === 'recent') {
      title = 'Recently Added';
      count = photoCount;
    }

    titleEl.textContent = title;
    metaEl.textContent = `${count} photo${count !== 1 ? 's' : ''}`;

    // Actions: sources settings + upload button
    const uploadLabel = isAlbum ? 'Upload to Album' : 'Upload';
    actionsEl.innerHTML = `
      <button class="header-btn" id="header-sources-btn" title="Sync Sources">
        ${icon('settings', 14)}
      </button>
      <button class="header-btn" id="header-upload-btn">
        ${icon('upload', 14)} ${uploadLabel}
      </button>
    `;
  }

  // ── Events ────────────────────────────────────────────

  _bindEvents() {
    // Sidebar: view select
    this.shadow.addEventListener('view-select', (e) => {
      const { view } = e.detail;
      store.setState({
        selectedView: view,
        selectedAlbumId: null,
        selectedAlbumName: '',
        selectedPersonId: null,
        selectedPersonName: '',
        selectedPhotoId: null,
        selectedPhotoIds: [],
        searchQuery: '',
      });
      this._saveViewState();

      if (view === 'timeline') {
        this._loadTimeline();
      } else {
        this._loadPhotos();
      }
    });

    // Sidebar: album select
    this.shadow.addEventListener('album-select', (e) => {
      const { albumId, albumName } = e.detail;
      store.setState({
        selectedView: 'album',
        selectedAlbumId: albumId,
        selectedAlbumName: albumName,
        selectedPersonId: null,
        selectedPersonName: '',
        selectedPhotoId: null,
        selectedPhotoIds: [],
      });
      this._saveViewState();
      this._loadAlbum(albumId);
    });

    // Sidebar: person select
    this.shadow.addEventListener('person-select', (e) => {
      const { personId, personName } = e.detail;
      store.setState({
        selectedView: 'person',
        selectedAlbumId: null,
        selectedAlbumName: '',
        selectedPersonId: personId,
        selectedPersonName: personName,
        selectedPhotoId: null,
        selectedPhotoIds: [],
      });
      this._saveViewState();
      this._loadPersonPhotos(personId);
    });

    // Sidebar changed
    this.shadow.addEventListener('sidebar-changed', () => {
      this._loadCurrentView();
    });

    // ── Grid events ──

    // Open lightbox
    this.shadow.addEventListener('photo-open', async (e) => {
      const { photoId } = e.detail;
      store.setState({ selectedPhotoId: photoId });
      const lightbox = this.shadow.querySelector('pos-photos-lightbox');
      lightbox?.open(photoId);

      try {
        const photo = await getPhoto(photoId);
        lightbox.refreshPhoto(photo);
      } catch (err) {
        console.error('Failed to load photo detail', err);
      }
    });

    // Photo action (favourite from grid)
    this.shadow.addEventListener('photo-action', async (e) => {
      const { action, photoId } = e.detail;
      if (action === 'favourite') {
        const photo = this._findPhoto(photoId);
        if (photo) {
          await updatePhoto(photoId, { is_favourite: !photo.is_favourite });
          this._loadCurrentView();
        }
      } else if (action === 'delete') {
        if (!await confirmDialog('Delete this photo?', { confirmLabel: 'Delete', danger: true })) return;
        await deletePhoto(photoId);
        this._loadCurrentView();
        this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
      }
    });

    // Photo select toggle
    this.shadow.addEventListener('photo-select-toggle', (e) => {
      const { photoId } = e.detail;
      const ids = [...store.getState().selectedPhotoIds];
      const idx = ids.indexOf(photoId);
      if (idx >= 0) {
        ids.splice(idx, 1);
      } else {
        ids.push(photoId);
      }
      store.setState({ selectedPhotoIds: ids, selectionMode: ids.length > 0 });
    });

    // ── Lightbox events ──

    this.shadow.addEventListener('lightbox-close', () => {
      store.setState({ selectedPhotoId: null });
    });

    this.shadow.addEventListener('lightbox-load-detail', async (e) => {
      const { photoId } = e.detail;
      try {
        const photo = await getPhoto(photoId);
        const lightbox = this.shadow.querySelector('pos-photos-lightbox');
        lightbox?.refreshPhoto(photo);
      } catch (err) {
        console.error('Failed to load photo detail', err);
      }
    });

    this.shadow.addEventListener('lightbox-action', async (e) => {
      const { action, photoId } = e.detail;
      if (action === 'favourite') {
        const photo = this._findPhoto(photoId);
        if (photo) {
          const updated = await updatePhoto(photoId, { is_favourite: !photo.is_favourite });
          const lightbox = this.shadow.querySelector('pos-photos-lightbox');
          const full = await getPhoto(photoId);
          lightbox?.refreshPhoto(full);
          this._loadCurrentView();
        }
      } else if (action === 'delete') {
        if (!await confirmDialog('Delete this photo?', { confirmLabel: 'Delete', danger: true })) return;
        await deletePhoto(photoId);
        const lightbox = this.shadow.querySelector('pos-photos-lightbox');
        lightbox?.close();
        store.setState({ selectedPhotoId: null });
        this._loadCurrentView();
        this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
      }
    });

    // ── Info panel events (from lightbox) ──

    this.shadow.addEventListener('info-action', async (e) => {
      const { action, photoId } = e.detail;
      const lightbox = this.shadow.querySelector('pos-photos-lightbox');

      if (action === 'update-caption') {
        await updatePhoto(photoId, { caption: e.detail.caption });
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
      } else if (action === 'update-rating') {
        const currentPhoto = this._findPhoto(photoId);
        const newRating = currentPhoto?.rating === parseInt(e.detail.rating) ? null : parseInt(e.detail.rating);
        await updatePhoto(photoId, { rating: newRating });
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
      } else if (action === 'add-tag') {
        await addTag(photoId, e.detail.tagName);
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
      } else if (action === 'remove-tag') {
        await removeTag(photoId, e.detail.tagId);
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
      } else if (action === 'add-comment') {
        await addComment(photoId, e.detail.text);
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
      } else if (action === 'add-person') {
        // Create person if needed, then tag
        try {
          const person = await createPerson(e.detail.personName);
          await tagPhotoWithPerson(photoId, person.id);
          const full = await getPhoto(photoId);
          lightbox?.refreshPhoto(full);
          this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
        } catch (err) {
          console.error('Failed to add person', err);
        }
      } else if (action === 'remove-person') {
        await untagPhotoPerson(photoId, e.detail.personId);
        const full = await getPhoto(photoId);
        lightbox?.refreshPhoto(full);
        this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
      }
    });

    // ── Bulk actions ──

    this.shadow.addEventListener('click', async (e) => {
      if (e.target.closest('#bulk-cancel')) {
        store.setState({ selectedPhotoIds: [], selectionMode: false });
        return;
      }

      if (e.target.closest('#bulk-fav')) {
        const ids = store.getState().selectedPhotoIds;
        for (const id of ids) {
          const photo = this._findPhoto(id);
          if (photo && !photo.is_favourite) {
            await updatePhoto(id, { is_favourite: true });
          }
        }
        store.setState({ selectedPhotoIds: [], selectionMode: false });
        this._loadCurrentView();
        return;
      }

      if (e.target.closest('#bulk-delete')) {
        const ids = store.getState().selectedPhotoIds;
        const count = ids.length;
        if (!await confirmDialog(`Delete ${count} photo${count !== 1 ? 's' : ''}?`, { confirmLabel: 'Delete', danger: true })) return;
        for (const id of ids) {
          await deletePhoto(id);
        }
        store.setState({ selectedPhotoIds: [], selectionMode: false });
        this._loadCurrentView();
        this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
        return;
      }

      if (e.target.closest('#bulk-album')) {
        await this._showAlbumPicker();
        return;
      }

      // ── Header buttons ──
      if (e.target.closest('#header-upload-btn')) {
        this.shadow.querySelector('pos-photos-upload-dialog')?.open();
      }
      if (e.target.closest('#header-sources-btn')) {
        this.shadow.querySelector('pos-photos-source-dialog')?.open();
      }
    });

    // ── Upload events ──

    this.shadow.addEventListener('open-upload', () => {
      this.shadow.querySelector('pos-photos-upload-dialog')?.open();
    });

    // ── Source events ──

    this.shadow.addEventListener('open-sources', () => {
      this.shadow.querySelector('pos-photos-source-dialog')?.open();
    });

    this.shadow.addEventListener('source-changed', () => {
      this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
    });

    this.shadow.addEventListener('upload-complete', async (e) => {
      const { selectedAlbumId } = store.getState();
      const result = e.detail;

      // If in album view, add uploaded photos to the album
      if (selectedAlbumId && result?.photoIds?.length) {
        try {
          await addPhotosToAlbum(selectedAlbumId, result.photoIds);
        } catch (err) {
          console.error('Failed to add photos to album', err);
        }
      }

      this._loadCurrentView();
      this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
    });
  }

  // ── Helpers ───────────────────────────────────────────

  async _showAlbumPicker() {
    try {
      const albums = await getAlbums();
      if (!albums.length) {
        await confirmDialog('No albums yet. Create one from the sidebar first.', { confirmLabel: 'OK', danger: false });
        return;
      }
      // Build a simple picker dialog using confirmDialog pattern
      const names = albums.map(a => a.name);
      const picked = await this._pickAlbum(albums);
      if (!picked) return;

      const ids = store.getState().selectedPhotoIds;
      await addPhotosToAlbum(picked.id, ids);
      store.setState({ selectedPhotoIds: [], selectionMode: false });
      this._loadCurrentView();
      this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
    } catch (err) {
      console.error('Failed to add to album', err);
    }
  }

  _pickAlbum(albums) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--pos-color-background-primary);border-radius:var(--pos-radius-lg);padding:16px;min-width:240px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
      panel.innerHTML = `
        <div style="font-weight:var(--pos-font-weight-semibold);font-size:var(--pos-font-size-sm);margin-bottom:12px;color:var(--pos-color-text-primary);">Add to Album</div>
        <div id="album-list" style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;">
          ${albums.map(a => `
            <button data-album-id="${a.id}" style="
              text-align:left;padding:8px 12px;border:1px solid var(--pos-color-border-default);
              border-radius:var(--pos-radius-sm);background:transparent;cursor:pointer;
              font-size:var(--pos-font-size-sm);font-family:inherit;
              color:var(--pos-color-text-primary);transition:background 0.1s;
            ">${a.name}${a.photo_count ? ` <span style="color:var(--pos-color-text-tertiary);">(${a.photo_count})</span>` : ''}</button>
          `).join('')}
        </div>
        <button id="album-cancel" style="
          margin-top:12px;width:100%;padding:6px;border:1px solid var(--pos-color-border-default);
          border-radius:var(--pos-radius-sm);background:transparent;cursor:pointer;
          font-size:var(--pos-font-size-xs);font-family:inherit;color:var(--pos-color-text-secondary);
        ">Cancel</button>
      `;

      panel.querySelector('#album-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(null); }
      });
      panel.querySelector('#album-list').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-album-id]');
        if (btn) {
          const album = albums.find(a => a.id === btn.dataset.albumId);
          overlay.remove();
          resolve(album);
        }
      });
      // Hover styles
      panel.querySelector('#album-list').addEventListener('mouseover', (e) => {
        const btn = e.target.closest('[data-album-id]');
        if (btn) btn.style.background = 'var(--pos-color-background-secondary)';
      });
      panel.querySelector('#album-list').addEventListener('mouseout', (e) => {
        const btn = e.target.closest('[data-album-id]');
        if (btn) btn.style.background = 'transparent';
      });

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    });
  }

  _handleOAuthReturn() {
    const hash = window.location.hash;
    if (hash.includes('google_connected=1')) {
      // Refresh sidebar and sources after Google OAuth success
      setTimeout(() => {
        this.shadow.querySelector('pos-photos-sidebar')?.refreshData();
        this._loadCurrentView();
      }, 500);
      // Clean up URL
      window.location.hash = '#/photos';
    } else if (hash.includes('google_error=')) {
      const match = hash.match(/google_error=([^&]*)/);
      const error = match ? decodeURIComponent(match[1]) : 'Unknown error';
      console.error('Google OAuth error:', error);
      // Clean up URL
      window.location.hash = '#/photos';
    }
  }

  _findPhoto(photoId) {
    return store.getState().photos.find(p => p.id === photoId);
  }

  _restoreViewState() {
    try {
      const saved = sessionStorage.getItem(PHOTOS_VIEW_KEY);
      if (saved) {
        const { view, albumId, albumName, personId, personName } = JSON.parse(saved);
        store.setState({
          selectedView: view || 'timeline',
          selectedAlbumId: albumId || null,
          selectedAlbumName: albumName || '',
          selectedPersonId: personId || null,
          selectedPersonName: personName || '',
        });
      }
    } catch { /* ignore */ }
  }

  _saveViewState() {
    const { selectedView, selectedAlbumId, selectedAlbumName, selectedPersonId, selectedPersonName } = store.getState();
    sessionStorage.setItem(PHOTOS_VIEW_KEY, JSON.stringify({
      view: selectedView,
      albumId: selectedAlbumId,
      albumName: selectedAlbumName,
      personId: selectedPersonId,
      personName: selectedPersonName,
    }));
  }
}

customElements.define(TAG, PosPhotosApp);
