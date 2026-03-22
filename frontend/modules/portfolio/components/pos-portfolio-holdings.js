// pos-portfolio-holdings — Value Research-style holdings table
// Two-line rows: primary value + secondary detail below

import { icon } from '../../../shared/utils/icons.js';

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
    this._data = null;
    this._sortKey = 'scheme_name';
    this._sortDir = 'asc';
  }

  set data(val) { this._data = val; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._data || !this._data.holdings || this._data.holdings.length === 0) {
      this.shadow.innerHTML = `<style>:host{display:block;padding:40px;color:var(--pos-color-text-tertiary,#9b9bb0);text-align:center;font-size:13px;}</style>
        <div>${icon('briefcase', 48)}</div><p style="margin-top:12px;">No holdings data — import a CAS PDF to get started</p>`;
      return;
    }

    const holdings = this._getSortedHoldings();
    const d = this._data;

    // Compute portfolio-level totals
    const totalInvested = holdings.reduce((s, h) => s + Number(h.invested_amount || 0), 0);
    const totalCurrent = holdings.reduce((s, h) => s + Number(h.current_value || 0), 0);
    const totalReturn = totalCurrent - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested * 100) : 0;

    // Day change placeholder (we don't have this yet)
    const totalUnits = holdings.reduce((s, h) => s + Number(h.total_units || 0), 0);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .header-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .header-row h2 {
          margin: 0; font-size: 16px; font-weight: 600;
          color: var(--pos-color-text-primary, #1a1a2e);
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead th {
          text-align: right; padding: 10px 12px; font-weight: 500; font-size: 11px;
          color: var(--pos-color-text-tertiary, #9b9bb0);
          border-bottom: 2px solid var(--pos-color-border-default, #e2e2e8);
          white-space: nowrap; cursor: pointer; user-select: none;
        }
        thead th:first-child { text-align: left; }
        thead th.sorted { color: var(--pos-color-action-primary, #4361ee); }
        thead .sub-header {
          font-size: 10px; font-weight: 400; text-transform: uppercase;
          letter-spacing: 0.3px; color: var(--pos-color-text-tertiary, #aaa);
          display: block; margin-top: 1px;
        }

        tbody td {
          padding: 10px 12px; text-align: right;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f0f0f5);
          vertical-align: top;
          font-variant-numeric: tabular-nums;
        }
        tbody td:first-child { text-align: left; }
        .sub-value {
          display: block; font-size: 11px; margin-top: 2px;
          color: var(--pos-color-text-tertiary, #9b9bb0);
        }
        .fund-name {
          font-weight: 500; color: var(--pos-color-text-primary, #1a1a2e);
          display: flex; align-items: center; gap: 6px;
        }
        .fund-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .folio-num {
          font-size: 11px; color: var(--pos-color-text-tertiary, #9b9bb0);
          margin-top: 2px; padding-left: 14px;
        }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }

        tr:hover td { background: var(--pos-color-surface-secondary, #f8f8fc); }

        tfoot td {
          padding: 12px 12px; text-align: right;
          border-top: 2px solid var(--pos-color-border-default, #e2e2e8);
          font-weight: 600; font-size: 13px;
        }
        tfoot td:first-child { text-align: left; }
      </style>

      <div class="header-row">
        <h2>Mutual Funds (${holdings.length})</h2>
      </div>

      <table>
        <thead>
          <tr>
            <th data-sort="scheme_name" class="${this._sortKey === 'scheme_name' ? 'sorted' : ''}">
              Fund name
              <span class="sub-header">FOLIO NO.</span>
            </th>
            <th data-sort="current_nav" class="${this._sortKey === 'current_nav' ? 'sorted' : ''}">
              Last Price
            </th>
            <th data-sort="invested_amount" class="${this._sortKey === 'invested_amount' ? 'sorted' : ''}">
              Total Cost
              <span class="sub-header">COST PER UNIT</span>
            </th>
            <th data-sort="current_value" class="${this._sortKey === 'current_value' ? 'sorted' : ''}">
              Current Value
              <span class="sub-header">UNITS</span>
            </th>
            <th data-sort="portfolio_pct">
              % of Portfolio
            </th>
            <th data-sort="absolute_return" class="${this._sortKey === 'absolute_return' ? 'sorted' : ''}">
              Total Return
              <span class="sub-header">RETURN %</span>
            </th>
          </tr>
        </thead>
        <tbody>
          ${holdings.map(h => {
            const invested = Number(h.invested_amount || 0);
            const current = Number(h.current_value || 0);
            const units = Number(h.total_units || 0);
            const nav = Number(h.current_nav || 0);
            const ret = current - invested;
            const retPct = invested > 0 ? (ret / invested * 100) : 0;
            const costPerUnit = units > 0 ? (invested / units) : 0;
            const portfolioPct = totalCurrent > 0 ? (current / totalCurrent * 100) : 0;
            const retClass = ret >= 0 ? 'positive' : 'negative';

            // Dot color: green = positive return, orange = negative
            const dotColor = ret >= 0 ? '#f59e0b' : '#f59e0b';

            return `
              <tr>
                <td>
                  <div class="fund-name">
                    <span class="fund-dot" style="background: ${ret >= 0 ? '#f59e0b' : '#f59e0b'}"></span>
                    ${this._esc(h.scheme_name)}
                  </div>
                  <div class="folio-num">${this._esc(h.folio_number)}</div>
                </td>
                <td>${nav > 0 ? formatINR(nav, 2) : '-'}</td>
                <td>
                  ${formatINR(invested)}
                  <span class="sub-value">${costPerUnit > 0 ? formatINR(costPerUnit, 2) : '-'}</span>
                </td>
                <td>
                  ${current > 0 ? formatINR(current) : '-'}
                  <span class="sub-value">${formatINR(units, 3)} UNITS</span>
                </td>
                <td>${portfolioPct > 0 ? pct(portfolioPct) : '-'}</td>
                <td>
                  <span class="${retClass}">${ret !== 0 ? (ret > 0 ? '' : '') + formatINR(ret) : '-'}</span>
                  <span class="sub-value ${retClass}">${retPct !== 0 ? pct(retPct) : '-'}</span>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td></td>
            <td>${formatINR(totalInvested)}</td>
            <td>${formatINR(totalCurrent)}</td>
            <td>100.00</td>
            <td>
              <span class="${totalReturn >= 0 ? 'positive' : 'negative'}">${formatINR(totalReturn)}</span>
              <span class="sub-value ${totalReturn >= 0 ? 'positive' : 'negative'}">${pct(totalReturnPct)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
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
        this._sortDir = key === 'scheme_name' ? 'asc' : 'desc';
      }
      this._render();
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-holdings', PosPortfolioHoldings);
