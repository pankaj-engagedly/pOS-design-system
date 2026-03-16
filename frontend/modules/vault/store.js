// Vault module state store

import { createStore } from '../../shared/services/state-store.js';

const vaultStore = createStore({
  items: [],
  selectedItemId: null,
  selectedItem: null,   // full detail with fields
  tags: [],
  activeTag: null,      // tag name filter
  searchQuery: '',
  loading: false,
  error: null,
});

export default vaultStore;
