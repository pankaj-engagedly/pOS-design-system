// Knowledge Base module state store

import { createStore } from '../../shared/services/state-store.js';

const kbStore = createStore({
  // Sidebar-based navigation
  selectedView: 'all',         // all | favourites | recent | feeds
  selectedCollectionId: null,
  selectedCollectionName: '',

  // KB Data
  items: [],
  selectedItemId: null,
  collections: [],
  tags: [],
  stats: {},

  // Feed Data
  feedItems: [],
  feedSources: [],
  feedFilter: null,
  feedUnreadOnly: false,

  // Filters
  activeTag: null,
  minRating: null,
  searchQuery: '',

  // UI
  loading: false,
  error: null,
});

export default kbStore;
