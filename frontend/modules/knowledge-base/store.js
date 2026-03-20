// Knowledge Base module state store

import { createStore } from '../../shared/services/state-store.js';

const kbStore = createStore({
  // Sidebar-based navigation
  selectedView: 'home',        // home | favourites | recent | top_rated | feeds
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
