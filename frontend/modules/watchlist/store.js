// Watchlist module state store

import { createStore } from '../../shared/services/state-store.js';

const watchlistStore = createStore({
  // Navigation
  selectedView: 'all',              // 'all' | 'favourites'
  selectedAssetClass: 'stock',      // slug from asset class registry
  selectedItemId: null,             // For detail view

  // View mode
  viewMode: 'table',               // 'table' | 'board'

  // Filter chips
  selectedThemeId: null,            // parent theme filter (null = all)
  selectedSubThemeId: null,         // sub-theme filter (null = all)

  // Data
  items: [],
  stages: [],
  themes: [],
  tags: [],
  assetClasses: [],
  stats: {},

  // UI
  loading: false,
  error: null,
  detailView: false,                // true = show detail page
  flyoutItemId: null,               // item ID for flyout quick-view
});

export default watchlistStore;
