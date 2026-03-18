// Documents module state store

import { createStore } from '../../shared/services/state-store.js';

const documentsStore = createStore({
  // Navigation state
  selectedView: 'home',        // 'home' | 'recent' | 'favourites' | null
  selectedFolderId: null,      // active folder ID (null when a smart view is active)
  selectedFolderName: '',      // name of the active folder (for display)
  folderPath: [],              // [{id, name}, ...] root→current, only set when in a folder

  // Data
  documents: [],               // documents shown in the list view
  childFolders: [],            // subfolders inside the current folder
  recentDocuments: [],         // recent access docs (for home + recent views)
  rootFolders: [],             // root-level folders (for home lobby cards)
  selectedDocumentId: null,

  // Filters
  tags: [],                    // all user tags with document counts
  tagFilter: null,             // currently active tag filter

  // UI
  viewMode: 'list',            // 'list' or 'grid'
  loading: false,
  uploading: false,
  uploadProgress: 0,
  error: null,
});

// Persist view mode preference
const saved = localStorage.getItem('pos-documents-view-mode');
if (saved === 'list' || saved === 'grid') {
  documentsStore.setState({ viewMode: saved });
}

documentsStore.subscribe((state) => {
  localStorage.setItem('pos-documents-view-mode', state.viewMode);
});

export default documentsStore;
