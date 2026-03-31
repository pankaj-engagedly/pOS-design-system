// pos-watchlist-table — Dynamic sortable metrics table driven by asset class columns

import './pos-watchlist-sparkline.js';
import { icon } from '../../../shared/utils/icons.js';
import { TABLE_STYLES } from '../../../../design-system/src/components/ui-table.js';

const TAG = 'pos-watchlist-table';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; overflow: auto; height: 100%; padding: 0 var(--pos-space-lg) var(--pos-space-lg); }
  thead { position: sticky; top: 0; z-index: 1; }
  /* Compact override */
  .pos-table { font-size: var(--pos-font-size-xs); width: 100%; table-layout: auto; }
  .pos-table td { padding: 8px 10px; }
  .pos-table th {
    padding: 8px 10px;
    cursor: pointer;
  }
  .pos-table th:hover { color: var(--pos-color-text-primary); }
  .pos-table th.right, .pos-table td.right { text-align: right; }
  tr { cursor: pointer; transition: background 0.1s; }
  .name-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fav-star {
    color: var(--pos-color-text-tertiary);
    cursor: pointer;
    flex-shrink: 0;
  }
  .fav-star.active { color: #f59e0b; }
  .fav-star:hover { color: #f59e0b; }
  tr { position: relative; }
  .row-delete {
    visibility: hidden;
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--pos-color-text-tertiary);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
  }
  tr:hover .row-delete { visibility: visible; }
  .row-delete:hover { color: var(--pos-color-priority-urgent); background: rgba(239,68,68,0.08); }
  .stage-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: var(--pos-font-weight-semibold);
    color: white;
  }
  .sort-arrow { font-size: 10px; margin-left: 2px; }
  .empty {
    text-align: center;
    padding: 48px 16px;
    color: var(--pos-color-text-tertiary);
    font-size: var(--pos-font-size-sm);
  }
  .group-header {
    background: var(--pos-color-background-secondary);
    font-weight: 600;
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
    user-select: none;
  }
  .group-header td {
    padding: 8px 12px;
  }
  .group-header .toggle {
    display: inline-block; width: 16px;
    transition: transform 0.15s;
  }
  .group-header .toggle.collapsed { transform: rotate(-90deg); }
  .group-count {
    font-weight: normal;
    color: var(--pos-color-text-secondary);
    margin-left: 8px;
  }
  .subgroup-header {
    background: var(--pos-color-background-primary);
    font-weight: 500;
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
  }
  .subgroup-header td {
    padding: 6px 12px 6px 28px;
  }
