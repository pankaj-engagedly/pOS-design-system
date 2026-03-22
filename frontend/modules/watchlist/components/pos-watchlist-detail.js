// pos-watchlist-detail — Two-column sectioned detail page
// Left: price, metrics, chart, financials
// Right: stage, theme/subtheme, tags, remarks, added reason

import './pos-watchlist-chart.js';
import { icon } from '../../../shared/utils/icons.js';
import {
  getItem, updateItem, refreshItem, getHistory, getFinancials,
  addTag, removeTag, getStages, getThemes,
  getAvailableMetrics, getMetricHistory, getAccumulatedFinancials,
} from '../services/watchlist-api.js';

const TAG = 'pos-watchlist-detail';

class PosWatchlistDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
    this._history = [];
    this._financials = null;
    this._stages = [];
    this._themes = [];      // top-level with .children
    this._loading = false;
    this._financialFreq = 'annual';  // 'annual' | 'quarterly'
  }

  set itemId(val) {
    if (val) this._load(val);
  }

  connectedCallback() {
    this._bindEvents();
  }

  async _load(id) {
    this._loading = true;
    this._financials = null;
    this._render();
    try {
      const [item, stages] = await Promise.all([
        getItem(id),
        getStages().catch(() => []),
      ]);
      this._item = item;
      this._stages = stages;
      // Load themes scoped to this item's asset type
      this._themes = await getThemes(item.asset_type).catch(() => []);
      this._loading = false;
      this._render();
      this._loadHistory(id, '1y');
      if (item.asset_type === 'stock') this._loadFinancials(id);
      this._loadAvailableMetrics(id);
    } catch (err) {
      this._loading = false;
      this._render();
      console.error('Failed to load item', err);
    }
  }

  async _loadHistory(id, period) {
    try {
      this._history = await getHistory(id, period);
      const chart = this.shadow.querySelector('pos-watchlist-chart');
      if (chart) chart.data = this._history;
    } catch (err) {
      console.error('Failed to load history', err);
    }
  }

  async _loadFinancials(id, freq) {
    const frequency = freq || this._financialFreq;
    try {
      // Try accumulated (locally stored) first, fall back to live API
      let data = await getAccumulatedFinancials(id, null, frequency).catch(() => []);
      if (data.length > 0) {
        this._financials = this._accumulatedToLegacy(data);
      } else {
        // No accumulated data yet — fetch live
        const live = await getFinancials(id).catch(() => ({ income_statement: [], balance_sheet: [] }));
        this._financials = live;
      }
      this._renderFinancialsSection();
    } catch (err) {
      console.error('Failed to load financials', err);
    }
  }

  _accumulatedToLegacy(stmts) {
    // Group by statement_type, build {income_statement, balance_sheet, cashflow} arrays
    const grouped = { income: [], balance: [], cashflow: [] };
    for (const s of stmts) {
      const arr = grouped[s.statement_type];
      if (arr) {
        arr.push({ period: s.fiscal_period, ...s.line_items });
      }
    }
    return {
      income_statement: grouped.income,
      balance_sheet: grouped.balance,
      cashflow: grouped.cashflow,
    };
  }

  _renderFinancialsSection() {
    const el = this.shadow.getElementById('financials-section');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="section-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">Financials</div>
        <div class="freq-toggle">
          <button class="freq-btn ${this._financialFreq === 'annual' ? 'active' : ''}" data-freq="annual">Annual</button>
          <button class="freq-btn ${this._financialFreq === 'quarterly' ? 'active' : ''}" data-freq="quarterly">Quarterly</button>
        </div>
      </div>
      ${this._renderFinancialsContent()}
    `;
  }

  async _loadAvailableMetrics(id) {
    try {
      const metrics = await getAvailableMetrics(id);
      const select = this.shadow.getElementById('trend-metric-select');
      const hint = this.shadow.getElementById('trends-hint');
      if (!select) return;
      if (metrics.length === 0) {
        if (hint) hint.textContent = 'No snapshots yet. Click "Refresh" then wait for next daily sync, or trigger manually.';
        return;
      }
      if (hint) hint.style.display = 'none';
      // Populate dropdown with human-readable labels
      select.innerHTML = '<option value="">Select a metric...</option>' +
        metrics.map(m => `<option value="${m}">${this._metricLabel(m)}</option>`).join('');
    } catch (err) {
      console.error('Failed to load available metrics', err);
    }
  }

  async _loadTrendData(metric) {
    if (!this._item || !metric) return;
    const container = this.shadow.getElementById('trend-chart-container');
    if (!container) return;
    container.innerHTML = '<div class="trend-empty">Loading...</div>';
    try {
      const data = await getMetricHistory(this._item.id, metric);
      if (data.length < 2) {
        container.innerHTML = '<div class="trend-empty">Need at least 2 data points. Snapshots accumulate daily.</div>';
        return;
      }
      container.innerHTML = this._renderTrendChart(data, metric);
    } catch (err) {
      container.innerHTML = '<div class="trend-empty">Failed to load trend data</div>';
      console.error('Trend load failed', err);
    }
  }

  _renderTrendChart(data, metric) {
    const values = data.map(d => d.value);
    const dates = data.map(d => d.date);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 600;
    const h = 160;
    const padX = 50;
    const padY = 16;
    const plotW = w - padX - 10;
    const plotH = h - padY * 2;

    // Build SVG polyline
    const points = values.map((v, i) => {
      const x = padX + (i / (values.length - 1)) * plotW;
      const y = padY + plotH - ((v - min) / range) * plotH;
      return `${x},${y}`;
    }).join(' ');

    // Y-axis labels
    const ySteps = 4;
    let yLabels = '';
    for (let i = 0; i <= ySteps; i++) {
      const val = min + (range * i / ySteps);
      const y = padY + plotH - (i / ySteps) * plotH;
      yLabels += `<text x="${padX - 6}" y="${y + 3}" text-anchor="end" fill="var(--pos-color-text-tertiary)" font-size="9">${this._fmtTrendVal(val)}</text>`;
      yLabels += `<line x1="${padX}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="var(--pos-color-border-subtle)" stroke-dasharray="3,3"/>`;
    }

    // X-axis: first and last date
    const xLabels = `
      <text x="${padX}" y="${h - 2}" fill="var(--pos-color-text-tertiary)" font-size="9">${this._fmtPeriod(dates[0], true)}</text>
      <text x="${w - 10}" y="${h - 2}" text-anchor="end" fill="var(--pos-color-text-tertiary)" font-size="9">${this._fmtPeriod(dates[dates.length - 1], true)}</text>
    `;

    const isUp = values[values.length - 1] >= values[0];
    const color = isUp ? '#10b981' : '#ef4444';

    return `
      <svg class="trend-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        ${yLabels}
        ${xLabels}
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
  }

  _fmtTrendVal(v) {
    const abs = Math.abs(v);
    if (abs >= 1e12) return (v / 1e12).toFixed(1) + 'T';
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(abs < 10 ? 2 : 0);
  }

  _metricLabel(key) {
    const labels = {
      current_price: 'Price', nav: 'NAV', pe_ratio: 'PE Ratio', pb_ratio: 'PB Ratio',
      market_cap: 'Market Cap', roe: 'ROE', roce: 'ROCE', eps: 'EPS',
      book_value: 'Book Value', dividend_yield: 'Dividend Yield',
      fifty_two_week_low: '52W Low', fifty_two_week_high: '52W High',
      day_change_pct: 'Day Change %', industry: 'Industry', sector: 'Sector',
      expense_ratio: 'Expense Ratio', aum: 'AUM',
      return_1y: '1Y Return', return_3y: '3Y Return', return_5y: '5Y Return',
      volume_24h: 'Volume 24h', circulating_supply: 'Circulating Supply',
      bond_yield: 'Bond Yield', holdings_count: 'Holdings',
      beta: 'Beta', debtToEquity: 'Debt/Equity', currentRatio: 'Current Ratio',
      revenueGrowth: 'Revenue Growth', earningsGrowth: 'Earnings Growth',
      profitMargins: 'Profit Margins', operatingMargins: 'Operating Margins',
      grossMargins: 'Gross Margins', totalRevenue: 'Total Revenue',
      totalDebt: 'Total Debt', totalCash: 'Total Cash',
      freeCashflow: 'Free Cash Flow', targetMeanPrice: 'Analyst Target (Mean)',
      recommendationMean: 'Analyst Rating', shortRatio: 'Short Ratio',
      enterpriseValue: 'Enterprise Value', forwardPE: 'Forward PE',
      forwardEps: 'Forward EPS', ytdReturn: 'YTD Return',
      threeYearAverageReturn: '3Y Avg Return', fiveYearAverageReturn: '5Y Avg Return',
      maxSupply: 'Max Supply', fullyDilutedValue: 'Fully Diluted Value',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  _render() {
    if (this._loading) {
      this.shadow.innerHTML = `<div style="padding:48px;text-align:center;color:var(--pos-color-text-tertiary);">Loading...</div>`;
      return;
    }
    if (!this._item) {
      this.shadow.innerHTML = '';
      return;
    }

    const item = this._item;
    const cache = item.cache || {};
    const changeCls = (cache.day_change_pct || 0) >= 0 ? 'positive' : 'negative';
    const changeSign = (cache.day_change_pct || 0) >= 0 ? '+' : '';
    const metrics = this._getMetricsForType(item.asset_type, cache);
    const selectedTheme = this._themes.find(t => t.id === item.theme_id);
    // Check if theme_id matches a child
    let parentThemeId = null;
    let subThemeId = null;
    for (const t of this._themes) {
      if (t.id === item.theme_id) { parentThemeId = t.id; break; }
      const child = (t.children || []).find(c => c.id === item.theme_id);
      if (child) { parentThemeId = t.id; subThemeId = child.id; break; }
    }
    const parentTheme = this._themes.find(t => t.id === parentThemeId);
    const subThemes = parentTheme?.children || [];

    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; overflow-y: auto; }
        .detail { padding: 16px 24px; }
        .back-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .back-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 8px; border: none; background: transparent;
          color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs);
          font-family: inherit; cursor: pointer;
        }
        .back-btn:hover { color: var(--pos-color-text-primary); }
        .back-btn svg { pointer-events: none; }
        .action-btns { display: flex; gap: 6px; }
        .action-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 5px 10px; border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm); background: transparent;
          color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs);
          font-family: inherit; cursor: pointer;
        }
        .action-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .action-btn svg { pointer-events: none; }
        .fav-btn.active { color: #f59e0b; border-color: #f59e0b; }

        /* Header */
        .header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .header-info { flex: 1; min-width: 200px; }
        .header-title { font-size: var(--pos-font-size-xl); font-weight: var(--pos-font-weight-bold); color: var(--pos-color-text-primary); }
        .header-symbol { font-size: var(--pos-font-size-sm); color: var(--pos-color-text-tertiary); margin-top: 2px; }
        .header-price { font-size: var(--pos-font-size-xl); font-weight: var(--pos-font-weight-bold); color: var(--pos-color-text-primary); }
        .header-change { font-size: var(--pos-font-size-sm); margin-top: 2px; }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }

        /* Two-column layout */
        .columns { display: grid; grid-template-columns: 1fr 300px; gap: 24px; }
        @media (max-width: 800px) { .columns { grid-template-columns: 1fr; } }

        /* Sections */
        .section { margin-bottom: 20px; }
        .section-title {
          font-size: var(--pos-font-size-xs); font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;
          margin-bottom: 10px; padding-bottom: 6px;
          border-bottom: 1px solid var(--pos-color-border-subtle);
        }

        /* Metrics */
        .metrics-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .metric-card { padding: 10px; border: 1px solid var(--pos-color-border-subtle); border-radius: var(--pos-radius-sm); }
        .metric-label { font-size: 10px; color: var(--pos-color-text-tertiary); margin-bottom: 3px; }
        .metric-value { font-size: var(--pos-font-size-sm); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-primary); }

        /* Right panel fields */
        .field { margin-bottom: 14px; }
        .field-label {
          font-size: var(--pos-font-size-xs); color: var(--pos-color-text-tertiary);
          margin-bottom: 4px; display: block;
        }
        .field select, .field input[type="text"] {
          width: 100%; padding: 6px 8px;
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); font-family: inherit;
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
          cursor: pointer; box-sizing: border-box;
        }
        textarea {
          width: 100%; min-height: 72px; padding: 8px;
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); font-family: inherit;
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
          resize: vertical; outline: none; box-sizing: border-box; line-height: 1.5;
        }
        textarea:focus, .field select:focus, .field input:focus { border-color: var(--pos-color-action-primary); outline: none; }

        /* Tags */
        .tags-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .tag-chip {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 8px; background: var(--pos-color-background-secondary);
          border-radius: 10px; font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary);
        }
        .tag-remove { cursor: pointer; display: inline-flex; opacity: 0.4; }
        .tag-remove:hover { opacity: 1; }
        .tag-remove svg { pointer-events: none; }
        .tag-input {
          border: 1px dashed var(--pos-color-border-default); border-radius: 10px;
          padding: 2px 8px; font-size: var(--pos-font-size-xs); font-family: inherit;
          background: transparent; color: var(--pos-color-text-primary); outline: none; width: 90px;
        }
        .tag-input:focus { border-color: var(--pos-color-action-primary); }

        /* Trends */
        .trends-controls {
          display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        .trends-controls select {
          padding: 5px 8px; border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-xs);
          font-family: inherit; background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary); cursor: pointer; min-width: 180px;
        }
        .trends-hint {
          font-size: 10px; color: var(--pos-color-text-tertiary); font-style: italic;
        }
        .trend-chart {
          width: 100%; height: 180px; border: 1px solid var(--pos-color-border-subtle);
          border-radius: var(--pos-radius-sm); overflow: hidden;
        }
        .trend-empty {
          display: flex; align-items: center; justify-content: center;
          height: 120px; color: var(--pos-color-text-tertiary); font-size: var(--pos-font-size-xs);
        }

        /* Frequency toggle */
        .freq-toggle { display: inline-flex; gap: 0; }
        .freq-btn {
          padding: 3px 10px; border: 1px solid var(--pos-color-border-default);
          background: transparent; color: var(--pos-color-text-secondary);
          font-size: 10px; font-family: inherit; cursor: pointer; transition: all 0.1s;
        }
        .freq-btn:first-child { border-radius: var(--pos-radius-sm) 0 0 var(--pos-radius-sm); }
        .freq-btn:last-child { border-radius: 0 var(--pos-radius-sm) var(--pos-radius-sm) 0; border-left: none; }
        .freq-btn.active {
          background: var(--pos-color-action-primary); color: white;
          border-color: var(--pos-color-action-primary);
        }

        /* Financials */
        .fin-table { width: 100%; border-collapse: collapse; font-size: var(--pos-font-size-xs); margin-top: 8px; }
        .fin-table th, .fin-table td { padding: 5px 8px; text-align: right; border-bottom: 1px solid var(--pos-color-border-subtle); }
        .fin-table th:first-child, .fin-table td:first-child { text-align: left; }
        .fin-table th { background: var(--pos-color-background-secondary); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-secondary); }
      </style>

      <div class="detail">
        <div class="back-row">
          <button class="back-btn" id="back-btn">${icon('arrow-left', 14)} Back to list</button>
          <div class="action-btns">
            <button class="action-btn fav-btn ${item.is_favourite ? 'active' : ''}" id="fav-btn">${icon('star', 14)}</button>
            <button class="action-btn" id="refresh-btn">${icon('refresh-cw', 14)} Refresh</button>
          </div>
        </div>

        <div class="header">
          <div class="header-info">
            <div class="header-title">${this._esc(item.name)}</div>
            <div class="header-symbol">${this._esc(item.symbol)}${item.exchange ? ' · ' + this._esc(item.exchange) : ''}</div>
          </div>
          <div style="text-align:right;">
            <div class="header-price">${cache.current_price != null ? this._currencySymbol(cache.currency) + cache.current_price.toFixed(2) : '--'}</div>
            <div class="header-change ${changeCls}">
              ${cache.day_change != null ? changeSign + this._currencySymbol(cache.currency) + Math.abs(cache.day_change).toFixed(2) : '--'}
              (${cache.day_change_pct != null ? changeSign + cache.day_change_pct.toFixed(2) + '%' : '--'})
            </div>
          </div>
        </div>

        <div class="columns">
          <!-- LEFT: Data sections -->
          <div class="left-col">

            <div class="section">
              <div class="section-title">Key Metrics</div>
              <div class="metrics-grid">
                ${metrics.map(m => `
                  <div class="metric-card">
                    <div class="metric-label">${m.label}</div>
                    <div class="metric-value">${m.value}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="section">
              <div class="section-title">Price History</div>
              <pos-watchlist-chart></pos-watchlist-chart>
            </div>

            ${item.asset_type === 'stock' ? `
              <div class="section" id="financials-section">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <div class="section-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">Financials</div>
                  <div class="freq-toggle">
                    <button class="freq-btn ${this._financialFreq === 'annual' ? 'active' : ''}" data-freq="annual">Annual</button>
                    <button class="freq-btn ${this._financialFreq === 'quarterly' ? 'active' : ''}" data-freq="quarterly">Quarterly</button>
                  </div>
                </div>
                ${this._renderFinancialsContent()}
              </div>
            ` : ''}

            <div class="section" id="trends-section">
              <div class="section-title">Metric Trends</div>
              <div class="trends-controls">
                <select id="trend-metric-select">
                  <option value="">Select a metric...</option>
                </select>
                <span class="trends-hint" id="trends-hint">Snapshots build daily. Trigger first snapshot from Refresh.</span>
              </div>
              <div id="trend-chart-container"></div>
            </div>

          </div>

          <!-- RIGHT: Editable fields -->
          <div class="right-col">

            <div class="section">
              <div class="section-title">Details</div>

              <div class="field">
                <label class="field-label">Pipeline Stage</label>
                <select id="stage-select">
                  <option value="">No stage</option>
                  ${this._stages.map(s => `<option value="${s.id}" ${item.stage_id === s.id ? 'selected' : ''}>${this._esc(s.name)}</option>`).join('')}
                </select>
              </div>

              <div class="field">
                <label class="field-label">Theme</label>
                <select id="theme-select">
                  <option value="">None</option>
                  ${this._themes.map(t => `<option value="${t.id}" ${parentThemeId === t.id ? 'selected' : ''}>${this._esc(t.name)}</option>`).join('')}
                </select>
              </div>

              ${subThemes.length > 0 ? `
                <div class="field" id="subtheme-field">
                  <label class="field-label">Sub-theme</label>
                  <select id="subtheme-select">
                    <option value="">None</option>
                    ${subThemes.map(c => `<option value="${c.id}" ${subThemeId === c.id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
                  </select>
                </div>
              ` : '<div id="subtheme-field"></div>'}
            </div>

            <div class="section">
              <div class="section-title">Tags</div>
              <div class="tags-row">
                ${(item.tags || []).map(t => `
                  <span class="tag-chip">
                    ${this._esc(t.name)}
                    <span class="tag-remove" data-tag-id="${t.id}">${icon('x', 10)}</span>
                  </span>
                `).join('')}
                <input class="tag-input" id="tag-input" placeholder="Add tag..." />
              </div>
            </div>

            <div class="section">
              <div class="section-title">Notes</div>
              <div class="field">
                <label class="field-label">Investment Thesis</label>
                <textarea id="remarks-input" placeholder="Your research notes...">${this._esc(item.remarks || '')}</textarea>
              </div>
              <div class="field">
                <label class="field-label">Why Added</label>
                <textarea id="reason-input" placeholder="Why did you add this?" style="min-height:48px;">${this._esc(item.added_reason || '')}</textarea>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Set chart data
    const chart = this.shadow.querySelector('pos-watchlist-chart');
    if (chart && this._history.length) chart.data = this._history;
  }

  _renderFinancialsContent() {
    if (!this._financials) {
      return '<div style="padding:16px;text-align:center;color:var(--pos-color-text-tertiary);font-size:var(--pos-font-size-xs);">Loading financials...</div>';
    }
    const { income_statement, balance_sheet, cashflow } = this._financials;
    const isQ = this._financialFreq === 'quarterly';
    const cache = this._item?.cache || {};
    const cur = this._currencySymbol(cache.financial_currency || cache.currency);
    let html = '';

    const renderTable = (title, data) => {
      if (!data?.length) return '';
      const keys = Object.keys(data[0]).filter(k => k !== 'period' && k !== 'frequency').slice(0, 12);
      let out = `<div style="font-size:var(--pos-font-size-xs);font-weight:var(--pos-font-weight-semibold);color:var(--pos-color-text-secondary);margin:12px 0 4px;">${title}</div>`;
      out += '<table class="fin-table"><thead><tr><th>Item</th>';
      out += data.map(y => `<th>${this._fmtPeriod(y.period, isQ)}</th>`).join('');
      out += '</tr></thead><tbody>';
      for (const key of keys) {
        out += `<tr><td>${this._esc(key)}</td>`;
        out += data.map(y => `<td>${y[key] != null ? cur + this._fmtFin(y[key]) : '--'}</td>`).join('');
        out += '</tr>';
      }
      out += '</tbody></table>';
      return out;
    };

    html += renderTable('Income Statement', income_statement);
    html += renderTable('Balance Sheet', balance_sheet);
    html += renderTable('Cash Flow', cashflow);

    if (!html) {
      html = '<div style="padding:16px;text-align:center;color:var(--pos-color-text-tertiary);font-size:var(--pos-font-size-xs);">No financial data available</div>';
    }

    return html;
  }

  _getMetricsForType(assetType, cache) {
    const m = (label, val) => ({ label, value: val });
    const fmt = (v) => v != null ? (typeof v === 'number' ? v.toFixed(2) : String(v)) : '--';
    const fmtPct = (v) => v != null ? v.toFixed(1) + '%' : '--';
    const fmtPctMult = (v) => v != null ? (v * 100).toFixed(1) + '%' : '--';
    const fmtCap = (v) => v ? this._fmtCap(v) : '--';

    switch (assetType) {
      case 'stock':
        return [
          m('PE Ratio', fmt(cache.pe_ratio)), m('PB Ratio', fmt(cache.pb_ratio)),
          m('EPS', fmt(cache.eps)), m('Book Value', fmt(cache.book_value)),
          m('Market Cap', fmtCap(cache.market_cap)), m('ROE', fmtPctMult(cache.roe)),
          m('Dividend Yield', fmtPctMult(cache.dividend_yield)),
          m('52W Low', fmt(cache.fifty_two_week_low)), m('52W High', fmt(cache.fifty_two_week_high)),
          m('Industry', cache.industry || '--'), m('Sector', cache.sector || '--'),
          m('Previous Close', fmt(cache.previous_close)),
        ];
      case 'mutual_fund':
        return [
          m('NAV', fmt(cache.nav)), m('1Y Return', fmtPct(cache.return_1y)),
          m('3Y Return', fmtPct(cache.return_3y)), m('5Y Return', fmtPct(cache.return_5y)),
          m('Expense Ratio', cache.expense_ratio != null ? cache.expense_ratio.toFixed(2) + '%' : '--'),
          m('AUM', fmtCap(cache.aum)), m('Category', cache.category || '--'),
          m('Risk', cache.risk_rating || '--'),
        ];
      case 'etf':
        return [
          m('Price', fmt(cache.current_price)), m('NAV', fmt(cache.nav)),
          m('Expense Ratio', cache.expense_ratio != null ? cache.expense_ratio.toFixed(2) + '%' : '--'),
          m('AUM', fmtCap(cache.aum)), m('Holdings', cache.holdings_count ?? '--'),
          m('Div Yield', fmtPctMult(cache.dividend_yield)),
          m('52W Low', fmt(cache.fifty_two_week_low)), m('52W High', fmt(cache.fifty_two_week_high)),
          m('Category', cache.category || '--'),
        ];
      case 'precious_metal':
        return [
          m('Spot Price', fmt(cache.current_price)), m('Previous Close', fmt(cache.previous_close)),
          m('Day Change', fmt(cache.day_change)), m('Day Change %', fmtPct(cache.day_change_pct)),
          m('52W Low', fmt(cache.fifty_two_week_low)), m('52W High', fmt(cache.fifty_two_week_high)),
        ];
      case 'bond':
        return [
          m('Price', fmt(cache.current_price)), m('Yield', cache.bond_yield != null ? cache.bond_yield.toFixed(2) + '%' : '--'),
          m('Previous Close', fmt(cache.previous_close)),
          m('Day Change', fmt(cache.day_change)), m('Day Change %', fmtPct(cache.day_change_pct)),
          m('52W Low', fmt(cache.fifty_two_week_low)), m('52W High', fmt(cache.fifty_two_week_high)),
        ];
      case 'crypto':
        return [
          m('Price', fmt(cache.current_price)), m('Market Cap', fmtCap(cache.market_cap)),
          m('Volume 24h', fmtCap(cache.volume_24h)),
          m('Circ Supply', fmtCap(cache.circulating_supply)),
          m('52W Low', fmt(cache.fifty_two_week_low)), m('52W High', fmt(cache.fifty_two_week_high)),
          m('Previous Close', fmt(cache.previous_close)),
        ];
      default:
        return [m('Price', fmt(cache.current_price))];
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#back-btn')) {
        this.dispatchEvent(new CustomEvent('detail-close', { bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('#fav-btn')) {
        this._toggleFav();
        return;
      }
      if (e.target.closest('#refresh-btn')) {
        this._refresh();
        return;
      }
      const freqBtn = e.target.closest('.freq-btn');
      if (freqBtn) {
        this._financialFreq = freqBtn.dataset.freq;
        this._financials = null;
        this._loadFinancials(this._item.id, this._financialFreq);
        return;
      }
      const tagRemove = e.target.closest('.tag-remove');
      if (tagRemove) {
        this._removeTag(tagRemove.dataset.tagId);
        return;
      }
    });

    this.shadow.addEventListener('change', (e) => {
      if (e.target.closest('#trend-metric-select')) {
        this._loadTrendData(e.target.value);
        return;
      }
      if (e.target.closest('#stage-select')) {
        this._updateItem({ stage_id: e.target.value || null });
      }
      if (e.target.closest('#theme-select')) {
        const themeId = e.target.value || null;
        this._updateItem({ theme_id: themeId });
        // Update subtheme dropdown
        this._updateSubThemeDropdown(themeId);
      }
      if (e.target.closest('#subtheme-select')) {
        const subId = e.target.value || null;
        if (subId) {
          this._updateItem({ theme_id: subId });
        } else {
          // Revert to parent theme
          const parentSel = this.shadow.getElementById('theme-select');
          this._updateItem({ theme_id: parentSel?.value || null });
        }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#remarks-input')) {
        const val = e.target.value;
        if (val !== (this._item?.remarks || '')) {
          this._updateItem({ remarks: val });
        }
      }
      if (e.target.closest('#reason-input')) {
        const val = e.target.value;
        if (val !== (this._item?.added_reason || '')) {
          this._updateItem({ added_reason: val });
        }
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.closest('#tag-input') && e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) {
          this._addTag(val);
          e.target.value = '';
        }
      }
    });

    this.shadow.addEventListener('period-change', (e) => {
      if (this._item) this._loadHistory(this._item.id, e.detail.period);
    });
  }

  _updateSubThemeDropdown(parentThemeId) {
    const field = this.shadow.getElementById('subtheme-field');
    if (!field) return;
    const parent = this._themes.find(t => t.id === parentThemeId);
    const subs = parent?.children || [];
    if (subs.length === 0) {
      field.innerHTML = '';
      return;
    }
    field.innerHTML = `
      <label class="field-label">Sub-theme</label>
      <select id="subtheme-select">
        <option value="">None</option>
        ${subs.map(c => `<option value="${c.id}">${this._esc(c.name)}</option>`).join('')}
      </select>
    `;
  }

  async _toggleFav() {
    if (!this._item) return;
    await updateItem(this._item.id, { is_favourite: !this._item.is_favourite });
    this._item.is_favourite = !this._item.is_favourite;
    const btn = this.shadow.getElementById('fav-btn');
    if (btn) btn.classList.toggle('active', this._item.is_favourite);
  }

  async _refresh() {
    if (!this._item) return;
    await refreshItem(this._item.id);
    this._item = await getItem(this._item.id);
    this._render();
  }

  async _updateItem(data) {
    if (!this._item) return;
    try {
      this._item = await updateItem(this._item.id, data);
    } catch (err) {
      console.error('Update failed', err);
    }
  }

  async _addTag(name) {
    if (!this._item) return;
    try {
      await addTag(this._item.id, name);
      this._item = await getItem(this._item.id);
      // Re-render just tags
      const tagsRow = this.shadow.querySelector('.tags-row');
      if (tagsRow) {
        tagsRow.innerHTML = `
          ${(this._item.tags || []).map(t => `
            <span class="tag-chip">
              ${this._esc(t.name)}
              <span class="tag-remove" data-tag-id="${t.id}">${icon('x', 10)}</span>
            </span>
          `).join('')}
          <input class="tag-input" id="tag-input" placeholder="Add tag..." />
        `;
      }
    } catch (err) {
      console.error('Add tag failed', err);
    }
  }

  async _removeTag(tagId) {
    if (!this._item) return;
    try {
      await removeTag(this._item.id, tagId);
      this._item = await getItem(this._item.id);
      const tagsRow = this.shadow.querySelector('.tags-row');
      if (tagsRow) {
        tagsRow.innerHTML = `
          ${(this._item.tags || []).map(t => `
            <span class="tag-chip">
              ${this._esc(t.name)}
              <span class="tag-remove" data-tag-id="${t.id}">${icon('x', 10)}</span>
            </span>
          `).join('')}
          <input class="tag-input" id="tag-input" placeholder="Add tag..." />
        `;
      }
    } catch (err) {
      console.error('Remove tag failed', err);
    }
  }

  _currencySymbol(code) {
    const map = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', CAD: 'C$', AUD: 'A$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$' };
    return map[code] || (code ? code + ' ' : '');
  }

  _fmtPeriod(dateStr, isQuarterly) {
    // "2025-09-30" → "Sep-25" (quarterly) or "FY 2025" (annual)
    if (!dateStr) return '--';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const yearShort = parts[0].slice(2);
    if (isQuarterly) {
      return `${months[monthIdx] || parts[1]}-${yearShort}`;
    }
    return `FY ${parts[0]}`;
  }

  _fmtCap(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e7) return (n / 1e7).toFixed(1) + 'Cr';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    return n.toLocaleString();
  }

  _fmtFin(n) {
    if (n == null) return '--';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistDetail);
