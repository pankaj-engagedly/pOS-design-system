// pos-watchlist-board — Kanban board view with pipeline stages as columns

import { icon } from '../../../shared/utils/icons.js';

const TAG = 'pos-watchlist-board';

class PosWatchlistBoard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._items = [];
    this._stages = [];
    this._assetClass = null;
  }

  set items(val) { this._items = val || []; this._render(); }
  set stages(val) { this._stages = val || []; this._render(); }
  set assetClass(val) { this._assetClass = val; this._render(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const stageColumns = this._stages.map(s => ({
      stage: s,
      items: this._items.filter(i => i.stage_id === s.id),
    }));
    const unassigned = this._items.filter(i => !i.stage_id);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; overflow-x: auto; overflow-y: hidden; }
        .board {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          height: 100%;
          min-width: max-content;
        }
        .column {
          min-width: 280px;
          max-width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--pos-color-background-secondary);
          border-radius: var(--pos-radius-md);
          overflow: hidden;
        }
        .col-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          border-bottom: 1px solid var(--pos-color-border-subtle);
        }
        .col-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .col-count {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          font-weight: normal;
          margin-left: auto;
        }
        .col-cards {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .card {
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-subtle);
          border-radius: var(--pos-radius-sm);
          padding: 10px 12px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .card:hover {
          border-color: var(--pos-color-action-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .card-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .card-symbol {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          margin-bottom: 6px;
        }
        .card-price-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .card-price {
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
        }
        .card-change {
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
        }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .card-metrics {
          display: flex;
          gap: 12px;
          margin-top: 6px;
          font-size: 10px;
          color: var(--pos-color-text-tertiary);
        }
        .card-metric span {
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-secondary);
        }
        .empty-col {
          padding: 16px;
          text-align: center;
          color: var(--pos-color-text-tertiary);
          font-size: var(--pos-font-size-xs);
        }
      </style>
      <div class="board">
        ${stageColumns.map(col => this._renderColumn(col.stage, col.items)).join('')}
        ${unassigned.length > 0 ? this._renderColumn({ name: 'Unassigned', color: '#94a3b8' }, unassigned) : ''}
      </div>
    `;
  }

  _renderColumn(stage, items) {
    return `
      <div class="column">
        <div class="col-header">
          <span class="col-dot" style="background:${stage.color || '#94a3b8'}"></span>
          ${this._esc(stage.name)}
          <span class="col-count">${items.length}</span>
        </div>
        <div class="col-cards">
          ${items.length === 0
            ? '<div class="empty-col">No items</div>'
            : items.map(item => this._renderCard(item)).join('')}
        </div>
      </div>
    `;
  }

  _renderCard(item) {
    const cache = item.cache || {};
    const price = cache.current_price ?? cache.nav;
    const chg = cache.day_change_pct;
    const chgCls = chg > 0 ? 'positive' : chg < 0 ? 'negative' : '';
    const chgStr = chg != null ? (chg > 0 ? '+' : '') + chg.toFixed(2) + '%' : '';
    const cur = this._cur(cache.currency);

    const metrics = this._getCardMetrics(item, cache);

    return `
      <div class="card" data-item-id="${item.id}">
        <div class="card-name">${this._esc(item.name)}</div>
        <div class="card-symbol">${this._esc(item.symbol)}${item.exchange ? ' · ' + this._esc(item.exchange) : ''}</div>
        <div class="card-price-row">
          <span class="card-price">${price != null ? cur + price.toFixed(2) : '--'}</span>
          ${chgStr ? `<span class="card-change ${chgCls}">${chgStr}</span>` : ''}
        </div>
        ${metrics.length > 0 ? `
          <div class="card-metrics">
            ${metrics.map(m => `<span class="card-metric">${m.label}: <span>${m.value}</span></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  _getCardMetrics(item, cache) {
    const metrics = [];
    const t = item.asset_type;

    if (t === 'stock') {
      if (cache.pe_ratio != null) metrics.push({ label: 'PE', value: cache.pe_ratio.toFixed(1) });
      if (cache.market_cap) metrics.push({ label: 'MCap', value: this._fmtCap(cache.market_cap) });
      if (cache.roe != null) metrics.push({ label: 'ROE', value: (cache.roe * 100).toFixed(1) + '%' });
    } else if (t === 'mutual_fund') {
      if (cache.return_1y != null) metrics.push({ label: '1Y', value: cache.return_1y.toFixed(1) + '%' });
      if (cache.expense_ratio != null) metrics.push({ label: 'ER', value: cache.expense_ratio.toFixed(2) + '%' });
    } else if (t === 'etf') {
      if (cache.expense_ratio != null) metrics.push({ label: 'ER', value: cache.expense_ratio.toFixed(2) + '%' });
      if (cache.aum) metrics.push({ label: 'AUM', value: this._fmtCap(cache.aum) });
    } else if (t === 'crypto') {
      if (cache.market_cap) metrics.push({ label: 'MCap', value: this._fmtCap(cache.market_cap) });
      if (cache.volume_24h) metrics.push({ label: 'Vol', value: this._fmtCap(cache.volume_24h) });
    } else if (t === 'bond') {
      if (cache.bond_yield != null) metrics.push({ label: 'Yield', value: cache.bond_yield.toFixed(2) + '%' });
    } else if (t === 'precious_metal') {
      if (cache.fifty_two_week_low != null && cache.fifty_two_week_high != null) {
        metrics.push({ label: '52W', value: cache.fifty_two_week_low.toFixed(0) + '-' + cache.fifty_two_week_high.toFixed(0) });
      }
    }

    return metrics.slice(0, 3);
  }

  _cur(code) {
    const map = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', CAD: 'C$', AUD: 'A$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$' };
    return map[code] || (code ? code + ' ' : '');
  }

  _fmtCap(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e7) return (n / 1e7).toFixed(1) + 'Cr';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    return n.toLocaleString();
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) {
        this.dispatchEvent(new CustomEvent('item-open', {
          bubbles: true, composed: true,
          detail: { itemId: card.dataset.itemId },
        }));
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistBoard);
