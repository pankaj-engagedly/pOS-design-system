// pos-photos-grid — Responsive photo grid with caption/tags on cards

import { icon } from '../../../shared/utils/icons.js';
import { thumbUrl } from '../services/photos-api.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    padding: 2px;
  }

  .photo-card {
    border-radius: var(--pos-radius-md);
    overflow: hidden;
    background: var(--pos-color-background-secondary);
    cursor: pointer;
    transition: box-shadow 0.15s;
    border: 1px solid var(--pos-color-border-default);
  }
  .photo-card:hover {
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  }

  .photo-thumb {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--pos-color-background-primary);
  }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.15s;
  }
  .photo-card:hover .photo-thumb img {
    transform: scale(1.03);
  }

  .photo-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.3) 100%);
    opacity: 0;
    transition: opacity 0.15s;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px;
  }
  .photo-card:hover .photo-overlay { opacity: 1; }

  .overlay-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .overlay-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .overlay-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: rgba(0,0,0,0.4);
    color: white;
    cursor: pointer;
    padding: 0;
    transition: background 0.1s;
  }
  .overlay-btn:hover { background: rgba(0,0,0,0.6); }
  .overlay-btn.active { color: #fbbf24; }
  .overlay-btn svg { pointer-events: none; }

  .select-check {
    width: 20px;
    height: 20px;
    border: 2px solid white;
    border-radius: 4px;
    background: rgba(0,0,0,0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .select-check.selected {
    background: var(--pos-color-action-primary);
    border-color: var(--pos-color-action-primary);
  }

  /* Bottom-right indicators (always visible) */
  .card-indicators {
    position: absolute;
    bottom: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    align-items: center;
    z-index: 1;
  }
  .indicator {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 1px 5px;
    border-radius: 99px;
    background: rgba(0,0,0,0.55);
    color: rgba(255,255,255,0.85);
    font-size: 10px;
    line-height: 1;
    pointer-events: none;
  }

  /* EXIF tooltip on hover */
  .exif-tooltip {
    position: absolute;
    bottom: 6px;
    left: 6px;
    padding: 3px 7px;
    border-radius: var(--pos-radius-sm);
    background: rgba(0,0,0,0.65);
    color: rgba(255,255,255,0.8);
    font-size: 10px;
    line-height: 1.3;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
    z-index: 1;
  }
  .photo-card:hover .exif-tooltip { opacity: 1; }

  /* Card footer — caption + tags */
  .card-footer {
    padding: 6px 8px;
    min-height: 0;
  }
  .card-footer:empty { display: none; }

  .card-caption {
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
  }

  .card-tag {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 99px;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-secondary);
    border: 1px solid var(--pos-color-border-default);
    line-height: 1.6;
  }

  .empty {
    text-align: center;
    padding: var(--pos-space-xl);
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
  }
`);

class PosPhotosGrid extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._photos = [];
    this._selectedIds = [];
  }

  set photos(val) { this._photos = val || []; this._render(); }
  set selectedIds(val) { this._selectedIds = val || []; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    if (!this._photos.length) {
      this.shadow.innerHTML = `<div class="empty">No photos yet. Upload some to get started.</div>`;
      return;
    }

    this.shadow.innerHTML = `
      <div class="photo-grid">
        ${this._photos.map(p => {
          const hasCaption = p.caption;
          const tags = p.tags || [];
          const hasFooter = hasCaption || tags.length > 0;
          const commentCount = p.comment_count || (p.comments || []).length || 0;
          const exif = this._getExifSummary(p);

          return `
            <div class="photo-card" data-photo-id="${p.id}">
              <div class="photo-thumb">
                <img src="${thumbUrl(p.id, 'sm')}" alt="${this._escAttr(p.filename)}" loading="lazy" />
                <div class="photo-overlay">
                  <div class="overlay-top">
                    <div class="select-check ${this._selectedIds.includes(p.id) ? 'selected' : ''}"
                         data-action="select" data-id="${p.id}">
                      ${this._selectedIds.includes(p.id) ? icon('check', 12) : ''}
                    </div>
                    <button class="overlay-btn ${p.is_favourite ? 'active' : ''}"
                            data-action="favourite" data-id="${p.id}" title="Favourite">
                      ${icon('star', 13)}
                    </button>
                  </div>
                </div>
                ${commentCount > 0 ? `
                  <div class="card-indicators">
                    <span class="indicator">${icon('message-circle', 10)} ${commentCount}</span>
                  </div>
                ` : ''}
                ${exif ? `<div class="exif-tooltip">${exif}</div>` : ''}
              </div>
              ${hasFooter ? `
                <div class="card-footer">
                  ${hasCaption ? `<div class="card-caption">${this._esc(p.caption)}</div>` : ''}
                  ${tags.length > 0 ? `
                    <div class="card-tags">
                      ${tags.slice(0, 3).map(t => `<span class="card-tag">${this._esc(t.name)}</span>`).join('')}
                      ${tags.length > 3 ? `<span class="card-tag">+${tags.length - 3}</span>` : ''}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _getExifSummary(p) {
    const parts = [];
    const exif = p.exif_data || {};
    if (exif.Model) parts.push(exif.Model);
    else if (p.width && p.height) parts.push(`${p.width}×${p.height}`);
    if (exif.FocalLength) parts.push(`${exif.FocalLength}mm`);
    if (exif.FNumber) parts.push(`f/${exif.FNumber}`);
    if (exif.ISOSpeedRatings) parts.push(`ISO ${exif.ISOSpeedRatings}`);
    return parts.length ? parts.join(' · ') : '';
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const cell = e.target.closest('.photo-card');
      if (!cell) return;

      const photoId = cell.dataset.photoId;

      const selectCheck = e.target.closest('[data-action="select"]');
      if (selectCheck) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('photo-select-toggle', {
          bubbles: true, composed: true,
          detail: { photoId },
        }));
        return;
      }

      const favBtn = e.target.closest('[data-action="favourite"]');
      if (favBtn) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('photo-action', {
          bubbles: true, composed: true,
          detail: { action: 'favourite', photoId },
        }));
        return;
      }

      if (e.shiftKey) {
        this.dispatchEvent(new CustomEvent('photo-select-toggle', {
          bubbles: true, composed: true,
          detail: { photoId },
        }));
        return;
      }

      this.dispatchEvent(new CustomEvent('photo-open', {
        bubbles: true, composed: true,
        detail: { photoId },
      }));
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-photos-grid', PosPhotosGrid);
