// pos-watchlist-app — 2-panel watchlist: sidebar + content (table/board/detail)
// Filter chips for themes + pipeline stages, view toggle, column picker, flyout

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-watchlist-sidebar.js';
import '../components/pos-watchlist-table.js';
import '../components/pos-watchlist-board.js';
import '../components/pos-watchlist-detail.js';
import '../components/pos-watchlist-flyout.js';
import '../components/pos-watchlist-column-picker.js';
import '../components/pos-watchlist-search-dialog.js';
import { icon } from '../../../shared/utils/icons.js';
import store from '../store.js';
import {
  getItems, getAssetClasses, updateItem, deleteItem, refreshAll, getStats,
  createItem, createTheme, getStages, createStage, reorderStages, getThemes,
  getColumnPrefs, setColumnPrefs,
} from '../services/watchlist-api.js';

const TAG = 'pos-watchlist-app';
const VIEW_KEY = 'pos-watchlist-view';

class PosWatchlistApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
    this._addingTheme = false;
    this._addingSubTheme = false;
  }

  connectedCallback() {
    this._render();
    this._restoreViewState();
    this._unsub = store.subscribe(() => this._update());
    this._bindEvents();
    this._loadAssetClasses().then(() => this._loadItems());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  // ── Data Loading ──────────────────────────────────────

  async _loadAssetClasses() {
    try {
      const classes = await getAssetClasses();
      store.setState({ assetClasses: classes });
    } catch (err) {
      console.error('Failed to load asset classes', err);
    }
  }

  async _loadItems() {
    const { selectedView, selectedAssetClass } = store.getState();
    store.setState({ loading: true });

    try {
      const params = { limit: 500 };

      if (selectedView === 'favourites') {
        params.is_favourite = true;
      } else if (selectedView === 'asset' && selectedAssetClass) {
        params.asset_type = selectedAssetClass;
      }
      // 'all' = no asset_type filter

      // Load themes scoped to current asset class (if in asset view)
      const themeAssetType = (selectedView === 'asset' && selectedAssetClass) ? selectedAssetClass : null;
      const [items, stats, stages, themes] = await Promise.all([
        getItems(params),
        getStats().catch(() => ({})),
        getStages().catch(() => []),
        getThemes(themeAssetType).catch(() => []),
      ]);

      store.setState({ items, stats, stages, themes, loading: false, error: null });
    } catch (err) {
      store.setState({ items: [], loading: false, error: err.message });
    }
  }

  _getFilteredItems() {
    const state = store.getState();
    let items = state.items || [];

    // Sub-theme filter takes precedence (more specific)
    if (state.selectedSubThemeId) {
      items = items.filter(i => i.theme_id === state.selectedSubThemeId);
    } else if (state.selectedThemeId) {
      // Parent theme: include items in the parent OR any of its children
      const parent = (state.themes || []).find(t => t.id === state.selectedThemeId);
      if (parent) {
        const childIds = (parent.children || []).map(c => c.id);
        const validIds = new Set([parent.id, ...childIds]);
        items = items.filter(i => validIds.has(i.theme_id));
      }
    }

    return items;
  }

  // ── Render ────────────────────────────────────────────

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
        .content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        pos-watchlist-table,
        pos-watchlist-board,
        pos-watchlist-detail {
          flex: 1;
          min-height: 0;
        }
        .header-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
          position: relative;
        }
        .header-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
        .header-btn.active {
          background: var(--pos-color-action-primary);
          color: white;
          border-color: var(--pos-color-action-primary);
        }
        .header-btn svg { pointer-events: none; }

        .view-toggle {
          display: inline-flex;
          gap: 0;
        }
        .view-toggle .header-btn {
          border-radius: 0;
        }
        .view-toggle .header-btn:first-child { border-radius: var(--pos-radius-sm) 0 0 var(--pos-radius-sm); }
        .view-toggle .header-btn:last-child { border-radius: 0 var(--pos-radius-sm) var(--pos-radius-sm) 0; border-left: none; }

        .filter-area {
          padding: var(--pos-space-sm) 16px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-area.hidden { display: none; }
        .chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .chip-row-label {
          font-size: 10px;
          color: var(--pos-color-text-tertiary);
          margin-right: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 12px;
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: all 0.1s;
          white-space: nowrap;
        }
        .filter-chip:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
        .filter-chip.active {
          background: var(--pos-color-action-primary);
          color: white;
          border-color: var(--pos-color-action-primary);
        }
        .chip-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .add-chip {
          border-style: dashed;
          gap: 3px;
        }
        .add-chip svg { pointer-events: none; }
        .chip-input {
          padding: 3px 10px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: 12px;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
          width: 120px;
        }

        pos-watchlist-search-dialog { position: relative; z-index: 10000; }

        .col-picker-wrapper {
          position: relative;
          display: inline-flex;
        }
      </style>

      <pos-module-layout>
        <pos-watchlist-sidebar slot="panel"></pos-watchlist-sidebar>
        <div class="main">
          <pos-page-header id="page-header">
            <span id="header-title">Watchlist</span>
            <span slot="subtitle" id="header-meta"></span>
            <span slot="actions" id="header-actions"></span>
          </pos-page-header>

          <div class="filter-area hidden" id="filter-area"></div>

          <div class="content">
            <pos-watchlist-table style="display:none"></pos-watchlist-table>
            <pos-watchlist-board style="display:none"></pos-watchlist-board>
            <pos-watchlist-detail style="display:none"></pos-watchlist-detail>
          </div>

          <pos-watchlist-flyout></pos-watchlist-flyout>
        </div>
      </pos-module-layout>

      <pos-watchlist-search-dialog></pos-watchlist-search-dialog>
    `;

    this._update();
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-watchlist-sidebar');
    const table = this.shadow.querySelector('pos-watchlist-table');
    const board = this.shadow.querySelector('pos-watchlist-board');
    const detail = this.shadow.querySelector('pos-watchlist-detail');
    const flyout = this.shadow.querySelector('pos-watchlist-flyout');

    const isDetail = state.detailView && state.selectedItemId;
    const isAssetView = state.selectedView === 'asset' && state.selectedAssetClass;

    // Sidebar
    if (sidebar) {
      sidebar.selectedView = state.selectedView;
      sidebar.selectedAssetClass = state.selectedAssetClass;
      sidebar.assetClasses = state.assetClasses;
      sidebar.stats = state.stats;
    }

    // Page header
    this._updateHeader(state, isDetail, isAssetView);

    // Filter chips — only show for asset class views
    this._updateFilterChips(state, isDetail, isAssetView);

    // Get filtered items
    const filteredItems = this._getFilteredItems();

    // Get asset class column config
    const ac = (state.assetClasses || []).find(a => a.slug === state.selectedAssetClass);

    // Table vs Board vs Detail
    if (table) {
      const showTable = !isDetail && state.viewMode === 'table';
      table.style.display = showTable ? '' : 'none';
      if (showTable && ac) {
        table.columns = ac.columns;
        const prefs = getColumnPrefs(state.selectedAssetClass);
        table.visibleColumnKeys = prefs || ac.default_columns;
        table.themes = state.themes || [];
        table.items = filteredItems;
      }
    }
    if (board) {
      const showBoard = !isDetail && state.viewMode === 'board';
      board.style.display = showBoard ? '' : 'none';
      if (showBoard) {
        board.items = filteredItems;
        board.stages = state.stages;
        board.assetClass = ac;
      }
    }
    if (detail) {
      detail.style.display = isDetail ? '' : 'none';
      if (isDetail) {
        detail.itemId = state.selectedItemId;
      }
    }
    // Close flyout if entering detail view
    if (isDetail && flyout?.hasAttribute('open')) {
      flyout.close();
    }
  }

  _updateHeader(state, isDetail, isAssetView) {
    const titleEl = this.shadow.getElementById('header-title');
    const metaEl = this.shadow.getElementById('header-meta');
    const actionsEl = this.shadow.getElementById('header-actions');
    if (!titleEl) return;

    if (isDetail) {
      titleEl.textContent = '';
      metaEl.textContent = '';
      actionsEl.innerHTML = '';
      return;
    }

    const filteredItems = this._getFilteredItems();
    const count = filteredItems.length;

    let title = 'Watchlist';
    if (state.selectedView === 'favourites') {
      title = 'Favourites';
    } else if (isAssetView) {
      const ac = (state.assetClasses || []).find(a => a.slug === state.selectedAssetClass);
      title = ac?.label || state.selectedAssetClass;
    }

    titleEl.textContent = title;
    metaEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;

    const isTable = state.viewMode === 'table';
    actionsEl.innerHTML = `
      <div class="view-toggle">
        <button class="header-btn ${isTable ? 'active' : ''}" id="view-table-btn" title="Table view">
          ${icon('list', 14)}
        </button>
        <button class="header-btn ${!isTable ? 'active' : ''}" id="view-board-btn" title="Board view">
          ${icon('grid', 14)}
        </button>
      </div>
      ${isTable ? `
        <div class="col-picker-wrapper">
          <button class="header-btn" id="header-columns-btn" title="Columns">
            ${icon('settings', 14)}
          </button>
          <pos-watchlist-column-picker></pos-watchlist-column-picker>
        </div>
      ` : ''}
      <button class="header-btn" id="header-refresh-btn" title="Refresh All">
        ${icon('refresh-cw', 14)}
      </button>
      <button class="header-btn" id="header-add-btn">
        ${icon('plus', 14)} Add
      </button>
    `;

    // Set column picker data
    if (isTable) {
      const picker = actionsEl.querySelector('pos-watchlist-column-picker');
      const ac = (state.assetClasses || []).find(a => a.slug === state.selectedAssetClass);
      if (picker && ac) {
        picker.columns = ac.columns;
        const prefs = getColumnPrefs(state.selectedAssetClass);
        picker.visibleKeys = prefs || ac.default_columns;
      }
    }
  }

  _updateFilterChips(state, isDetail, isAssetView) {
    const area = this.shadow.getElementById('filter-area');
    if (!area) return;

    // Hide chips for non-asset views and detail view
    if (isDetail || !isAssetView) {
      area.classList.add('hidden');
      area.innerHTML = '';
      return;
    }

    area.classList.remove('hidden');

    const themes = state.themes || [];  // top-level themes with .children
    const selectedParent = themes.find(t => t.id === state.selectedThemeId);
    const subThemes = selectedParent?.children || [];

    // Row 1: parent themes + [+ Theme]
    let html = `
      <div class="chip-row" id="theme-chips">
        <span class="chip-row-label">Theme</span>
        <button class="filter-chip ${!state.selectedThemeId ? 'active' : ''}" data-theme="">All</button>
        ${themes.map(t => `
          <button class="filter-chip ${state.selectedThemeId === t.id ? 'active' : ''}" data-theme="${t.id}">
            ${this._esc(t.name)}${t.item_count ? ` <span style="opacity:0.5">${t.item_count}</span>` : ''}
          </button>
        `).join('')}
        ${this._addingTheme
          ? `<input class="chip-input" id="new-theme-input" placeholder="Theme name\u2026" autofocus />`
          : `<button class="filter-chip add-chip" id="add-theme-btn">${icon('plus', 11)} Theme</button>`
        }
      </div>
    `;

    // Row 2: sub-themes (only when a parent theme is selected and has children or we allow adding)
    if (state.selectedThemeId) {
      html += `
        <div class="chip-row" id="subtheme-chips">
          <span class="chip-row-label">Sub</span>
          <button class="filter-chip ${!state.selectedSubThemeId ? 'active' : ''}" data-subtheme="">All</button>
          ${subThemes.map(c => `
            <button class="filter-chip ${state.selectedSubThemeId === c.id ? 'active' : ''}" data-subtheme="${c.id}">
              ${this._esc(c.name)}${c.item_count ? ` <span style="opacity:0.5">${c.item_count}</span>` : ''}
            </button>
          `).join('')}
          ${this._addingSubTheme
            ? `<input class="chip-input" id="new-subtheme-input" placeholder="Sub-theme name\u2026" autofocus />`
            : `<button class="filter-chip add-chip" id="add-subtheme-btn">${icon('plus', 11)} Sub-theme</button>`
          }
        </div>
      `;
    }

    area.innerHTML = html;

    // Focus the input if adding
    if (this._addingTheme) {
      setTimeout(() => this.shadow.getElementById('new-theme-input')?.focus(), 0);
    }
    if (this._addingSubTheme) {
      setTimeout(() => this.shadow.getElementById('new-subtheme-input')?.focus(), 0);
    }
  }

  // ── Events ────────────────────────────────────────────

  _bindEvents() {
    // Sidebar: view select
    this.shadow.addEventListener('view-select', (e) => {
      const { view, assetClass } = e.detail;
      store.setState({
        selectedView: view,
        selectedAssetClass: assetClass || store.getState().selectedAssetClass,
        selectedItemId: null,
        detailView: false,
        flyoutItemId: null,
        selectedThemeId: null,
        selectedSubThemeId: null,
      });
      this._saveViewState();
      this._loadItems();
    });

    // Table: open detail
    this.shadow.addEventListener('item-open', (e) => {
      // Both table and board → navigate to detail page
      store.setState({
        selectedItemId: e.detail.itemId,
        detailView: true,
      });
      this._saveViewState();
    });

    // Table: favourite toggle
    this.shadow.addEventListener('item-favourite', async (e) => {
      const item = store.getState().items.find(i => i.id === e.detail.itemId);
      if (item) {
        await updateItem(item.id, { is_favourite: !item.is_favourite });
        this._loadItems();
      }
    });

    // Delete item (from any view)
    this.shadow.addEventListener('item-delete', async (e) => {
      const { confirmDialog } = await import('../../../shared/components/pos-confirm-dialog.js');
      if (!await confirmDialog('Remove this item from your watchlist?', { confirmLabel: 'Remove', danger: true })) return;
      try {
        await deleteItem(e.detail.itemId);
        // If viewing the deleted item, go back to list
        if (store.getState().selectedItemId === e.detail.itemId) {
          store.setState({ selectedItemId: null, detailView: false });
        }
        this._loadItems();
      } catch (err) {
        console.error('Delete item failed', err);
      }
    });

    // Detail: close
    this.shadow.addEventListener('detail-close', () => {
      store.setState({ selectedItemId: null, detailView: false });
      this._saveViewState();
      this._loadItems();
    });

    // Flyout: close
    this.shadow.addEventListener('flyout-close', () => {
      store.setState({ flyoutItemId: null });
    });

    // Flyout: open detail
    this.shadow.addEventListener('flyout-open-detail', (e) => {
      const flyout = this.shadow.querySelector('pos-watchlist-flyout');
      if (flyout) flyout.close();
      store.setState({
        selectedItemId: e.detail.itemId,
        detailView: true,
        flyoutItemId: null,
      });
      this._saveViewState();
    });

    // Board: drag-and-drop stage change
    this.shadow.addEventListener('item-stage-change', async (e) => {
      const { itemId, stageId } = e.detail;
      try {
        await updateItem(itemId, { stage_id: stageId });
        this._loadItems();
      } catch (err) {
        console.error('Stage change failed', err);
      }
    });

    // Board: create new stage
    this.shadow.addEventListener('stage-create', async (e) => {
      try {
        const stages = store.getState().stages;
        const maxPos = stages.reduce((max, s) => Math.max(max, s.position || 0), 0);
        await createStage({ name: e.detail.name, position: maxPos + 1 });
        const updatedStages = await getStages();
        store.setState({ stages: updatedStages });
      } catch (err) {
        console.error('Create stage failed', err);
      }
    });

    // Board: reorder columns
    this.shadow.addEventListener('stages-reorder', async (e) => {
      try {
        const updatedStages = await reorderStages(e.detail.stageIds);
        store.setState({ stages: updatedStages });
      } catch (err) {
        console.error('Reorder stages failed', err);
      }
    });

    // Flyout: item updated (stage/fav change)
    this.shadow.addEventListener('item-update', () => {
      this._loadItems();
    });

    // Search dialog: add item
    this.shadow.addEventListener('item-add', async (e) => {
      const { symbol, name, exchange, asset_type, theme_id } = e.detail;
      try {
        const data = { symbol, name, exchange, asset_type };
        if (theme_id) data.theme_id = theme_id;
        await createItem(data);
        this._loadItems();
        this.shadow.querySelector('pos-watchlist-sidebar')?.refreshData();
      } catch (err) {
        console.error('Failed to add item', err);
      }
    });

    // Column picker: columns changed
    this.shadow.addEventListener('columns-change', (e) => {
      const { selectedAssetClass } = store.getState();
      setColumnPrefs(selectedAssetClass, e.detail.keys);
      this._update();
    });

    // Header buttons (delegated click)
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#header-add-btn')) {
        const dialog = this.shadow.querySelector('pos-watchlist-search-dialog');
        if (dialog) {
          const state = store.getState();
          dialog.assetType = state.selectedAssetClass;
          dialog.themes = state.themes || [];
          dialog.selectedThemeId = state.selectedThemeId;
          dialog.selectedSubThemeId = state.selectedSubThemeId;
          dialog.open();
        }
        return;
      }
      if (e.target.closest('#header-refresh-btn')) {
        this._doRefreshAll();
        return;
      }
      if (e.target.closest('#view-table-btn')) {
        store.setState({ viewMode: 'table', flyoutItemId: null });
        const flyout = this.shadow.querySelector('pos-watchlist-flyout');
        if (flyout?.hasAttribute('open')) flyout.close();
        this._saveViewState();
        return;
      }
      if (e.target.closest('#view-board-btn')) {
        store.setState({ viewMode: 'board' });
        this._saveViewState();
        return;
      }
      if (e.target.closest('#header-columns-btn')) {
        const picker = this.shadow.querySelector('pos-watchlist-column-picker');
        if (picker) picker.open();
        return;
      }

      // Theme filter chips
      const themeChip = e.target.closest('[data-theme]');
      if (themeChip) {
        const id = themeChip.dataset.theme || null;
        store.setState({ selectedThemeId: id, selectedSubThemeId: null });
        this._addingSubTheme = false;
        this._update();
        return;
      }

      // Sub-theme filter chips
      const subChip = e.target.closest('[data-subtheme]');
      if (subChip) {
        const id = subChip.dataset.subtheme || null;
        store.setState({ selectedSubThemeId: id });
        this._update();
        return;
      }

      // Add theme button
      if (e.target.closest('#add-theme-btn')) {
        this._addingTheme = true;
        this._update();
        return;
      }

      // Add sub-theme button
      if (e.target.closest('#add-subtheme-btn')) {
        this._addingSubTheme = true;
        this._update();
        return;
      }
    });

    // Inline theme/subtheme input: Enter to create, Escape to cancel
    this.shadow.addEventListener('keydown', (e) => {
      const themeInput = e.target.closest('#new-theme-input');
      if (themeInput) {
        if (e.key === 'Enter' && themeInput.value.trim()) {
          this._createThemeInline(themeInput.value.trim());
        }
        if (e.key === 'Escape') { this._addingTheme = false; this._update(); }
        return;
      }
      const subInput = e.target.closest('#new-subtheme-input');
      if (subInput) {
        if (e.key === 'Enter' && subInput.value.trim()) {
          this._createSubThemeInline(subInput.value.trim());
        }
        if (e.key === 'Escape') { this._addingSubTheme = false; this._update(); }
        return;
      }
    });

    // Cancel inline inputs on blur
    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-theme-input')) {
        setTimeout(() => { if (this._addingTheme) { this._addingTheme = false; this._update(); } }, 150);
      }
      if (e.target.closest('#new-subtheme-input')) {
        setTimeout(() => { if (this._addingSubTheme) { this._addingSubTheme = false; this._update(); } }, 150);
      }
    });
  }

  async _createThemeInline(name) {
    const assetType = store.getState().selectedAssetClass;
    try {
      await createTheme({ name, asset_type: assetType });
      this._addingTheme = false;
      await this._loadItems();
      this.shadow.querySelector('pos-watchlist-sidebar')?.refreshData();
    } catch (err) {
      console.error('Failed to create theme', err);
    }
  }

  async _createSubThemeInline(name) {
    const { selectedThemeId, selectedAssetClass } = store.getState();
    if (!selectedThemeId) return;
    try {
      await createTheme({ name, parent_id: selectedThemeId, asset_type: selectedAssetClass });
      this._addingSubTheme = false;
      await this._loadItems();
      this.shadow.querySelector('pos-watchlist-sidebar')?.refreshData();
    } catch (err) {
      console.error('Failed to create sub-theme', err);
    }
  }

  async _doRefreshAll() {
    try {
      await refreshAll();
      setTimeout(() => this._loadItems(), 2000);
    } catch (err) {
      console.error('Refresh all failed', err);
    }
  }

  // ── View State Persistence ────────────────────────────

  _restoreViewState() {
    try {
      const saved = sessionStorage.getItem(VIEW_KEY);
      if (saved) {
        const { view, assetClass, viewMode, itemId, detailView } = JSON.parse(saved);
        store.setState({
          selectedView: view || 'asset',
          selectedAssetClass: assetClass || 'stock',
          viewMode: viewMode || 'table',
          selectedItemId: itemId || null,
          detailView: !!detailView,
        });
      }
    } catch { /* ignore */ }
  }

  _saveViewState() {
    const { selectedView, selectedAssetClass, viewMode, selectedItemId, detailView } = store.getState();
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({
      view: selectedView,
      assetClass: selectedAssetClass,
      viewMode,
      itemId: detailView ? selectedItemId : null,
      detailView: !!detailView,
    }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistApp);
