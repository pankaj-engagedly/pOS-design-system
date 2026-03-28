// pos-portfolio-holdings — Value Research-style holdings table
// Two-line rows: primary value + secondary detail below

import { icon } from '../../../shared/utils/icons.js';
import { TABLE_STYLES } from '../../../../design-system/src/components/ui-table.js';

/**
 * Format amount in INR with Indian number formatting (no lakhs/crores abbreviation for table).
 */
export function formatINR(amount, decimals = 0) {
  if (amount === null || amount === undefined) return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatINRCompact(amount) {
  if (amount === null || amount === undefined) return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  if (Math.abs(num) >= 10000000) return '\u20B9' + (num / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(num) >= 100000) return '\u20B9' + (num / 100000).toFixed(2) + ' L';
  return '\u20B9' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function pct(val) {
  if (val === null || val === undefined) return '-';
  return Number(val).toFixed(1);
}

class PosPortfolioHoldings extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [TABLE_STYLES];
    this._data = null;
    this._sortKey = 'scheme_name';
    this._sortDir = 'asc';
    this._hideSold = localStorage.getItem('pos-portfolio-hide-sold') !== 'false';
  }

  set data(val) { this._data = val; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._data || !this._data.holdings || this._data.holdings.length === 0) {
      this.shadow.innerHTML = `<style>:host{display:block;padding:40px;color:var(--pos-color-text-tertiary,#9b9bb0);text-align:center;font-size:13px;}</style>
        <div>${icon('briefcase', 48)}</div><p style="margin-top:12px;">No holdings data — import a CAS PDF or stock tradebook to get started</p>`;
      return;
    }

    let holdings = this._getSortedHoldings();

    // Count sold before filtering
    const soldCount = holdings.filter(h => Number(h.total_units || 0) === 0).length;

    if (this._hideSold) {
      holdings = holdings.filter(h => Number(h.total_units || 0) > 0);
    }

    // Split by asset class
    const mfHoldings = holdings.filter(h => (h.asset_class || 'mutual_fund') === 'mutual_fund');
    const stockHoldings = holdings.filter(h => h.asset_class === 'stock');

    // Grand totals
    const totalInvested = holdings.reduce((s, h) => s + Number(h.invested_amount || 0), 0);
    const totalCurrent = holdings.reduce((s, h) => s + Number(h.current_value || 0), 0);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .section { margin-bottom: 32px; }
        .toolbar {
          display: flex; align-items: center; gap: var(--pos-space-sm);
          padding: 0 0 var(--pos-space-sm);
        }
        .toggle-label {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary);
          cursor: pointer; user-select: none;
        }
        .toggle-label input { margin: 0; cursor: pointer; }
        /* Compact table overrides */
        .pos-table { font-size: var(--pos-font-size-xs); }
        .pos-table td { padding: 8px 12px; }
        .pos-table th { cursor: pointer; }
        .pos-table th:first-child { text-align: left; }
        .pos-table td:first-child { text-align: left; }
        .pos-table th:not(:first-child) { text-align: right; }
        .pos-table td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
        td.fund-name {
          font-weight: 500; color: var(--pos-color-text-primary, #1a1a2e);
        }
        td.folio-num {
          color: var(--pos-color-text-tertiary, #9b9bb0);
        }
      </style>

      ${soldCount > 0 ? `
        <div class="toolbar">
          <label class="toggle-label">
            <input type="checkbox" id="hide-sold" ${this._hideSold ? 'checked' : ''}>
            Hide fully sold (${soldCount})
          </label>
        </div>
      ` : ''}
      ${stockHoldings.length > 0 ? this._renderSection('Stocks', stockHoldings, totalCurrent) : ''}
      ${mfHoldings.length > 0 ? this._renderSection('Mutual Funds', mfHoldings, totalCurrent) : ''}
    `;
  }

  _renderSection(title, items, grandTotalCurrent) {
    const sectionInvested = items.reduce((s, h) => s + Number(h.invested_amount || 0), 0);
    const sectionCurrent = items.reduce((s, h) => s + Number(h.current_value || 0), 0);
    const sectionReturn = sectionCurrent - sectionInvested;
    const sectionReturnPct = sectionInvested > 0 ? (sectionReturn / sectionInvested * 100) : 0;
    const isStock = title === 'Stocks';
    const nameLabel = isStock ? 'Stock' : 'Fund name';
    const subLabel = isStock ? 'BROKER' : 'FOLIO NO.';
    const unitLabel = isStock ? 'SHARES' : 'UNITS';

    return `
      <div class="section">
        <table class="pos-table">
          <thead>
            <tr>
              <th data-sort="scheme_name" class="${this._sortKey === 'scheme_name' ? 'sorted' : ''}">${nameLabel}</th>
              <th data-sort="folio_number" class="${this._sortKey === 'folio_number' ? 'sorted' : ''}">${subLabel}</th>
              <th data-sort="current_nav" class="${this._sortKey === 'current_nav' ? 'sorted' : ''}">Last Price</th>
              <th data-sort="invested_amount" class="${this._sortKey === 'invested_amount' ? 'sorted' : ''}">Total Cost</th>
              <th data-sort="cost_per_unit" class="${this._sortKey === 'cost_per_unit' ? 'sorted' : ''}">Cost/Unit</th>
              <th data-sort="current_value" class="${this._sortKey === 'current_value' ? 'sorted' : ''}">Current Value</th>
              <th data-sort="total_units" class="${this._sortKey === 'total_units' ? 'sorted' : ''}">${unitLabel}</th>
              <th data-sort="portfolio_pct" class="${this._sortKey === 'portfolio_pct' ? 'sorted' : ''}">% Portfolio</th>
              <th data-sort="absolute_return" class="${this._sortKey === 'absolute_return' ? 'sorted' : ''}">Return</th>
              <th data-sort="return_pct" class="${this._sortKey === 'return_pct' ? 'sorted' : ''}">Return %</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(h => {
              const invested = Number(h.invested_amount || 0);
              const current = Number(h.current_value || 0);
              const units = Number(h.total_units || 0);
              const nav = Number(h.current_nav || 0);
              const ret = current - invested;
              const retPct = invested > 0 ? (ret / invested * 100) : 0;
              const costPerUnit = units > 0 ? (invested / units) : 0;
              const portfolioPct = grandTotalCurrent > 0 ? (current / grandTotalCurrent * 100) : 0;
              const retClass = ret >= 0 ? 'positive' : 'negative';
              const unitDecimals = isStock ? 0 : 3;

              return `
                <tr>
                  <td class="fund-name">${this._esc(h.scheme_name)}</td>
                  <td class="folio-num">${this._esc(h.folio_number)}</td>
                  <td>${nav > 0 ? formatINR(nav, 2) : '-'}</td>
                  <td>${formatINR(invested)}</td>
                  <td>${costPerUnit > 0 ? formatINR(costPerUnit, 2) : '-'}</td>
                  <td>${current > 0 ? formatINR(current) : '-'}</td>
                  <td>${formatINR(units, unitDecimals)}</td>
                  <td>${portfolioPct > 0 ? pct(portfolioPct) : '-'}</td>
                  <td><span class="${retClass}">${ret !== 0 ? formatINR(ret) : '-'}</span></td>
                  <td><span class="${retClass}">${retPct !== 0 ? pct(retPct) + '%' : '-'}</span></td>
                </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td>Subtotal</td>
              <td></td>
              <td></td>
              <td>${formatINR(sectionInvested)}</td>
              <td></td>
              <td>${formatINR(sectionCurrent)}</td>
              <td></td>
              <td>${grandTotalCurrent > 0 ? pct(sectionCurrent / grandTotalCurrent * 100) : '-'}</td>
              <td><span class="${sectionReturn >= 0 ? 'positive' : 'negative'}">${formatINR(sectionReturn)}</span></td>
              <td><span class="${sectionReturn >= 0 ? 'positive' : 'negative'}">${pct(sectionReturnPct)}%</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  _getSortedHoldings() {
    if (!this._data?.holdings) return [];
    const h = [...this._data.holdings];
    const key = this._sortKey;
    const dir = this._sortDir === 'asc' ? 1 : -1;

    h.sort((a, b) => {
      let va, vb;
      if (key === 'portfolio_pct') {
        const totalCurrent = h.reduce((s, x) => s + Number(x.current_value || 0), 0);
        va = totalCurrent > 0 ? Number(a.current_value || 0) / totalCurrent : 0;
        vb = totalCurrent > 0 ? Number(b.current_value || 0) / totalCurrent : 0;
      } else if (key === 'cost_per_unit') {
        const au = Number(a.total_units || 0), bu = Number(b.total_units || 0);
        va = au > 0 ? Number(a.invested_amount || 0) / au : 0;
        vb = bu > 0 ? Number(b.invested_amount || 0) / bu : 0;
      } else if (key === 'return_pct') {
        const ai = Number(a.invested_amount || 0), bi = Number(b.invested_amount || 0);
        va = ai > 0 ? (Number(a.current_value || 0) - ai) / ai * 100 : 0;
        vb = bi > 0 ? (Number(b.current_value || 0) - bi) / bi * 100 : 0;
      } else if (key === 'total_units') {
        va = Number(a.total_units || 0);
        vb = Number(b.total_units || 0);
      } else {
        va = a[key] ?? '';
        vb = b[key] ?? '';
      }
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (Number(va) - Number(vb)) * dir;
    });
    return h;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (this._sortKey === key) {
        this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this._sortKey = key;
        this._sortDir = (key === 'scheme_name' || key === 'folio_number') ? 'asc' : 'desc';
      }
      this._render();
    });

    this.shadow.addEventListener('change', (e) => {
      if (e.target.id === 'hide-sold') {
        this._hideSold = e.target.checked;
        localStorage.setItem('pos-portfolio-hide-sold', this._hideSold);
        this._render();
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-holdings', PosPortfolioHoldings);
