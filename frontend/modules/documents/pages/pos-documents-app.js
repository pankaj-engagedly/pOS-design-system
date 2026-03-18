// pos-documents-app — Documents app: sidebar + home/list content routing

import '../../../shared/components/pos-module-layout.js';
import '../components/pos-documents-sidebar.js';
import '../components/pos-document-home.js';
import '../components/pos-document-list.js';
import '../components/pos-document-upload.js';
import '../components/pos-share-dialog.js';
import '../components/pos-folder-picker.js';
import '../components/pos-document-preview.js';
import store from '../store.js';
import { getDocuments, getRecentDocuments, getFolders, getFolderPath, getFavourites, favouriteDocument, unfavouriteDocument } from '../services/documents-api.js';

const TAG = 'pos-documents-app';
const STORAGE_KEY = 'pos-documents-selected';

const VIEW_LABELS = {
  home: 'Documents',
  recent: 'Recently Accessed',
  favourites: 'Favourites',
};

class PosDocumentsApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
  }

  connectedCallback() {
    this._render();
    this._unsub = store.subscribe(() => this._update());
    this._restoreSelection();
    this._init();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  _restoreSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.view) {
        store.setState({ selectedView: saved.view, selectedFolderId: null });
      } else if (saved?.folderId) {
        store.setState({ selectedFolderId: saved.folderId, selectedView: null });
      }
    } catch { /* ignore */ }
  }

  _persistSelection() {
    const { selectedView, selectedFolderId } = store.getState();
    if (selectedView) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view: selectedView }));
    } else if (selectedFolderId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folderId: selectedFolderId }));
    }
  }

  async _init() {
    const { selectedView, selectedFolderId } = store.getState();
    if (!selectedView && !selectedFolderId) {
      store.setState({ selectedView: 'home' });
    }
    if (selectedFolderId) {
      this._loadFolderPath(selectedFolderId);
    }
    await this._loadCurrentView();
  }

  async _loadCurrentView() {
    const { selectedView, selectedFolderId, tagFilter } = store.getState();
    store.setState({ loading: true, error: null });
    try {
      if (selectedView === 'home') {
        const [recentRaw, rootFolders] = await Promise.all([
          getRecentDocuments(8),
          getFolders(null),
        ]);
        // API returns { document: {...}, accessed_at } — flatten for component use
        const recentDocuments = recentRaw.map(r => ({ ...r.document, accessed_at: r.accessed_at }));
        store.setState({ recentDocuments, rootFolders, loading: false });

      } else if (selectedView === 'recent') {
        const recentRaw = await getRecentDocuments(50);
        const documents = recentRaw.map(r => ({ ...r.document, accessed_at: r.accessed_at }));
        store.setState({ documents, childFolders: [], loading: false });

      } else if (selectedView === 'favourites') {
        const documents = await getFavourites();
        store.setState({ documents, childFolders: [], loading: false });

      } else if (selectedFolderId) {
        const [docs, childFolders] = await Promise.all([
          getDocuments({ folder_id: selectedFolderId, tag: tagFilter }),
          getFolders(selectedFolderId),
        ]);
        store.setState({ documents: docs, childFolders, loading: false });

      } else {
        store.setState({ documents: [], loading: false });
      }
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadFolderPath(folderId) {
    try {
      const path = await getFolderPath(folderId);
      store.setState({ folderPath: path });
    } catch {
      store.setState({ folderPath: [] });
    }
  }

  async _toggleFavourite(documentId, isFavourite) {
    // isFavourite is current state — we're toggling away from it
    try {
      if (isFavourite) {
        await unfavouriteDocument(documentId);
      } else {
        await favouriteDocument(documentId);
      }
      // Refresh the current view so star states are updated from server
      await this._loadCurrentView();
    } catch (err) {
      console.error('Failed to toggle favourite', err);
    }
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }

        .main {
          position: relative;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        pos-document-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        pos-document-home {
          flex: 1;
          min-height: 0;
        }

        pos-share-dialog, pos-folder-picker, pos-document-upload {
          position: fixed;
        }
        pos-document-preview {
          position: fixed;
          inset: 0;
          z-index: 2000;
          pointer-events: none;
        }
        pos-document-preview[active] {
          pointer-events: auto;
        }
      </style>

      <pos-module-layout panel-width="220">
        <pos-documents-sidebar slot="panel"></pos-documents-sidebar>
        <div class="main">
          <pos-document-home></pos-document-home>
          <pos-document-list style="display:none"></pos-document-list>
        </div>
      </pos-module-layout>

      <pos-share-dialog></pos-share-dialog>
      <pos-folder-picker></pos-folder-picker>
      <pos-document-upload></pos-document-upload>
      <pos-document-preview></pos-document-preview>
    `;

    this._bindEvents();
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-documents-sidebar');
    const home = this.shadow.querySelector('pos-document-home');
    const list = this.shadow.querySelector('pos-document-list');

    if (sidebar) {
      sidebar.selectedView = state.selectedView;
      sidebar.selectedFolderId = state.selectedFolderId;
    }

    const showHome = state.selectedView === 'home';

    if (home) {
      home.style.display = showHome ? '' : 'none';
      if (showHome) {
        home.recentDocuments = state.recentDocuments || [];
        home.rootFolders = state.rootFolders || [];
      }
    }

    if (list) {
      list.style.display = showHome ? 'none' : '';
      if (!showHome) {
        if (state.selectedView) {
          list.listTitle = VIEW_LABELS[state.selectedView] || '';
          list.folderPath = [];
        } else if (state.selectedFolderId) {
          list.listTitle = state.selectedFolderName || '';
          list.folderPath = state.folderPath || [];
        }
      }
    }
  }

  _bindEvents() {
    // Smart view selection
    this.shadow.addEventListener('smart-view-select', (e) => {
      store.setState({ selectedView: e.detail.view, selectedFolderId: null, documents: [], folderPath: [] });
      this._persistSelection();
      this._loadCurrentView();
    });

    // Folder selection (from sidebar nav, home lobby cards, or breadcrumb)
    this.shadow.addEventListener('folder-select', (e) => {
      const { folderId, folderName } = e.detail;
      store.setState({ selectedView: null, selectedFolderId: folderId, selectedFolderName: folderName || '', documents: [], folderPath: [] });
      this._persistSelection();
      this._loadCurrentView();
      this._loadFolderPath(folderId);
      // Sync sidebar state
      const sidebar = this.shadow.querySelector('pos-documents-sidebar');
      if (sidebar) {
        sidebar.selectedFolderId = folderId;
        sidebar.selectedView = null;
      }
    });

    // Breadcrumb "home" click
    this.shadow.addEventListener('breadcrumb-home', () => {
      store.setState({ selectedView: 'home', selectedFolderId: null, documents: [], folderPath: [] });
      this._persistSelection();
      this._loadCurrentView();
      const sidebar = this.shadow.querySelector('pos-documents-sidebar');
      if (sidebar) { sidebar.selectedView = 'home'; sidebar.selectedFolderId = null; }
    });

    // Folders mutated (create/rename/delete in sidebar)
    this.shadow.addEventListener('folders-changed', () => {
      const { selectedView } = store.getState();
      if (selectedView === 'home') this._loadCurrentView();
    });

    // Open upload modal
    this.shadow.addEventListener('open-upload', () => {
      const { selectedFolderId, selectedFolderName } = store.getState();
      this.shadow.querySelector('pos-document-upload')
        ?.open(selectedFolderId, selectedFolderName || '');
    });

    // Upload complete — refresh current view
    this.shadow.addEventListener('upload-complete', () => {
      this._loadCurrentView();
    });

    // Preview closed (X button or Escape) — clean up active attribute
    this.shadow.addEventListener('preview-closed', () => {
      this.shadow.querySelector('pos-document-preview')?.removeAttribute('active');
    });

    // Document deleted (from list or preview) — close preview if open, refresh view
    this.shadow.addEventListener('document-deleted', () => {
      this.shadow.querySelector('pos-document-preview')?.removeAttribute('active');
      this._loadCurrentView();
    });

    // Document selected — open preview overlay
    this.shadow.addEventListener('document-selected', (e) => {
      const { documentId } = e.detail;
      store.setState({ selectedDocumentId: documentId });
      const state = store.getState();

      // Determine which list to use for prev/next navigation
      const docList = state.documents?.length > 0
        ? state.documents
        : (state.recentDocuments || []);

      const doc = docList.find(d => d.id === documentId);
      if (doc) {
        const preview = this.shadow.querySelector('pos-document-preview');
        if (preview) {
          preview.setAttribute('active', '');
          preview.open(doc, docList);
        }
      }
    });

    // Favourite toggled — call API then refresh current view
    this.shadow.addEventListener('toggle-favourite', (e) => {
      const { documentId, isFavourite } = e.detail;
      this._toggleFavourite(documentId, isFavourite);
    });

    // Share document
    this.shadow.addEventListener('share-document', (e) => {
      this.shadow.querySelector('pos-share-dialog')?.openForDocument(e.detail.documentId);
    });

    // Move document
    this.shadow.addEventListener('move-document', (e) => {
      const { documentId, documentName, currentFolderId } = e.detail;
      this.shadow.querySelector('pos-folder-picker')?.open(documentId, documentName, currentFolderId);
    });

    // Document moved
    this.shadow.addEventListener('document-moved', () => {
      this._loadCurrentView();
    });
  }
}

customElements.define(TAG, PosDocumentsApp);
