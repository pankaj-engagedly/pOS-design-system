// pos-photos-album-detail — Album photo grid (header is in app shell)

import './pos-photos-grid.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .album-description {
    padding: 0 var(--pos-space-lg) var(--pos-space-sm);
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    flex-shrink: 0;
  }

  .grid-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: var(--pos-space-sm);
  }
`);

class PosPhotosAlbumDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._album = null;
    this._photos = [];
    this._selectedIds = [];
  }

  set album(val) { this._album = val; this._render(); }
  set photos(val) { this._photos = val || []; this._updateGrid(); }
  set selectedIds(val) { this._selectedIds = val || []; this._updateGrid(); }

  connectedCallback() {
    this._render();
  }

  _render() {
    const a = this._album;
    if (!a) {
      this.shadow.innerHTML = '';
      return;
    }

    this.shadow.innerHTML = `
      ${a.description ? `<div class="album-description">${this._esc(a.description)}</div>` : ''}
      <div class="grid-container">
        <pos-photos-grid></pos-photos-grid>
      </div>
    `;

    this._updateGrid();
  }

  _updateGrid() {
    const grid = this.shadow.querySelector('pos-photos-grid');
    if (grid) {
      grid.photos = this._photos;
      grid.selectedIds = this._selectedIds;
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-photos-album-detail', PosPhotosAlbumDetail);
