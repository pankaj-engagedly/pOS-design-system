// pos-watchlist-table — Dynamic sortable metrics table driven by asset class columns

import './pos-watchlist-sparkline.js';
import { icon } from '../../../shared/utils/icons.js';

const TAG = 'pos-watchlist-table';

class PosWatchlistTable extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._items = [];
    this._columns = [];           // full column defs from asset class
    this._visibleColumnKeys = []; // keys to show
    this._sortKey = null;
    this._sortDir = 'asc';
  }

  set items(val) { this._items = val || []; this._render(); }
  set columns(val) { this._columns = val || []; this._render(); }
  set visibleColumnKeys(val) { this._visibleColumnKeys = val || []; this._render(); }

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

    this.shadow.innerHTML = `
      <style>
        :host { display: block; overflow: auto; height: 100%; }
        table { width: 100%; border-collapse: collapse; font-size: var(--pos-font-size-xs); }
        thead { position: sticky; top: 0; z-index: 1; }
        th {
          padding: 8px 10px;
          text-align: left;
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-secondary);
          background: var(--pos-color-background-secondary);
          border-bottom: 1px solid var(--pos-color-border-default);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        th:hover { color: var(--pos-color-text-primary); }
        th.right, td.right { text-align: right; }
        td {
          padding: 8px 10px;
          color: var(--pos-color-text-primary);
          border-bottom: 1px solid var(--pos-color-border-subtle);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        tr { cursor: pointer; transition: background 0.1s; }
        tr:hover { background: var(--pos-color-background-secondary); }
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
        .row-delete {
          visibility: hidden;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
        }
        tr:hover .row-delete { visibility: visible; }
        .row-delete:hover { color: var(--pos-color-priority-urgent); background: rgba(239,68,68,0.08); }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
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
      </style>
      ${items.length === 0
        ? '<div class="empty">No items in this view. Click "Add" to search and add.</div>'
        : `<table>
          <thead><tr>
            ${cols.map(c => `
              <th class="${c.align === 'right' ? 'right' : ''}" data-sort="${c.key}" style="width:${c.width}">
                ${c.label}
                ${this._sortKey === c.key ? `<span class="sort-arrow">${this._sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>` : ''}
              </th>
            `).join('')}
          </tr></thead>
          <tbody>
            ${items.map(item => this._renderRow(item, cols)).join('')}
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

  _renderRow(item, cols) {
    const cache = item.cache || {};
    const cells = cols.map(c => this._renderCell(item, cache, c));
    return `<tr data-item-id="${item.id}">${cells.join('')}<td><span class="row-delete" data-delete="${item.id}" title="Remove">${icon('trash', 13)}</span></td></tr>`;
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
