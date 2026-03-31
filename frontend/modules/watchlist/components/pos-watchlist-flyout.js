// pos-watchlist-flyout — 380px slide-in quick-view panel (follows pos-task-detail pattern)

import { icon } from '../../../shared/utils/icons.js';
import { getItem, updateItem, getStages } from '../services/watchlist-api.js';

const TAG = 'pos-watchlist-flyout';

class PosWatchlistFlyout extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
    this._stages = [];
    this._assetClass = null;
  }

  set assetClass(val) { this._assetClass = val; }

  async openForItem(itemId) {
    try {
      const [item, stages] = await Promise.all([
        getItem(itemId),
        getStages().catch(() => []),
      ]);
      this._item = item;
      this._stages = stages;
      this._render();
      this.setAttribute('open', '');
    } catch (err) {
      console.error('Failed to load flyout item', err);
    }
  }

  close() {
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('flyout-close', { bubbles: true, composed: true }));
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const item = this._item;
    if (!item) {
      this.shadow.innerHTML = this._baseStyles();
      return;
    }

    const cache = item.cache || {};
    const price = cache.current_price ?? cache.nav;
    const chg = cache.day_change_pct;
    const chgCls = (chg || 0) >= 0 ? 'positive' : 'negative';
    const chgSign = (chg || 0) >= 0 ? '+' : '';

    const metrics = this._getMetrics(item, cache);

    this.shadow.innerHTML = `
      ${this._baseStyles()}
      <div class="flyout-content">
        <div class="flyout-header">
          <div class="flyout-title">
            <div class="flyout-name">${this._esc(item.name)}</div>
            <div class="flyout-symbol">${this._esc(item.symbol)}${item.exchange ? ' · ' + this._esc(item.exchange) : ''}</div>
          </div>
          <button class="close-btn" id="close-btn">${icon('x', 16)}</button>
        </div>

        <div class="price-block">
          <span class="price-value">${price != null ? this._cur(cache.currency) + price.toFixed(2) : '--'}</span>
          <span class="price-change ${chgCls}">
            ${cache.day_change != null ? chgSign + this._cur(cache.currency) + Math.abs(cache.day_change).toFixed(2) : ''}
            (${chg != null ? chgSign + chg.toFixed(2) + '%' : '--'})
          </span>
        </div>

        <div class="metrics-grid">
          ${metrics.map(m => `
            <div class="metric">
              <div class="metric-label">${m.label}</div>
              <div class="metric-value">${m.value}</div>
            </div>
          `).join('')}
        </div>

        <div class="field-row">
          <label class="field-label">Stage</label>
          <select class="field-select" id="stage-select">
            <option value="">None</option>
            ${this._stages.map(s => `<option value="${s.id}" ${item.stage_id === s.id ? 'selected' : ''}>${this._esc(s.name)}</option>`).join('')}
          </select>
        </div>

        ${item.theme_name ? `
          <div class="field-row">
            <label class="field-label">Theme</label>
            <span class="field-value">${this._esc(item.theme_name)}</span>
          </div>
        ` : ''}

        ${(item.tags || []).length > 0 ? `
          <div class="field-row">
            <label class="field-label">Tags</label>
            <div class="tags-row">
              ${item.tags.map(t => `<span class="tag-chip">${this._esc(t.name)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${item.remarks ? `
          <div class="field-row">
            <label class="field-label">Remarks</label>
            <div class="field-text">${this._esc(item.remarks).substring(0, 200)}${item.remarks.length > 200 ? '...' : ''}</div>
          </div>
        ` : ''}

        <div class="flyout-actions">
          <button class="fav-btn ${item.is_favourite ? 'active' : ''}" id="fav-btn">
            ${icon('star', 14)} ${item.is_favourite ? 'Favourited' : 'Favourite'}
          </button>
          <button class="open-btn" id="open-detail-btn">
            Open Detail ${icon('arrow-up-right', 12)}
          </button>
        </div>
      </div>
    `;
  }

  _baseStyles() {
    return `
      <style>
        :host {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 380px;
          background: var(--pos-color-background-primary);
          border-left: 1px solid var(--pos-color-border-default);
          box-shadow: -4px 0 16px rgba(0,0,0,0.08);
          transform: translateX(100%);
          transition: transform 0.22s ease;
          z-index: 50;
          overflow-y: auto;
        }
        :host([open]) {
          transform: translateX(0);
        }
        .flyout-content { padding: 16px; }
        .flyout-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .flyout-name {
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
        }
        .flyout-symbol {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          margin-top: 2px;
        }
        .close-btn {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          border-radius: var(--pos-radius-sm);
        }
        .close-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-background-secondary); }
        .close-btn svg { pointer-events: none; }

        .price-block {
          margin-bottom: 16px;
        }
        .price-value {
          font-size: var(--pos-font-size-xl);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
        }
        .price-change {
          font-size: var(--pos-font-size-sm);
          margin-left: 8px;
        }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }
        .metric {
          padding: 8px 10px;
          border: 1px solid var(--pos-color-border-subtle);
          border-radius: var(--pos-radius-sm);
        }
        .metric-label {
          font-size: 10px;
          color: var(--pos-color-text-tertiary);
          margin-bottom: 2px;
        }
        .metric-value {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
        }

        .field-row {
          margin-bottom: 12px;
        }
        .field-label {
          display: block;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          margin-bottom: 4px;
        }
        .field-value {
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
        }
        .field-text {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          line-height: 1.4;
        }
        .field-select {
          padding: 4px 8px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          cursor: pointer;
        }

        .tags-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .tag-chip {
          padding: 2px 8px;
          background: var(--pos-color-background-secondary);
          border-radius: 10px;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
        }

        .flyout-actions {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid var(--pos-color-border-subtle);
        }
        .fav-btn, .open-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: all 0.1s;
        }
        .fav-btn:hover, .open-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
        .fav-btn.active { color: #f59e0b; border-color: #f59e0b; }
        .fav-btn svg, .open-btn svg { pointer-events: none; }
        .open-btn { margin-left: auto; }

        @media (max-width: 768px) {
          :host {
            width: 100% !important;
            left: 0;
          }
        }
      </style>
    `;
  }

  _getMetrics(item, cache) {
    const metrics = [];
    const t = item.asset_type;

    if (t === 'stock') {
      if (cache.pe_ratio != null) metrics.push({ label: 'PE Ratio', value: cache.pe_ratio.toFixed(2) });
      if (cache.pb_ratio != null) metrics.push({ label: 'PB Ratio', value: cache.pb_ratio.toFixed(2) });
      if (cache.market_cap) metrics.push({ label: 'Mkt Cap', value: this._fmtCap(cache.market_cap) });
      if (cache.roe != null) metrics.push({ label: 'ROE', value: (cache.roe * 100).toFixed(1) + '%' });
      if (cache.eps != null) metrics.push({ label: 'EPS', value: cache.eps.toFixed(2) });
      if (cache.dividend_yield != null) metrics.push({ label: 'Div Yield', value: (cache.dividend_yield * 100).toFixed(1) + '%' });
    } else if (t === 'mutual_fund') {
      if (cache.nav != null) metrics.push({ label: 'NAV', value: cache.nav.toFixed(2) });
      if (cache.return_1y != null) metrics.push({ label: '1Y Return', value: cache.return_1y.toFixed(1) + '%' });
      if (cache.return_3y != null) metrics.push({ label: '3Y Return', value: cache.return_3y.toFixed(1) + '%' });
      if (cache.return_5y != null) metrics.push({ label: '5Y Return', value: cache.return_5y.toFixed(1) + '%' });
      if (cache.expense_ratio != null) metrics.push({ label: 'Exp Ratio', value: cache.expense_ratio.toFixed(2) + '%' });
      if (cache.aum) metrics.push({ label: 'AUM', value: this._fmtCap(cache.aum) });
    } else if (t === 'etf') {
      if (cache.expense_ratio != null) metrics.push({ label: 'Exp Ratio', value: cache.expense_ratio.toFixed(2) + '%' });
      if (cache.aum) metrics.push({ label: 'AUM', value: this._fmtCap(cache.aum) });
      if (cache.holdings_count != null) metrics.push({ label: 'Holdings', value: String(cache.holdings_count) });
      if (cache.dividend_yield != null) metrics.push({ label: 'Div Yield', value: (cache.dividend_yield * 100).toFixed(1) + '%' });
    } else if (t === 'crypto') {
      if (cache.market_cap) metrics.push({ label: 'Mkt Cap', value: this._fmtCap(cache.market_cap) });
      if (cache.volume_24h) metrics.push({ label: 'Vol 24h', value: this._fmtCap(cache.volume_24h) });
      if (cache.circulating_supply) metrics.push({ label: 'Circ Supply', value: this._fmtCap(cache.circulating_supply) });
    } else if (t === 'bond') {
      if (cache.bond_yield != null) metrics.push({ label: 'Yield', value: cache.bond_yield.toFixed(2) + '%' });
    } else if (t === 'precious_metal') {
      if (cache.previous_close != null) metrics.push({ label: 'Prev Close', value: cache.previous_close.toFixed(2) });
    }

    // 52W range for all
    if (cache.fifty_two_week_low != null && cache.fifty_two_week_high != null) {
      metrics.push({ label: '52W Range', value: cache.fifty_two_week_low.toFixed(0) + ' - ' + cache.fifty_two_week_high.toFixed(0) });
    }

    return metrics.slice(0, 6);
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
      if (e.target.closest('#close-btn')) {
        this.close();
        return;
      }
      if (e.target.closest('#fav-btn')) {
        this._toggleFav();
        return;
      }
      if (e.target.closest('#open-detail-btn')) {
        this.dispatchEvent(new CustomEvent('flyout-open-detail', {
          bubbles: true, composed: true,
          detail: { itemId: this._item?.id },
        }));
        return;
      }
    });

    this.shadow.addEventListener('change', async (e) => {
      if (e.target.closest('#stage-select') && this._item) {
        const val = e.target.value;
        try {
          this._item = await updateItem(this._item.id, { stage_id: val || null });
          this.dispatchEvent(new CustomEvent('item-update', { bubbles: true, composed: true }));
        } catch (err) {
          console.error('Stage update failed', err);
        }
      }
    });
  }

  async _toggleFav() {
    if (!this._item) return;
    try {
      this._item = await updateItem(this._item.id, { is_favourite: !this._item.is_favourite });
      this._render();
      this.setAttribute('open', '');
      this.dispatchEvent(new CustomEvent('item-update', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Fav toggle failed', err);
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistFlyout);
