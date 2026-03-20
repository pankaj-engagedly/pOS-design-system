// pos-photos-timeline — Date-grouped timeline wrapping pos-photos-grid per date

import './pos-photos-grid.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    overflow-y: auto;
    padding: var(--pos-space-sm);
  }

  .date-group {
    margin-bottom: var(--pos-space-md);
  }

  .date-header {
    font-size: var(--pos-font-size-sm);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    padding: var(--pos-space-xs) var(--pos-space-xs);
    margin-bottom: 2px;
    position: sticky;
    top: 0;
    background: var(--pos-color-background-secondary);
    z-index: 1;
    border-radius: var(--pos-radius-sm);
  }

  .empty {
    text-align: center;
    padding: var(--pos-space-xl);
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
  }
`);

class PosPhotosTimeline extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._groups = [];
    this._selectedIds = [];
  }

  set groups(val) { this._groups = val || []; this._render(); }
  set selectedIds(val) { this._selectedIds = val || []; this._updateGrids(); }

  connectedCallback() {
    this._render();
  }

  _render() {
    if (!this._groups.length) {
      this.shadow.innerHTML = `<div class="empty">No photos yet. Upload some to get started.</div>`;
      return;
    }

    this.shadow.innerHTML = this._groups.map(g => `
      <div class="date-group">
        <div class="date-header">${this._formatDate(g.date)}</div>
        <pos-photos-grid data-date="${g.date}"></pos-photos-grid>
      </div>
    `).join('');

    // Set photos on each grid
    const grids = this.shadow.querySelectorAll('pos-photos-grid');
    grids.forEach((grid, i) => {
      grid.photos = this._groups[i].photos;
      grid.selectedIds = this._selectedIds;
    });
  }

  _updateGrids() {
    const grids = this.shadow.querySelectorAll('pos-photos-grid');
    grids.forEach(grid => {
      grid.selectedIds = this._selectedIds;
    });
  }

  _formatDate(dateStr) {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
    }
  }
}

customElements.define('pos-photos-timeline', PosPhotosTimeline);
