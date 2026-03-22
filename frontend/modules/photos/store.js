// Photos module state store

import { createStore } from '../../shared/services/state-store.js';

const photosStore = createStore({
  // Navigation
  selectedView: 'timeline',      // timeline | all | favourites | recent | album | person | search
  selectedAlbumId: null,
  selectedAlbumName: '',
  selectedPersonId: null,
  selectedPersonName: '',

  // Data
  photos: [],
  timelineGroups: [],            // [{ date, photos }]
  albums: [],
  people: [],
  sources: [],                   // sync sources
  stats: {},
  tags: [],

  // Selection
  selectedPhotoId: null,
  selectedPhotoIds: [],
  selectionMode: false,

  // Filters
  searchQuery: '',

  // Upload
  uploading: false,

  // UI
  loading: false,
  error: null,
});

export default photosStore;
