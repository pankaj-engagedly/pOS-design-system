// pos-watchlist-sparkline — Inline SVG sparkline (80x24px)

const TAG = 'pos-watchlist-sparkline';

class PosWatchlistSparkline extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() { return ['data']; }

  attributeChangedCallback() { this._render(); }
  connectedCallback() { this._render(); }

  set data(val) {
    this._data = val;
    this._render();
  }

  _render() {
    const data = this._data || [];
    if (!data.length || data.length < 2) {
      this.shadow.innerHTML = '<span style="color:var(--pos-color-text-tertiary);font-size:10px;">--</span>';
      return;
    }

    const w = 80, h = 24, pad = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#10b981' : '#ef4444';

    this.shadow.innerHTML = `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;">
        <polyline
          points="${points}"
          fill="none"
          stroke="${color}"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }
}

customElements.define(TAG, PosWatchlistSparkline);
