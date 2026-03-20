// pos-photos-app — 2-panel photos app: sidebar + content area + lightbox

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-photos-sidebar.js';
import '../components/pos-photos-grid.js';
import '../components/pos-photos-timeline.js';
import '../components/pos-photos-lightbox.js';
import '../components/pos-photos-upload-dialog.js';
import '../components/pos-photos-album-detail.js';
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
        </div>
      </pos-module-layout>

      <pos-photos-lightbox></pos-photos-lightbox>
      <pos-photos-upload-dialog></pos-photos-upload-dialog>
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

    // Actions: upload button (always), plus album-specific context
    if (isAlbum) {
      actionsEl.innerHTML = `
        <button class="header-btn" id="header-upload-btn">
          ${icon('upload', 14)} Upload to Album
        </button>
      `;
    } else {
      actionsEl.innerHTML = `
        <button class="header-btn" id="header-upload-btn">
          ${icon('upload', 14)} Upload
        </button>
      `;
    }
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

    // ── Header upload button ──

    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#header-upload-btn')) {
        this.shadow.querySelector('pos-photos-upload-dialog')?.open();
      }
    });

    // ── Upload events ──

    this.shadow.addEventListener('open-upload', () => {
      this.shadow.querySelector('pos-photos-upload-dialog')?.open();
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