`);

class PosWatchlistTable extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [TABLE_STYLES, sheet];
    this._items = [];
    this._columns = [];           // full column defs from asset class
    this._visibleColumnKeys = []; // keys to show
    this._sortKey = null;
    this._sortDir = 'asc';
    this._themes = [];
    this._collapsedGroups = new Set();
  }

  set items(val) { this._items = val || []; this._render(); }
  set columns(val) { this._columns = val || []; this._render(); }
  set visibleColumnKeys(val) { this._visibleColumnKeys = val || []; this._render(); }
  set themes(val) { this._themes = val || []; this._render(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _getVisibleColumns() {
    if (!this._visibleColumnKeys.length) return this._columns;
    const keySet = new Set(this._visibleColumnKeys);
    // Always include 'name'
    keySet.add('name');
    return this._columns.filter(c => keySet.has(c.key));
  }

  _render() {
    const cols = this._getVisibleColumns();
    const items = this._getSortedItems(cols);

    const useGrouping = this._shouldGroup(items);

    this.shadow.innerHTML = `
      ${items.length === 0
        ? '<div class="empty">No items in this view. Click "Add" to search and add.</div>'
        : `<table class="pos-table">
          <thead><tr>
            ${cols.map(c => `
              <th class="${c.align === 'right' ? 'right' : ''}" data-sort="${c.key}" style="${c.key === 'name' ? '' : `width:${c.width}`}">
                ${c.label}
                ${this._sortKey === c.key ? `<span class="sort-arrow">${this._sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>` : ''}
              </th>
            `).join('')}
          </tr></thead>
          <tbody>
            ${useGrouping
              ? this._renderGroupedRows(items, cols)
              : items.map(item => this._renderRow(item, cols)).join('')}
          </tbody>
        </table>`
      }
    `;

    // Set sparkline data
    this.shadow.querySelectorAll('pos-watchlist-sparkline').forEach(el => {
      const data = el.getAttribute('data-sparkline');
      if (data) {
        try { el.data = JSON.parse(data); } catch {}
      }
    });
  }

  _shouldGroup(items) {
    if (!this._themes.length || !items.length) return false;
    // Build a set of theme IDs that items actually use
    const usedThemeIds = new Set(items.map(i => i.theme_id).filter(Boolean));
    // Don't group if all items are in one theme (or no themes at all)
    if (usedThemeIds.size <= 1 && items.every(i => i.theme_id)) return false;
    return usedThemeIds.size > 0;
  }

  _renderGroupedRows(items, cols) {
    const colSpan = cols.length;
    // Build theme lookup: id -> theme object (including children)
    const themeMap = new Map();
    const parentThemes = [];
    for (const t of this._themes) {
      themeMap.set(t.id, t);
      parentThemes.push(t);
      if (t.children) {
        for (const c of t.children) {
          themeMap.set(c.id, c);
        }
      }
    }

    // Group items: parent_theme_id -> sub_theme_id -> items
    // Items whose theme_id matches a parent go directly under parent
    // Items whose theme_id matches a child go under that child's parent
    const groups = new Map(); // parentId -> { theme, subgroups: Map<subId, {theme, items}>, directItems: [] }
    const uncategorized = [];

    for (const item of items) {
      if (!item.theme_id) {
        uncategorized.push(item);
        continue;
      }
      const theme = themeMap.get(item.theme_id);
      if (!theme) {
        uncategorized.push(item);
        continue;
      }

      // Is this a child theme?
      const parentId = theme.parent_id || theme.id;
      const isChild = !!theme.parent_id;

      if (!groups.has(parentId)) {
        const parentTheme = themeMap.get(parentId) || { id: parentId, name: 'Unknown' };
        groups.set(parentId, { theme: parentTheme, subgroups: new Map(), directItems: [] });
      }
      const group = groups.get(parentId);

      if (isChild) {
        if (!group.subgroups.has(theme.id)) {
          group.subgroups.set(theme.id, { theme, items: [] });
        }
        group.subgroups.get(theme.id).items.push(item);
      } else {
        group.directItems.push(item);
      }
    }

    let html = '';

    // Render each parent theme group in the order they appear in _themes
    for (const pt of parentThemes) {
      const group = groups.get(pt.id);
      if (!group) continue;

      const totalItems = group.directItems.length +
        Array.from(group.subgroups.values()).reduce((sum, sg) => sum + sg.items.length, 0);
      const collapsed = this._collapsedGroups.has(pt.id);

      html += `<tr class="group-header" data-group-id="${pt.id}">
        <td colspan="${colSpan}">
          <span class="toggle ${collapsed ? 'collapsed' : ''}">&#9660;</span>
          ${this._esc(pt.name)}<span class="group-count">${totalItems}</span>
        </td>
      </tr>`;

      if (!collapsed) {
        // Direct items (items assigned to parent theme itself)
        for (const item of group.directItems) {
          html += this._renderRow(item, cols);
        }
        // Sub-theme groups
        for (const [subId, sg] of group.subgroups) {
          const subCollapsed = this._collapsedGroups.has(subId);
          html += `<tr class="subgroup-header" data-group-id="${subId}">
            <td colspan="${colSpan}">
              <span class="toggle ${subCollapsed ? 'collapsed' : ''}">&#9660;</span>
              ${this._esc(sg.theme.name)}<span class="group-count">${sg.items.length}</span>
            </td>
          </tr>`;
          if (!subCollapsed) {
            for (const item of sg.items) {
              html += this._renderRow(item, cols);
            }
          }
        }
      }
    }

    // Also render groups for themes not in parentThemes order (safety)
    for (const [parentId, group] of groups) {
      if (parentThemes.some(pt => pt.id === parentId)) continue;
      const totalItems = group.directItems.length +
        Array.from(group.subgroups.values()).reduce((sum, sg) => sum + sg.items.length, 0);
      const collapsed = this._collapsedGroups.has(parentId);
      html += `<tr class="group-header" data-group-id="${parentId}">
        <td colspan="${colSpan}">
          <span class="toggle ${collapsed ? 'collapsed' : ''}">&#9660;</span>
          ${this._esc(group.theme.name)}<span class="group-count">${totalItems}</span>
        </td>
      </tr>`;
      if (!collapsed) {
        for (const item of group.directItems) {
          html += this._renderRow(item, cols);
        }
        for (const [subId, sg] of group.subgroups) {
          const subCollapsed = this._collapsedGroups.has(subId);
          html += `<tr class="subgroup-header" data-group-id="${subId}">
            <td colspan="${colSpan}">
              <span class="toggle ${subCollapsed ? 'collapsed' : ''}">&#9660;</span>
              ${this._esc(sg.theme.name)}<span class="group-count">${sg.items.length}</span>
            </td>
          </tr>`;
          if (!subCollapsed) {
            for (const item of sg.items) {
              html += this._renderRow(item, cols);
            }
          }
        }
      }
    }

    // Uncategorized group
    if (uncategorized.length) {
      const uncatId = '__uncategorized__';
      const collapsed = this._collapsedGroups.has(uncatId);
      html += `<tr class="group-header" data-group-id="${uncatId}">
        <td colspan="${colSpan}">
          <span class="toggle ${collapsed ? 'collapsed' : ''}">&#9660;</span>
          Uncategorized<span class="group-count">${uncategorized.length}</span>
        </td>
      </tr>`;
      if (!collapsed) {
        for (const item of uncategorized) {
          html += this._renderRow(item, cols);
        }
      }
    }

    return html;
  }

  _renderRow(item, cols) {
    const cache = item.cache || {};
    const cells = cols.map(c => this._renderCell(item, cache, c));
    return `<tr data-item-id="${item.id}">${cells.join('')}<span class="row-delete" data-delete="${item.id}" title="Remove">${icon('trash', 13)}</span></tr>`;
  }

  _renderCell(item, cache, col) {
    const key = col.key;
    const fmt = col.format;
    const align = col.align === 'right' ? 'right' : '';
    const cur = this._cur(cache.currency);

    // Special columns
    if (key === 'name') {
      return `<td>
        <div class="name-cell">
          <span class="fav-star ${item.is_favourite ? 'active' : ''}" data-fav="${item.id}">${icon('star', 13)}</span>
          <span>${this._esc(item.name)}</span>
        </div>
      </td>`;
    }
    if (key === 'symbol') return `<td>${this._esc(item.symbol)}</td>`;
    if (key === 'sparkline' || fmt === 'sparkline') {
      const data = cache.sparkline_data ? JSON.stringify(cache.sparkline_data) : '';
      return `<td><pos-watchlist-sparkline data-sparkline='${data}'></pos-watchlist-sparkline></td>`;
    }
    if (key === 'stage' || fmt === 'stage') {
      const stage = item.stage;
      return `<td>${stage ? `<span class="stage-badge" style="background:${stage.color || '#94a3b8'}">${this._esc(stage.name)}</span>` : ''}</td>`;
    }

    // Get value from cache or item
    let val;
    if (col.source === 'cache') {
      // Handle range specially
      if (key === 'fifty_two_week_range' || fmt === 'range') {
        const lo = cache.fifty_two_week_low;
        const hi = cache.fifty_two_week_high;
        return `<td>${lo != null && hi != null ? cur + lo.toFixed(0) + ' - ' + cur + hi.toFixed(0) : '--'}</td>`;
      }
      val = cache[key];
    } else {
      val = item[key];
    }

    if (val == null) return `<td class="${align}">--</td>`;

    // Format dispatch
    switch (fmt) {
      case 'price':
        return `<td class="${align}">${cur}${Number(val).toFixed(2)}</td>`;
      case 'change_pct': {
        const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : '';
        return `<td class="${align} ${cls}">${val > 0 ? '+' : ''}${Number(val).toFixed(2)}%</td>`;
      }
      case 'decimal':
        return `<td class="${align}">${Number(val).toFixed(2)}</td>`;
      case 'compact':
        return `<td class="${align}">${cur}${this._fmtCap(val, cache.currency)}</td>`;
      case 'pct_mult': {
        const pct = val * 100;
        return `<td class="${align}">${pct.toFixed(1)}%</td>`;
      }
      case 'range': {
        const lo = cache.fifty_two_week_low;
        const hi = cache.fifty_two_week_high;
        return `<td>${lo != null && hi != null ? lo.toFixed(0) + ' - ' + hi.toFixed(0) : '--'}</td>`;
      }
      default:
        return `<td class="${align}">${typeof val === 'number' ? val.toFixed(2) : this._esc(String(val))}</td>`;
    }
  }

  _getSortedItems(cols) {
    if (!this._sortKey) return [...this._items];
    const col = cols.find(c => c.key === this._sortKey);
    const items = [...this._items];
    items.sort((a, b) => {
      let va, vb;
      if (col?.source === 'cache') {
        va = a.cache?.[this._sortKey];
        vb = b.cache?.[this._sortKey];
      } else if (this._sortKey === 'stage') {
        va = a.stage?.name || '';
        vb = b.stage?.name || '';
      } else {
        va = a[this._sortKey];
        vb = b[this._sortKey];
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb);
        return this._sortDir === 'asc' ? cmp : -cmp;
      }
      return this._sortDir === 'asc' ? va - vb : vb - va;
    });
    return items;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Group header toggle
      const groupRow = e.target.closest('.group-header, .subgroup-header');
      if (groupRow) {
        const groupId = groupRow.dataset.groupId;
        if (this._collapsedGroups.has(groupId)) {
          this._collapsedGroups.delete(groupId);
        } else {
          this._collapsedGroups.add(groupId);
        }
        this._render();
        return;
      }

      // Sort header
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const key = th.dataset.sort;
        if (key === 'sparkline') return;
        if (this._sortKey === key) {
          this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sortKey = key;
          this._sortDir = 'asc';
        }
        this._render();
        return;
      }

      // Delete button
      const del = e.target.closest('.row-delete');
      if (del) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('item-delete', {
          bubbles: true, composed: true,
          detail: { itemId: del.dataset.delete },
        }));
        return;
      }

      // Favourite star
      const star = e.target.closest('.fav-star');
      if (star) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('item-favourite', {
          bubbles: true, composed: true,
          detail: { itemId: star.dataset.fav },
        }));
        return;
      }

      // Row click
      const row = e.target.closest('tr[data-item-id]');
      if (row) {
        this.dispatchEvent(new CustomEvent('item-open', {
          bubbles: true, composed: true,
          detail: { itemId: row.dataset.itemId },
        }));
      }
    });
  }

  _cur(code) {
    const map = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', CAD: 'C$', AUD: 'A$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$' };
    return map[code] || (code ? code + ' ' : '');
  }

  _fmtCap(n, currency) {
    if (n == null) return '--';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (currency === 'INR') {
      if (abs >= 1e7) {
        const cr = abs / 1e7;
        return sign + cr.toLocaleString('en-IN', { maximumFractionDigits: cr >= 100 ? 0 : 2 }) + ' Cr';
      }
      if (abs >= 1e5) return sign + (abs / 1e5).toFixed(2) + ' L';
      return sign + abs.toLocaleString('en-IN');
    }
    if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + 'T';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
    return sign + abs.toLocaleString();
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistTable);
