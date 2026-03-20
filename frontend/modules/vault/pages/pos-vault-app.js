// pos-vault-app — Vault: category sidebar + detailed item cards (inline editing)

import '../../../shared/components/pos-module-layout.js';
import '../components/pos-vault-sidebar.js';
import '../components/pos-vault-category-view.js';
import '../components/pos-vault-all-items-view.js';
import '../components/pos-vault-template-editor.js';
import * as api from '../services/vault-api.js';
import store from '../store.js';

const TAG = 'pos-vault-app';
const STORAGE_KEY = 'pos-vault-selected';

class PosVaultApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._restoreSelection();
    this._render();
    this._bindEvents();
    this._loadCategories();
  }

  _restoreSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.categoryId) {
        store.setState({ selectedCategoryId: saved.categoryId, selectedView: null });
      } else if (saved?.view) {
        store.setState({ selectedView: saved.view, selectedCategoryId: null });
      }
    } catch { /* ignore */ }
  }

  _persistSelection() {
    const { selectedView, selectedCategoryId } = store.getState();
    if (selectedCategoryId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categoryId: selectedCategoryId }));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view: selectedView || 'all' }));
    }
  }

  // ── Refs ────────────────────────────────────────────────────────────────────

  _sidebar()        { return this.shadow.querySelector('pos-vault-sidebar'); }
  _content()        { return this.shadow.querySelector('.content'); }
  _templateEditor() { return this.shadow.querySelector('pos-vault-template-editor'); }

  // ── Data ────────────────────────────────────────────────────────────────────

  async _loadCategories() {
    try {
      const categories = await api.getCategories();
      store.setState({ categories });
      const { selectedCategoryId } = store.getState();
      if (selectedCategoryId && !categories.find(c => c.id === selectedCategoryId)) {
        store.setState({ selectedCategoryId: null, selectedView: 'all' });
        this._persistSelection();
      }
      this._syncSidebar();
      await this._loadItems();
    } catch (e) {
      store.setState({ error: e.message });
    }
  }

  async _loadItems() {
    const { selectedView, selectedCategoryId, searchQuery } = store.getState();
    store.setState({ loading: true });
    try {
      const params = {};
      if (selectedCategoryId)           params.category_id = selectedCategoryId;
      if (selectedView === 'favourites') params.is_favorite = true;
      if (searchQuery)                   params.search = searchQuery;

      const basicItems = await api.getItems(params);
      // Load full detail (with sections/fields) for each item
      const items = await Promise.all(
        basicItems.map(item => api.getItem(item.id).catch(() => item))
      );
      store.setState({ items, loading: false });
      this._syncContentView();
    } catch (e) {
      store.setState({ loading: false });
    }
  }

  async _loadTemplates(categoryId) {
    try {
      const templates = await api.getTemplates(categoryId);
      store.setState({ templates });
      return templates;
    } catch { return []; }
  }

  /** Refresh a single item in the active view without re-rendering all cards */
  async _refreshSingleItem(itemId) {
    try {
      const updated = await api.getItem(itemId);
      // Update in store
      const { items } = store.getState();
      store.setState({ items: items.map(i => i.id === itemId ? updated : i) });
      // Find and refresh the specific card
      const view = this._content()?.querySelector('pos-vault-category-view, pos-vault-all-items-view');
      if (view) view.refreshItem(updated);
    } catch (err) {
      console.error('Failed to refresh item:', err);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
        .content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        pos-vault-category-view,
        pos-vault-all-items-view {
          flex: 1;
          min-height: 0;
        }
      </style>

      <pos-module-layout panel-width="240">
        <pos-vault-sidebar slot="panel"></pos-vault-sidebar>
        <div class="main">
          <div class="content"></div>
        </div>
      </pos-module-layout>

      <pos-vault-template-editor></pos-vault-template-editor>
    `;
    this._syncSidebar();
    this._syncContentView();
  }

  _syncSidebar() {
    const { categories, selectedView, selectedCategoryId } = store.getState();
    const sidebar = this._sidebar();
    if (!sidebar) return;
    sidebar.categories = categories;
    if (selectedCategoryId) {
      sidebar.selectedCategoryId = selectedCategoryId;
    } else {
      sidebar.selectedView = selectedView || 'all';
    }
  }

  _syncContentView() {
    const area = this._content();
    if (!area) return;
    const { selectedCategoryId, selectedView, categories, items } = store.getState();

    if (selectedCategoryId) {
      let view = area.querySelector('pos-vault-category-view');
      if (!view) {
        area.innerHTML = '<pos-vault-category-view></pos-vault-category-view>';
        view = area.querySelector('pos-vault-category-view');
      }
      view.category = categories.find(c => c.id === selectedCategoryId) || null;
      view.items = items;
    } else {
      let view = area.querySelector('pos-vault-all-items-view');
      if (!view) {
        area.innerHTML = '<pos-vault-all-items-view></pos-vault-all-items-view>';
        view = area.querySelector('pos-vault-all-items-view');
      }
      view.title = selectedView === 'favourites' ? 'Favourites' : 'All Items';
      view.categories = categories;
      view.items = items;
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  _bindEvents() {
    const s = this.shadow;

    // ── Sidebar ────────────────────────────────────────────────────────────

    s.addEventListener('view-select', async (e) => {
      store.setState({ selectedView: e.detail.view, selectedCategoryId: null,
        selectedItemId: null, selectedItem: null, searchQuery: '', templates: [] });
      this._persistSelection();
      this._syncSidebar();
      await this._loadItems();
    });

    s.addEventListener('category-select', async (e) => {
      const { categoryId } = e.detail;
      store.setState({ selectedCategoryId: categoryId, selectedView: null,
        selectedItemId: null, selectedItem: null, searchQuery: '' });
      this._persistSelection();
      this._syncSidebar();
      await this._loadItems();
      this._loadTemplates(categoryId);
    });

    s.addEventListener('category-create', async (e) => {
      try {
        const cat = await api.createCategory({ name: e.detail.name });
        await this._loadCategories();
        store.setState({ selectedCategoryId: cat.id, selectedView: null,
          selectedItemId: null, selectedItem: null });
        this._persistSelection();
        this._syncSidebar();
        await this._loadItems();
      } catch (err) {
        console.error('Failed to create category:', err);
      }
    });

    s.addEventListener('category-rename', async (e) => {
      try {
        await api.updateCategory(e.detail.categoryId, { name: e.detail.name });
        await this._loadCategories();
        this._syncSidebar();
      } catch (err) {
        console.error('Failed to rename category:', err);
      }
    });

    s.addEventListener('category-delete', async (e) => {
      const { categoryId } = e.detail;
      const { categories } = store.getState();
      const cat = categories.find(c => c.id === categoryId);
      const count = cat?.item_count || 0;
      const msg = count > 0
        ? `Delete "${cat?.name}"? This will also delete ${count} item${count !== 1 ? 's' : ''}.`
        : `Delete category "${cat?.name}"?`;
      if (!confirm(msg)) return;
      try {
        await api.deleteCategory(categoryId);
        if (store.getState().selectedCategoryId === categoryId) {
          store.setState({ selectedCategoryId: null, selectedView: 'all',
            selectedItemId: null, selectedItem: null });
          this._persistSelection();
        }
        await this._loadCategories();
        this._syncSidebar();
        this._syncContentView();
      } catch (err) {
        console.error('Failed to delete category:', err);
      }
    });

    // ── Items: create / delete / favourite / update ────────────────────────

    s.addEventListener('item-create', async () => {
      const { selectedCategoryId } = store.getState();
      if (!selectedCategoryId) return;
      try {
        await api.createItem({ name: 'Untitled', category_id: selectedCategoryId, icon: '🔐' });
        await this._loadCategories();
        this._syncSidebar();
        await this._loadItems();
      } catch (err) {
        console.error('Failed to create item:', err);
      }
    });

    s.addEventListener('item-delete', async (e) => {
      if (!confirm('Delete this item?')) return;
      try {
        await api.deleteItem(e.detail.itemId);
        await this._loadCategories();
        this._syncSidebar();
        await this._loadItems();
      } catch (err) {
        console.error('Failed to delete item:', err);
      }
    });

    s.addEventListener('item-favourite', async (e) => {
      const { itemId, is_favorite } = e.detail;
      try {
        await api.updateItem(itemId, { is_favorite });
        const { selectedView } = store.getState();
        if (selectedView === 'favourites') {
          await this._loadItems();
        } else {
          await this._refreshSingleItem(itemId);
        }
      } catch (err) {
        console.error('Failed to toggle favourite:', err);
      }
    });

    s.addEventListener('item-update', async (e) => {
      const { itemId, updates } = e.detail;
      try {
        await api.updateItem(itemId, updates);
        await this._refreshSingleItem(itemId);
      } catch (err) {
        console.error('Failed to update item:', err);
      }
    });

    // ── Fields: inline save / add / delete ─────────────────────────────────

    s.addEventListener('field-inline-save', async (e) => {
      const { itemId, valueId, templateId, value } = e.detail;
      try {
        if (valueId) {
          await api.updateFieldValue(itemId, valueId, { field_value: value });
        } else if (templateId) {
          await api.addFieldValue(itemId, { template_id: templateId, field_value: value });
        }
        await this._refreshSingleItem(itemId);
      } catch (err) {
        console.error('Failed to save field:', err);
      }
    });

    s.addEventListener('field-add-standalone', async (e) => {
      const { itemId, fieldName, fieldType, value } = e.detail;
      try {
        await api.addFieldValue(itemId, {
          field_name: fieldName,
          field_type: fieldType,
          field_value: value,
        });
        await this._refreshSingleItem(itemId);
      } catch (err) {
        console.error('Failed to add field:', err);
      }
    });

    s.addEventListener('field-delete-standalone', async (e) => {
      const { itemId, valueId } = e.detail;
      try {
        await api.deleteFieldValue(itemId, valueId);
        await this._refreshSingleItem(itemId);
      } catch (err) {
        console.error('Failed to delete field:', err);
      }
    });

    // ── Templates ──────────────────────────────────────────────────────────

    s.addEventListener('manage-templates', async () => {
      const { selectedCategoryId, categories } = store.getState();
      if (!selectedCategoryId) return;
      const category = categories.find(c => c.id === selectedCategoryId);
      const templates = await this._loadTemplates(selectedCategoryId);
      this._templateEditor()?.open(category, templates);
    });

    s.addEventListener('template-create', async (e) => {
      const { selectedCategoryId } = store.getState();
      if (!selectedCategoryId) return;
      try {
        await api.createTemplate(selectedCategoryId, e.detail);
        const templates = await this._loadTemplates(selectedCategoryId);
        this._templateEditor()?.updateTemplates(templates);
      } catch (err) {
        console.error('Failed to create template:', err);
      }
    });

    s.addEventListener('template-update', async (e) => {
      const { selectedCategoryId } = store.getState();
      if (!selectedCategoryId) return;
      try {
        await api.updateTemplate(selectedCategoryId, e.detail.templateId, e.detail.updates);
        const templates = await this._loadTemplates(selectedCategoryId);
        this._templateEditor()?.updateTemplates(templates);
      } catch (err) {
        console.error('Failed to update template:', err);
      }
    });

    s.addEventListener('template-delete', async (e) => {
      const { selectedCategoryId } = store.getState();
      if (!selectedCategoryId) return;
      try {
        await api.deleteTemplate(selectedCategoryId, e.detail.templateId);
        const templates = await this._loadTemplates(selectedCategoryId);
        this._templateEditor()?.updateTemplates(templates);
      } catch (err) {
        console.error('Failed to delete template:', err);
      }
    });

    s.addEventListener('template-reorder', async (e) => {
      const { selectedCategoryId } = store.getState();
      if (!selectedCategoryId) return;
      api.reorderTemplates(selectedCategoryId, e.detail.orderedIds).catch(err =>
        console.error('Failed to reorder templates:', err)
      );
    });

    s.addEventListener('editor-close', () => {
      this._templateEditor()?.close();
    });

    // ── Search ─────────────────────────────────────────────────────────────

    s.addEventListener('search-change', async (e) => {
      store.setState({ searchQuery: e.detail.query });
      await this._loadItems();
    });
  }
}

customElements.define(TAG, PosVaultApp);
