// Documents module state store

import { createStore } from '../../shared/services/state-store.js';

const documentsStore = createStore({
  currentFolderId: null,       // null = root (all documents)
  folders: [],                 // root-level folders (or children of currentFolderId)
  foldersTree: [],             // full folder tree for sidebar
  documents: [],               // documents in current folder/filter
  selectedDocumentId: null,
  tags: [],                    // all user tags with document counts
  viewMode: 'list',            // 'list' or 'grid' — persisted
  tagFilter: null,             // currently active tag filter
  loading: false,
  uploading: false,
  uploadProgress: 0,           // 0-100
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
