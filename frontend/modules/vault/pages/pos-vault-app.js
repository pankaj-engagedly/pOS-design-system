// pos-vault-app — main vault page: sidebar + item list + detail panel

import '../components/pos-vault-sidebar.js';
import '../components/pos-vault-item-list.js';
import '../components/pos-vault-item-detail.js';
import * as api from '../services/vault-api.js';
import store from '../store.js';

const TAG = 'pos-vault-app';

class PosVaultApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
    this._favorites = false;
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
    this._loadAll();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadAll() {
    await Promise.all([this._loadItems(), this._loadTags()]);
  }

  async _loadItems() {
    const { activeTag, searchQuery } = store.getState();
    store.setState({ loading: true, error: null });
    try {
      const items = await api.getItems({
        tag: activeTag || undefined,
        search: searchQuery || undefined,
        favorites: this._favorites || undefined,
      });
      store.setState({ items, loading: false });
    } catch (e) {
      store.setState({ loading: false, error: e.message });
    }
  }

  async _loadTags() {
    try {
      const tags = await api.getTags();
      store.setState({ tags });
    } catch { /* non-fatal */ }
  }

  async _loadSelectedItem(itemId) {
    try {
      const item = await api.getItem(itemId);
      store.setState({ selectedItem: item });
    } catch (e) {
      store.setState({ selectedItem: null });
    }
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-columns: 200px 280px 1fr;
          height: 100%;
          overflow: hidden;
          background: var(--pos-color-background-primary);
        }
        .sidebar {
          border-right: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          overflow-y: auto;
        }
        .list-panel {
          border-right: 1px solid var(--pos-color-border-default);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .detail-panel {
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
      </style>

      <div class="sidebar">
        <pos-vault-sidebar></pos-vault-sidebar>
      </div>
      <div class="list-panel">
        <pos-vault-item-list></pos-vault-item-list>
      </div>
      <div class="detail-panel">
        <pos-vault-item-detail></pos-vault-item-detail>
      </div>
    `;
  }

  _bindEvents() {
    // Sidebar filter changes
    this.shadow.addEventListener('filter-change', async (e) => {
      const { tag, favorites } = e.detail;
      this._favorites = favorites;
      store.setState({ activeTag: tag, selectedItemId: null, selectedItem: null });
      await this._loadItems();
    });

    // Search from item list
    this.shadow.addEventListener('search-change', async () => {
      await this._loadItems();
    });

    // Create new item
    this.shadow.addEventListener('item-create', async () => {
      try {
        const item = await api.createItem({ name: 'New Item', icon: '🔐' });
        await this._loadItems();
        await this._loadTags();
        store.setState({ selectedItemId: item.id, selectedItem: item });
      } catch (e) {
        alert('Failed to create item: ' + e.message);
      }
    });

    // Select item
    this.shadow.addEventListener('item-select', async (e) => {
      await this._loadSelectedItem(e.detail.itemId);
    });

    // Update item metadata (name, description, icon, is_favorite)
    this.shadow.addEventListener('item-update', async (e) => {
      const { itemId, updates } = e.detail;
      try {
        const item = await api.updateItem(itemId, updates);
        store.setState({ selectedItem: item });
        await this._loadItems();
      } catch (err) {
        console.error('Failed to update item:', err);
      }
    });

    // Delete item
    this.shadow.addEventListener('item-delete', async (e) => {
      try {
        await api.deleteItem(e.detail.itemId);
        store.setState({ selectedItemId: null, selectedItem: null });
        await this._loadAll();
      } catch (err) {
        alert('Failed to delete item');
      }
    });

    // Add field
    this.shadow.addEventListener('field-add', async (e) => {
      const { itemId, field } = e.detail;
      try {
        await api.addField(itemId, field);
        await this._loadSelectedItem(itemId);
        await this._loadItems(); // refresh field count
      } catch (err) {
        alert('Failed to add field: ' + err.message);
      }
    });

    // Update field
    this.shadow.addEventListener('field-update', async (e) => {
      const { itemId, fieldId, updates } = e.detail;
      try {
        await api.updateField(itemId, fieldId, updates);
        await this._loadSelectedItem(itemId);
      } catch (err) {
        alert('Failed to update field: ' + err.message);
      }
    });

    // Delete field
    this.shadow.addEventListener('field-delete', async (e) => {
      const { itemId, fieldId } = e.detail;
      try {
        await api.deleteField(itemId, fieldId);
        await this._loadSelectedItem(itemId);
        await this._loadItems(); // refresh field count
      } catch (err) {
        alert('Failed to delete field');
      }
    });

    // Add tag
    this.shadow.addEventListener('tag-add', async (e) => {
      const { itemId, name } = e.detail;
      try {
        await api.addTag(itemId, name);
        await this._loadSelectedItem(itemId);
        await this._loadTags();
        await this._loadItems();
      } catch (err) {
        console.error('Failed to add tag:', err);
      }
    });

    // Remove tag
    this.shadow.addEventListener('tag-remove', async (e) => {
      const { itemId, tagId } = e.detail;
      try {
        await api.removeTag(itemId, tagId);
        await this._loadSelectedItem(itemId);
        await this._loadTags();
        await this._loadItems();
      } catch (err) {
        console.error('Failed to remove tag:', err);
      }
    });
  }
}

customElements.define(TAG, PosVaultApp);
