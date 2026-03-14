// Notes module state store

import { createStore } from '../../shared/services/state-store.js';

const notesStore = createStore({
  folders: [],
  selectedFolderId: null,
  selectedView: 'all',   // 'all', 'pinned', 'trash', or null (folder mode)
  notes: [],             // notes for current view/folder
  selectedNoteId: null,
  selectedNote: null,    // full note with content (loaded on selection)
  viewMode: 'list',      // 'list' or 'grid'
  searchQuery: '',
  loading: false,
  error: null,
});

export default notesStore;
