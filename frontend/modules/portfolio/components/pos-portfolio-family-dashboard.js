// pos-portfolio-family-dashboard — Family net worth, per-holder cards, allocation

import { icon } from '../../../shared/utils/icons.js';
import { formatINR } from './pos-portfolio-holdings.js';

class PosPortfolioFamilyDashboard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._data = null;
  }

  set data(val) { this._data = val; this._render(); }

  connectedCallback() { this._render(); }

  _render() {
    if (!this._data) {
      this.shadow.innerHTML = `
        <style>:host{display:block;padding:40px;text-align:center;color:var(--pos-color-text-tertiary,#9b9bb0);}</style>
        <p>Loading family dashboard...</p>`;
      return;
    }

    const d = this._data;
    const returnClass = Number(d.total_return) >= 0 ? 'positive' : 'negative';

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .net-worth {
          text-align: center; padding: 32px; margin-bottom: 24px;
          background: linear-gradient(135deg, var(--pos-color-surface-secondary, #f8f8fc) 0%, #eef2ff 100%);
          border-radius: 12px;
        }
        .net-worth-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--pos-color-text-tertiary); margin-bottom: 8px; }
        .net-worth-value { font-size: 32px; font-weight: 700; color: var(--pos-color-text-primary); }
        .net-worth-return { font-size: 14px; margin-top: 4px; }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .meta { display: flex; justify-content: center; gap: 24px; margin-top: 12px; font-size: 13px; color: var(--pos-color-text-secondary); }
        .holders { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .holder-card {
          border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 10px; padding: 20px;
        }
        .holder-name { font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .holder-stat { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .holder-label { color: var(--pos-color-text-secondary); }
        .holder-value { font-weight: 500; }
      </style>

      <div class="net-worth">
        <div class="net-worth-label">Family Net Worth</div>
        <div class="net-worth-value">${formatINR(d.total_current_value)}</div>
        <div class="net-worth-return ${returnClass}">
          ${formatINR(d.total_return)} (${Number(d.return_pct) >= 0 ? '+' : ''}${Number(d.return_pct).toFixed(2)}%)
        </div>
        <div class="meta">
          <span>${d.holder_count} holder${d.holder_count !== 1 ? 's' : ''}</span>
          <span>${d.portfolio_count} portfolio${d.portfolio_count !== 1 ? 's' : ''}</span>
          <span>Invested: ${formatINR(d.total_invested)}</span>
        </div>
      </div>

      <div class="holders">
        ${(d.holders || []).map(h => {
          const hReturnClass = Number(h.total_return) >= 0 ? 'positive' : 'negative';
          return `
            <div class="holder-card">
              <div class="holder-name">
                ${icon('user', 18)} ${this._esc(h.holder_name)}
              </div>
              <div class="holder-stat">
                <span class="holder-label">Portfolios</span>
                <span class="holder-value">${h.portfolio_count}</span>
              </div>
              <div class="holder-stat">
                <span class="holder-label">Invested</span>
                <span class="holder-value">${formatINR(h.total_invested)}</span>
              </div>
              <div class="holder-stat">
                <span class="holder-label">Current Value</span>
                <span class="holder-value">${formatINR(h.total_current_value)}</span>
              </div>
              <div class="holder-stat">
                <span class="holder-label">Return</span>
                <span class="holder-value ${hReturnClass}">
                  ${formatINR(h.total_return)} (${Number(h.return_pct) >= 0 ? '+' : ''}${Number(h.return_pct).toFixed(2)}%)
                </span>
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}

customElements.define('pos-portfolio-family-dashboard', PosPortfolioFamilyDashboard);
