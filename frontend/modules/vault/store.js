// Vault module state store

import { createStore } from '../../shared/services/state-store.js';

const vaultStore = createStore({
  categories: [],          // CategoryResponse[]
  selectedCategoryId: null, // UUID — null = "All Items" or "Favourites"
  selectedView: 'all',     // 'all' | 'favourites' | null (when category selected)
  items: [],               // VaultItemResponse[]
  selectedItemId: null,    // UUID
  selectedItem: null,      // VaultItemDetailResponse (resolved sections)
  templates: [],           // FieldTemplateResponse[] for selected category
  searchQuery: '',
  loading: false,
  error: null,
});

export default vaultStore;
