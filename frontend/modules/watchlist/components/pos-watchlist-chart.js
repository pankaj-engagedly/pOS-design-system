// pos-watchlist-chart — Larger SVG price chart with period selector for detail page

const TAG = 'pos-watchlist-chart';

class PosWatchlistChart extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._data = [];
    this._period = '1y';
  }

  set data(val) { this._data = val || []; this._renderChart(); }
  set period(val) { this._period = val; }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .chart-wrap {
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          padding: 16px;
          background: var(--pos-color-background-primary);
        }
        .period-bar {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }
        .period-btn {
          padding: 4px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: all 0.1s;
        }
        .period-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .period-btn.active {
          background: var(--pos-color-action-primary);
          color: white;
          border-color: var(--pos-color-action-primary);
        }
        .chart-svg { width: 100%; }
        .no-data {
          text-align: center;
          padding: 40px;
          color: var(--pos-color-text-tertiary);
          font-size: var(--pos-font-size-sm);
        }
      </style>
      <div class="chart-wrap">
        <div class="period-bar">
          ${['1mo','3mo','6mo','1y','3y','5y'].map(p => `
            <button class="period-btn ${p === this._period ? 'active' : ''}" data-period="${p}">${p.toUpperCase()}</button>
          `).join('')}
        </div>
        <div id="chart-area">
          <div class="no-data">Select a period to load chart data</div>
        </div>
      </div>
    `;
  }

  _renderChart() {
    const area = this.shadow.getElementById('chart-area');
    if (!area) return;

    const data = this._data;
    if (!data.length) {
      area.innerHTML = '<div class="no-data">No historical data available</div>';
      return;
    }

    const w = 600, h = 200, padX = 40, padY = 20;
    const closes = data.map(d => d.close ?? d.price ?? 0);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const points = closes.map((v, i) => {
      const x = padX + (i / (closes.length - 1)) * (w - padX * 2);
      const y = padY + (1 - (v - min) / range) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const isUp = closes[closes.length - 1] >= closes[0];
    const color = isUp ? '#10b981' : '#ef4444';

    // Y-axis labels
    const yLabels = [min, min + range * 0.25, min + range * 0.5, min + range * 0.75, max];
    const yLabelsSvg = yLabels.map(v => {
      const y = padY + (1 - (v - min) / range) * (h - padY * 2);
      return `<text x="4" y="${y + 3}" font-size="9" fill="var(--pos-color-text-tertiary)">${this._fmt(v)}</text>
              <line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="var(--pos-color-border-default)" stroke-width="0.5" stroke-dasharray="4"/>`;
    }).join('');

    // X-axis: first and last date (formatted as "Mar-25")
    const firstDate = this._fmtDate(data[0]?.date);
    const lastDate = this._fmtDate(data[data.length - 1]?.date);

    area.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${w} ${h + 20}" preserveAspectRatio="none">
        ${yLabelsSvg}
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="${padX}" y="${h + 14}" font-size="9" fill="var(--pos-color-text-tertiary)">${firstDate}</text>
        <text x="${w - padX}" y="${h + 14}" font-size="9" fill="var(--pos-color-text-tertiary)" text-anchor="end">${lastDate}</text>
      </svg>
    `;
  }

  _fmtDate(dateStr) {
    if (!dateStr) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const m = parseInt(parts[1], 10) - 1;
    return `${months[m] || parts[1]}-${parts[0].slice(2)}`;
  }

  _fmt(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      const period = btn.dataset.period;
      this._period = period;
      // Update active state
      this.shadow.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === period));
      this.dispatchEvent(new CustomEvent('period-change', {
        bubbles: true, composed: true,
        detail: { period },
      }));
    });
  }
}

customElements.define(TAG, PosWatchlistChart);
