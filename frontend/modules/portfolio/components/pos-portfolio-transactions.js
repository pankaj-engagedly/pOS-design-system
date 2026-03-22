// pos-portfolio-transactions — Transaction history table with filters

import { formatINR } from './pos-portfolio-holdings.js';

class PosPortfolioTransactions extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._transactions = [];
    this._filterScheme = '';
    this._filterType = '';
  }

  set transactions(val) { this._transactions = val || []; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    const txns = this._getFiltered();

    // Extract unique schemes for filter dropdown
    const schemes = [...new Set(this._transactions.map(t => t.scheme_name))].sort();
    const types = [...new Set(this._transactions.map(t => t.transaction_type))].sort();

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .filters {
          display: flex; gap: 8px; margin-bottom: 12px;
        }
        select, input {
          padding: 5px 8px;
          border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: var(--pos-radius-sm, 6px);
          font-size: 12px; font-family: inherit;
          background: white;
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
          text-align: left; padding: 8px 10px; font-weight: 500; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.5px;
          color: var(--pos-color-text-tertiary, #9b9bb0);
          border-bottom: 1px solid var(--pos-color-border-default, #e2e2e8);
        }
        td {
          padding: 6px 10px;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f0f0f5);
          color: var(--pos-color-text-primary, #1a1a2e);
        }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .type-badge {
          display: inline-block; padding: 2px 6px;
          border-radius: 3px; font-size: 11px; font-weight: 500;
        }
        .type-buy, .type-sip { background: #dcfce7; color: #166534; }
        .type-sell, .type-redemption, .type-switch_out { background: #fee2e2; color: #991b1b; }
        .type-switch_in { background: #dbeafe; color: #1e40af; }
        .type-dividend_payout, .type-dividend_reinvest { background: #fef3c7; color: #92400e; }
        tr:hover td { background: var(--pos-color-surface-secondary, #f8f8fc); }
        .empty { text-align: center; padding: 40px; color: var(--pos-color-text-tertiary); }
      </style>

      <div class="filters">
        <select data-filter="scheme">
          <option value="">All Schemes</option>
          ${schemes.map(s => `<option value="${this._esc(s)}" ${this._filterScheme === s ? 'selected' : ''}>${this._esc(s)}</option>`).join('')}
        </select>
        <select data-filter="type">
          <option value="">All Types</option>
          ${types.map(t => `<option value="${t}" ${this._filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>

      ${txns.length === 0 ? '<div class="empty">No transactions found</div>' : `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Scheme</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Units</th>
            <th>NAV</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${txns.map(t => `
            <tr>
              <td>${t.transaction_date}</td>
              <td>${this._esc(t.scheme_name)}</td>
              <td><span class="type-badge type-${t.transaction_type}">${t.transaction_type}</span></td>
              <td class="num">${formatINR(t.amount, 2)}</td>
              <td class="num">${Number(t.units).toFixed(3)}</td>
              <td class="num">${t.nav ? Number(t.nav).toFixed(4) : '-'}</td>
              <td class="num">${t.balance_units ? Number(t.balance_units).toFixed(3) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    `;
  }

  _getFiltered() {
    let txns = this._transactions;
    if (this._filterScheme) txns = txns.filter(t => t.scheme_name === this._filterScheme);
    if (this._filterType) txns = txns.filter(t => t.transaction_type === this._filterType);
    return txns;
  }

  _bindEvents() {
    this.shadow.addEventListener('change', (e) => {
      const filter = e.target.dataset?.filter;
      if (filter === 'scheme') { this._filterScheme = e.target.value; this._render(); }
      if (filter === 'type') { this._filterType = e.target.value; this._render(); }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-transactions', PosPortfolioTransactions);
