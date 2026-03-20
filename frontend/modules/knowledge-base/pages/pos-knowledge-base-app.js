// pos-knowledge-base-app — 2-panel KB app: sidebar + content area + detail flyout

import '../../../shared/components/pos-module-layout.js';
import '../components/pos-kb-sidebar.js';
import '../components/pos-kb-list-page.js';
import '../components/pos-kb-item-detail.js';
import '../components/pos-kb-add-content-dialog.js';
import '../components/pos-kb-feed-timeline.js';
import '../components/pos-kb-subscribe-dialog.js';
import store from '../store.js';
import { getItems, getItem, updateItem, deleteItem, addTag, getStats, getTags } from '../services/kb-api.js';
import { getFeedItems, getFeedSources, updateFeedItem, saveFeedItemToKB, markAllRead } from '../services/feed-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';

const TAG = 'pos-knowledge-base-app';
const KB_VIEW_KEY = 'pos-kb-view';

const VIEW_TITLES = {
  all: 'All Items',
  favourites: 'Favourites',
  top_rated: 'Top Rated',
  recent: 'Recently Added',
};

class PosKnowledgeBaseApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
  }

  connectedCallback() {
    this._render();
    this._restoreViewState();
    this._unsub = store.subscribe(() => this._update());
    this._bindEvents();

    if (store.getState().selectedView === 'feeds') {
      this._loadFeedsPage();
    } else {
      this._loadItems();
    }
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadItems() {
    const { selectedView, selectedCollectionId, activeTag, minRating, searchQuery } = store.getState();
    store.setState({ loading: true });

    try {
      const params = { limit: 100 };

      if (searchQuery) {
        params.search = searchQuery;
      } else if (selectedView === 'favourites') {
        params.is_favourite = true;
      } else if (selectedView === 'top_rated') {
        params.has_rating = true;
        params.sort_by = 'rating';
        if (minRating) params.min_rating = minRating;
      } else if (selectedView === 'recent') {
        params.sort_by = 'created_at';
        params.limit = 50;
      }
      // 'all' — no extra filter

      if (selectedCollectionId) {
        params.collection_id = selectedCollectionId;
      }

      if (activeTag) params.tag = activeTag;

      const [items, tags, stats] = await Promise.all([
        getItems(params),
        getTags(),
        getStats(),
      ]);
      store.setState({ items, tags, stats, loading: false });
    } catch (err) {
      store.setState({ items: [], loading: false, error: err.message });
    }
  }

  async _loadFeedsPage() {
    const { feedFilter, feedUnreadOnly } = store.getState();
    store.setState({ loading: true });
    try {
      const [feedItems, feedSources] = await Promise.all([
        getFeedItems({
          source_id: feedFilter,
          is_read: feedUnreadOnly ? false : undefined,
          limit: 100,
        }),
        getFeedSources(),
      ]);
      store.setState({ feedItems, feedSources, loading: false });
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .main {
          position: relative;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        pos-kb-list-page, pos-kb-feed-timeline {
          flex: 1;
          min-height: 0;
        }
        pos-kb-add-content-dialog, pos-kb-subscribe-dialog {
          position: fixed;
        }
      </style>

      <pos-module-layout>
        <pos-kb-sidebar slot="panel"></pos-kb-sidebar>
        <div class="main">
          <pos-kb-list-page></pos-kb-list-page>
          <pos-kb-feed-timeline style="display:none"></pos-kb-feed-timeline>
          <pos-kb-item-detail></pos-kb-item-detail>
        </div>
      </pos-module-layout>

      <pos-kb-add-content-dialog></pos-kb-add-content-dialog>
      <pos-kb-subscribe-dialog></pos-kb-subscribe-dialog>
    `;

    this._update();
  }

  _update() {
    const state = store.getState();
    const listPage = this.shadow.querySelector('pos-kb-list-page');
    const feedTimeline = this.shadow.querySelector('pos-kb-feed-timeline');
    const sidebar = this.shadow.querySelector('pos-kb-sidebar');
    const isFeeds = state.selectedView === 'feeds' && !state.selectedCollectionId;

    if (sidebar) {
      sidebar.selectedView = state.selectedView;
      sidebar.selectedCollectionId = state.selectedCollectionId;
      sidebar.stats = state.stats;
    }

    if (listPage) {
      listPage.style.display = isFeeds ? 'none' : '';
      if (!isFeeds) {
        listPage.items = state.items;
        listPage.tags = state.tags;
        listPage.activeTag = state.activeTag;
        listPage.minRating = state.minRating;
        listPage.showRatingFilter = state.selectedView === 'top_rated';
        listPage.selectedItemId = state.selectedItemId;

        if (state.selectedCollectionId) {
          listPage.listTitle = state.selectedCollectionName || 'Collection';
        } else {
          listPage.listTitle = VIEW_TITLES[state.selectedView] || 'Items';
        }
      }
    }

    if (feedTimeline) {
      feedTimeline.style.display = isFeeds ? '' : 'none';
      if (isFeeds) {
        feedTimeline.items = state.feedItems;
        feedTimeline.sources = state.feedSources;
        feedTimeline.selectedSourceId = state.feedFilter;
        feedTimeline.unreadOnly = state.feedUnreadOnly;
      }
    }
  }

  _bindEvents() {
    // Sidebar: view select
    this.shadow.addEventListener('view-select', (e) => {
      const { view } = e.detail;
      store.setState({
        selectedView: view,
        selectedCollectionId: null,
        selectedCollectionName: '',
        selectedItemId: null,
        activeTag: null,
        minRating: null,
        searchQuery: '',
      });
      this._saveViewState();
      this._closeDetail();

      if (view === 'feeds') {
        this._loadFeedsPage();
      } else {
        this._loadItems();
      }
    });

    // Sidebar: collection select
    this.shadow.addEventListener('collection-select', (e) => {
      const { collectionId, collectionName } = e.detail;
      store.setState({
        selectedView: 'all',
        selectedCollectionId: collectionId,
        selectedCollectionName: collectionName,
        selectedItemId: null,
        activeTag: null,
        minRating: null,
        searchQuery: '',
      });
      this._saveViewState();
      this._closeDetail();
      this._loadItems();
    });

    // Sidebar data changed (collection created/deleted)
    this.shadow.addEventListener('sidebar-changed', () => {
      this._loadItems();
    });

    // Item selection → open detail flyout
    this.shadow.addEventListener('item-select', async (e) => {
      const { itemId } = e.detail;
      store.setState({ selectedItemId: itemId });
      try {
        const item = await getItem(itemId);
        this.shadow.querySelector('pos-kb-item-detail')?.openForItem(item);
      } catch (err) {
        console.error('Failed to load item', err);
      }
    });

    // Item card actions (favourite, delete)
    this.shadow.addEventListener('item-action', async (e) => {
      const { action, itemId } = e.detail;
      if (action === 'favourite') {
        const item = this._findItem(itemId);
        if (item) {
          await updateItem(itemId, { is_favourite: !item.is_favourite });
          this._loadItems();
        }
      } else if (action === 'delete') {
        if (!await confirmDialog('Delete this item?', { confirmLabel: 'Delete', danger: true })) return;
        await deleteItem(itemId);
        this._closeDetail();
        this._loadItems();
      }
    });

    // Detail panel actions
    this.shadow.addEventListener('detail-action', async (e) => {
      const { action, itemId } = e.detail;

      if (action === 'update-rating') {
        const currentItem = this._findItem(itemId);
        const newRating = currentItem?.rating === parseInt(e.detail.rating) ? null : parseInt(e.detail.rating);
        const updated = await updateItem(itemId, { rating: newRating });
        this.shadow.querySelector('pos-kb-item-detail')?.refreshItem(updated);
        this._loadItems();
      } else if (action === 'favourite') {
        const item = this._findItem(itemId);
        if (item) {
          const updated = await updateItem(itemId, { is_favourite: !item.is_favourite });
          this.shadow.querySelector('pos-kb-item-detail')?.refreshItem(updated);
          this._loadItems();
        }
      } else if (action === 'add-tag-submit') {
        const updated = await addTag(itemId, e.detail.tagName);
        this.shadow.querySelector('pos-kb-item-detail')?.refreshItem(updated);
        this._loadItems();
        getTags().then(tags => store.setState({ tags }));
      } else if (action === 'remove-tag') {
        const { removeTag: removeTagFn } = await import('../services/kb-api.js');
        await removeTagFn(itemId, e.detail.tagId);
        const updated = await getItem(itemId);
        this.shadow.querySelector('pos-kb-item-detail')?.refreshItem(updated);
        this._loadItems();
        getTags().then(tags => store.setState({ tags }));
      } else if (action === 'collections-changed') {
        this._loadItems();
        this.shadow.querySelector('pos-kb-sidebar')?.refreshData();
      } else if (action === 'delete') {
        if (!await confirmDialog('Delete this item?', { confirmLabel: 'Delete', danger: true })) return;
        await deleteItem(itemId);
        this._closeDetail();
        this._loadItems();
      }
    });

    // Tag filter (from list page)
    this.shadow.addEventListener('tag-filter', (e) => {
      store.setState({ activeTag: e.detail.tag });
      this._loadItems();
    });

    // Rating filter (from list page)
    this.shadow.addEventListener('rating-filter', (e) => {
      store.setState({ minRating: e.detail.minRating });
      this._loadItems();
    });

    // Search (from list page)
    this.shadow.addEventListener('search-change', (e) => {
      store.setState({ searchQuery: e.detail.query });
      this._loadItems();
    });

    // Add content dialog
    this.shadow.addEventListener('open-add-content', (e) => {
      const mode = e.detail?.mode || 'url';
      this.shadow.querySelector('pos-kb-add-content-dialog')?.open(mode);
    });

    this.shadow.addEventListener('item-saved', () => {
      this._loadItems();
      this.shadow.querySelector('pos-kb-sidebar')?.refreshData();
    });

    // ── Feed events ──

    this.shadow.addEventListener('source-filter', (e) => {
      store.setState({ feedFilter: e.detail.sourceId });
      this._loadFeedsPage();
    });

    this.shadow.addEventListener('toggle-unread-filter', () => {
      store.setState({ feedUnreadOnly: !store.getState().feedUnreadOnly });
      this._loadFeedsPage();
    });

    this.shadow.addEventListener('mark-all-read', async (e) => {
      await markAllRead(e.detail.sourceId);
      this._loadFeedsPage();
      this.shadow.querySelector('pos-kb-sidebar')?.refreshData();
    });

    this.shadow.addEventListener('feed-item-action', async (e) => {
      const { action, itemId, item } = e.detail;
      if (action === 'toggle-read') {
        await updateFeedItem(itemId, { is_read: !item.is_read });
        this._loadFeedsPage();
      } else if (action === 'toggle-star') {
        await updateFeedItem(itemId, { is_starred: !item.is_starred });
        this._loadFeedsPage();
      } else if (action === 'save-to-kb') {
        if (!item.kb_item_id) {
          await saveFeedItemToKB(itemId);
          this._loadFeedsPage();
        }
      }
    });

    this.shadow.addEventListener('open-subscribe', () => {
      this.shadow.querySelector('pos-kb-subscribe-dialog')?.open();
    });

    this.shadow.addEventListener('feed-subscribed', () => {
      this._loadFeedsPage();
      this.shadow.querySelector('pos-kb-sidebar')?.refreshData();
    });

    // Back from feed timeline
    this.shadow.addEventListener('navigate-back', () => {
      store.setState({ selectedView: 'all', selectedCollectionId: null, selectedCollectionName: '' });
      this._saveViewState();
      this._loadItems();
    });
  }

  _findItem(itemId) {
    return store.getState().items.find(i => i.id === itemId);
  }

  _restoreViewState() {
    try {
      const saved = sessionStorage.getItem(KB_VIEW_KEY);
      if (saved) {
        const { view, collectionId, collectionName } = JSON.parse(saved);
        store.setState({
          selectedView: view || 'all',
          selectedCollectionId: collectionId || null,
          selectedCollectionName: collectionName || '',
        });
      }
    } catch { /* ignore */ }
  }

  _saveViewState() {
    const { selectedView, selectedCollectionId, selectedCollectionName } = store.getState();
    sessionStorage.setItem(KB_VIEW_KEY, JSON.stringify({
      view: selectedView,
      collectionId: selectedCollectionId,
      collectionName: selectedCollectionName,
    }));
  }

  _closeDetail() {
    this.shadow.querySelector('pos-kb-item-detail')?.close();
    store.setState({ selectedItemId: null });
  }
}

customElements.define(TAG, PosKnowledgeBaseApp);
