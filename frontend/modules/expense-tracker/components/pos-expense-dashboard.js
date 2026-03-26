// pos-expense-dashboard — Overview dashboard with summary cards and breakdowns

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-lg); overflow-y: auto; flex: 1; }
  :host([hidden]) { display: none; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--pos-space-md); margin-bottom: var(--pos-space-lg); }
  .card {
    background: var(--pos-color-background-secondary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    padding: var(--pos-space-md);
  }
  .card-label { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--pos-space-xs); }
  .card-value { font-size: var(--pos-font-size-xl); font-weight: var(--pos-font-weight-bold); color: var(--pos-color-text-primary); }
  .card-value.positive { color: var(--pos-color-status-success); }
  .card-value.negative { color: var(--pos-color-status-error); }
  .card-change { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); margin-top: 2px; }

  .section-title { font-size: var(--pos-font-size-md); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-primary); margin-bottom: var(--pos-space-sm); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pos-space-lg); margin-bottom: var(--pos-space-lg); }

  .breakdown-list { display: flex; flex-direction: column; gap: var(--pos-space-xs); }
  .breakdown-row { display: flex; align-items: center; gap: var(--pos-space-sm); font-size: var(--pos-font-size-sm); }
  .breakdown-name { flex: 1; color: var(--pos-color-text-primary); }
  .breakdown-amount { font-weight: var(--pos-font-weight-medium); color: var(--pos-color-text-primary); }
  .breakdown-pct { color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs); width: 40px; text-align: right; }
  .breakdown-bar { height: 6px; border-radius: 3px; background: var(--pos-color-border-default); flex: 0 0 100px; overflow: hidden; }
  .breakdown-bar-fill { height: 100%; border-radius: 3px; background: var(--pos-color-action-primary); }

  .owner-cards { display: flex; gap: var(--pos-space-md); }
  .owner-card {
    flex: 1;
    background: var(--pos-color-background-secondary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    padding: var(--pos-space-md);
  }
  .owner-name { font-weight: var(--pos-font-weight-semibold); margin-bottom: var(--pos-space-xs); }
  .owner-stat { font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); }
  .owner-stat span { font-weight: var(--pos-font-weight-medium); color: var(--pos-color-text-primary); }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
`);

class PosExpenseDashboard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._summary = null;
    this._categoryBreakdown = [];
    this._monthlyTrend = [];
    this._ownerSplit = [];
  }

  set summary(val) { this._summary = val; this._render(); }
  set categoryBreakdown(val) { this._categoryBreakdown = val || []; this._render(); }
  set monthlyTrend(val) { this._monthlyTrend = val || []; this._render(); }
  set ownerSplit(val) { this._ownerSplit = val || []; this._render(); }

  connectedCallback() { this._render(); }

  _render() {
    const s = this._summary;
    if (!s) {
      this.shadow.innerHTML = '<div class="empty">Import a statement to see your dashboard</div>';
      return;
    }

    const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    const momStr = s.mom_change_pct !== null ? `${s.mom_change_pct > 0 ? '+' : ''}${s.mom_change_pct.toFixed(1)}% vs last month` : '';

    this.shadow.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="card-label">Total Spend</div>
          <div class="card-value">${fmt(s.total_spend)}</div>
          ${momStr ? `<div class="card-change">${momStr}</div>` : ''}
        </div>
        <div class="card">
          <div class="card-label">Income</div>
          <div class="card-value positive">${fmt(s.total_income)}</div>
        </div>
        <div class="card">
          <div class="card-label">Net Savings</div>
          <div class="card-value ${Number(s.net_savings) >= 0 ? 'positive' : 'negative'}">${fmt(s.net_savings)}</div>
        </div>
        <div class="card">
          <div class="card-label">Last Month</div>
          <div class="card-value">${fmt(s.spend_prev_month)}</div>
        </div>
      </div>

      <div class="two-col">
        <div>
          <div class="section-title">Spending by Category</div>
          <div class="breakdown-list">
            ${this._categoryBreakdown.slice(0, 10).map(c => `
              <div class="breakdown-row">
                <span class="breakdown-name">${this._esc(c.category_name)}</span>
                <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width: ${c.percentage}%"></div></div>
                <span class="breakdown-pct">${c.percentage.toFixed(0)}%</span>
                <span class="breakdown-amount">${fmt(c.total)}</span>
              </div>
            `).join('') || '<div style="color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-sm);">No data yet</div>'}
          </div>
        </div>

        <div>
          <div class="section-title">By Family Member</div>
          <div class="owner-cards">
            ${this._ownerSplit.map(o => `
              <div class="owner-card">
                <div class="owner-name">${this._esc(o.owner_label)}</div>
                <div class="owner-stat">Spend: <span>${fmt(o.total_spend)}</span></div>
                <div class="owner-stat">Income: <span>${fmt(o.total_income)}</span></div>
              </div>
            `).join('') || '<div style="color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-sm);">No data yet</div>'}
          </div>
        </div>
      </div>
    `;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-dashboard', PosExpenseDashboard);
