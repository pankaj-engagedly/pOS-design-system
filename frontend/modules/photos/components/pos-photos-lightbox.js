// pos-photos-lightbox — Full-viewport photo viewer with bottom metadata bar
//
// Layout: top-bar | photo (with nav arrows) | metadata bar
// The info/comment sidebar is toggled via the comment button.

import { icon } from '../../../shared/utils/icons.js';
import { thumbUrl, originalUrl, getTags } from '../services/photos-api.js';
import './pos-photos-photo-info.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
  }
  :host([open]) { display: flex; }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
  }

  .container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  /* Top bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--pos-space-xs) var(--pos-space-md);
    flex-shrink: 0;
  }

  .top-left, .top-right { display: flex; align-items: center; gap: var(--pos-space-xs); }

  .top-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    padding: 0;
    transition: background 0.1s, color 0.1s;
  }
  .top-btn:hover { background: rgba(255,255,255,0.15); color: white; }
  .top-btn.active { color: #fbbf24; }
  .top-btn svg { pointer-events: none; }

  .top-counter {
    color: rgba(255,255,255,0.5);
    font-size: var(--pos-font-size-xs);
    padding: 0 var(--pos-space-sm);
  }

  /* Main area — photo + optional side panel */
  .main-area {
    flex: 1;
    display: flex;
    min-height: 0;
    position: relative;
  }

  .photo-wrap {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .photo-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 60px;
  }

  .photo-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    border-radius: 4px;
  }

  /* Nav arrows */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    z-index: 2;
  }
  .nav-arrow:hover { background: rgba(255,255,255,0.2); color: white; }
  .nav-arrow.prev { left: 8px; }
  .nav-arrow.next { right: 8px; }
  .nav-arrow svg { pointer-events: none; }

  /* Comment/detail side panel (toggled) */
  .side-panel {
    width: 320px;
    flex-shrink: 0;
    overflow: hidden;
    transition: width 0.2s;
  }
  .side-panel.hidden { width: 0; }

  /* ── Bottom metadata bar ── */
  .meta-bar {
    flex-shrink: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: var(--pos-space-sm) var(--pos-space-lg);
    display: flex;
    align-items: flex-start;
    gap: var(--pos-space-lg);
    color: rgba(255,255,255,0.85);
    font-size: var(--pos-font-size-sm);
    min-height: 40px;
  }

  .meta-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Caption */
  .meta-caption {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: rgba(255,255,255,0.9);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    outline: none;
    resize: none;
    min-height: 24px;
    max-height: 60px;
    box-sizing: border-box;
  }
  .meta-caption::placeholder { color: rgba(255,255,255,0.3); }
  .meta-caption:hover { border-color: rgba(255,255,255,0.15); }
  .meta-caption:focus { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.05); }

  /* Tags row */
  .meta-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 8px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.8);
    font-size: var(--pos-font-size-xs);
    border: none;
  }
  .meta-tag-remove {
    display: flex;
    cursor: pointer;
    color: rgba(255,255,255,0.4);
    background: none;
    border: none;
    padding: 0;
  }
  .meta-tag-remove:hover { color: rgba(255,255,255,0.8); }

  .meta-add-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 8px;
    border-radius: 99px;
    border: 1px dashed rgba(255,255,255,0.2);
    background: transparent;
    color: rgba(255,255,255,0.4);
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
  }
  .meta-add-tag:hover { border-color: rgba(255,255,255,0.4); color: rgba(255,255,255,0.7); }

  .meta-tag-input-wrap {
    position: relative;
    min-width: 120px;
  }
  .meta-tag-input {
    padding: 1px 8px;
    border-radius: 99px;
    border: 1px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.9);
    font-size: var(--pos-font-size-xs);
    font-family: inherit;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .meta-tag-suggestions {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-height: 150px;
    overflow-y: auto;
    z-index: 100;
    margin-bottom: 4px;
    display: none;
  }
  .meta-tag-suggestions.visible { display: block; }
  .meta-tag-suggestion {
    padding: 6px 10px;
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    color: var(--pos-color-text-primary);
  }
  .meta-tag-suggestion:hover { background: var(--pos-color-background-secondary); }
  .meta-tag-suggestion .new-badge {
    font-size: 10px;
    color: var(--pos-color-action-primary);
    font-style: italic;
  }

  /* EXIF details */
  .meta-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--pos-space-sm);
    align-items: center;
    color: rgba(255,255,255,0.45);
    font-size: var(--pos-font-size-xs);
  }
  .meta-detail-sep { color: rgba(255,255,255,0.15); }

  /* Rating in meta */
  .meta-rating {
    display: flex;
    gap: 1px;
    align-items: center;
    flex-shrink: 0;
  }
  .meta-rating-star {
    cursor: pointer;
    color: rgba(255,255,255,0.2);
    background: none;
    border: none;
    padding: 1px;
    display: flex;
    transition: color 0.1s;
  }
  .meta-rating-star.filled { color: #fbbf24; }
  .meta-rating-star:hover { color: #f59e0b; }
`);

class PosPhotosLightbox extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._photos = [];
    this._currentIndex = 0;
    this._photo = null;
    this._showComments = false;
    this._addingTag = false;
    this._tagQuery = '';
    this._allTags = [];
    this._keyHandler = this._onKeyDown.bind(this);
  }

  set photos(val) { this._photos = val || []; }

  open(photoId) {
    const idx = this._photos.findIndex(p => p.id === photoId);
    this._currentIndex = idx === -1 ? 0 : Math.max(0, idx);
    this.setAttribute('open', '');
    this._render();
    document.addEventListener('keydown', this._keyHandler);
    this._requestPhotoDetail();
    getTags().then(tags => { this._allTags = tags; }).catch(() => {});
  }

  close() {
    this.removeAttribute('open');
    document.removeEventListener('keydown', this._keyHandler);
  }

  refreshPhoto(photo) {
    this._photo = photo;
    this._updateMetaBar();
    this._updateSidePanel();
    // Update fav button
    const favBtn = this.shadow.getElementById('fav-btn');
    if (favBtn) {
      favBtn.classList.toggle('active', photo?.is_favourite);
    }
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  _render() {
    const p = this._photos[this._currentIndex];
    if (!p) {
      this.shadow.innerHTML = `<div class="backdrop"></div>`;
      return;
    }

    const hasPrev = this._currentIndex > 0;
    const hasNext = this._currentIndex < this._photos.length - 1;
    const isFav = this._photo?.is_favourite || p.is_favourite;

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="container">
        <div class="top-bar">
          <div class="top-left">
            <button class="top-btn" id="close-btn" title="Close (Esc)">${icon('x', 18)}</button>
            <span class="top-counter">${this._currentIndex + 1} / ${this._photos.length}</span>
          </div>
          <div class="top-right">
            <button class="top-btn ${isFav ? 'active' : ''}" id="fav-btn" title="Favourite (F)">${icon('star', 16)}</button>
            <button class="top-btn ${this._showComments ? 'active' : ''}" id="comments-btn" title="Comments & Details (I)">${icon('message-circle', 16)}</button>
            <button class="top-btn" id="delete-btn" title="Delete">${icon('trash', 16)}</button>
          </div>
        </div>

        <div class="main-area">
          <div class="photo-wrap">
            ${hasPrev ? `<button class="nav-arrow prev" id="prev-btn">${icon('chevron-left', 22)}</button>` : ''}
            <div class="photo-container">
              <img src="${thumbUrl(p.id, 'lg')}" alt="${this._escAttr(p.filename)}" />
            </div>
            ${hasNext ? `<button class="nav-arrow next" id="next-btn">${icon('chevron-right', 22)}</button>` : ''}
          </div>
          <div class="side-panel ${this._showComments ? '' : 'hidden'}">
            <pos-photos-photo-info></pos-photos-photo-info>
          </div>
        </div>

        <div class="meta-bar" id="meta-bar">
          ${this._renderMetaBar(this._photo || p)}
        </div>
      </div>
    `;

    this._updateSidePanel();
  }

  _renderMetaBar(p) {
    const detail = this._photo;
    const exif = detail?.exif_data || {};
    const camera = this._getCameraInfo(exif);
    const tags = detail?.tags || [];

    // Build EXIF details string
    const details = [];
    if (p.width && p.height) details.push(`${p.width} × ${p.height}`);
    if (p.file_size) details.push(this._formatSize(p.file_size));
    if (camera.model) details.push(camera.model);
    if (camera.settings) details.push(camera.settings);
    if (detail?.taken_at) details.push(this._formatDate(detail.taken_at));
    else if (p.created_at) details.push(this._formatDate(p.created_at));

    return `
      <div class="meta-left">
        <textarea class="meta-caption" id="meta-caption" rows="1"
          placeholder="Add a caption\u2026">${this._esc(detail?.caption || p.caption || '')}</textarea>

        <div class="meta-tags" id="meta-tags">
          ${tags.map(t => `
            <span class="meta-tag">
              ${this._esc(t.name)}
              <button class="meta-tag-remove" data-action="remove-tag" data-tag-id="${t.id}">${icon('x', 9)}</button>
            </span>
          `).join('')}
          ${this._addingTag
            ? `<div class="meta-tag-input-wrap">
                <input class="meta-tag-input" id="meta-tag-input" placeholder="Search or create tag\u2026" value="${this._esc(this._tagQuery)}" />
                <div class="meta-tag-suggestions" id="meta-tag-suggestions"></div>
              </div>`
            : `<button class="meta-add-tag" id="meta-add-tag">${icon('plus', 9)} tag</button>`
          }
        </div>

        <div class="meta-details">
          ${details.join(` <span class="meta-detail-sep">·</span> `)}
          ${detail?.location_name ? ` <span class="meta-detail-sep">·</span> ${this._esc(detail.location_name)}` : ''}
        </div>
      </div>

      <div class="meta-rating">
        ${[1,2,3,4,5].map(n => `
          <button class="meta-rating-star ${(detail?.rating || p.rating || 0) >= n ? 'filled' : ''}" data-rating="${n}">
            ${icon('star', 14)}
          </button>
        `).join('')}
      </div>
    `;
  }

  _updateMetaBar() {
    const bar = this.shadow.getElementById('meta-bar');
    const p = this._photos[this._currentIndex];
    if (bar && p) {
      bar.innerHTML = this._renderMetaBar(this._photo || p);
      if (this._addingTag) {
        setTimeout(() => {
          this.shadow.getElementById('meta-tag-input')?.focus();
          this._renderTagSuggestions();
        }, 0);
      }
    }
  }

  _updateSidePanel() {
    const infoPanel = this.shadow.querySelector('pos-photos-photo-info');
    if (infoPanel && this._photo) {
      infoPanel.photo = this._photo;
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#close-btn') || e.target.closest('.backdrop')) {
        this.close();
        this.dispatchEvent(new CustomEvent('lightbox-close', { bubbles: true, composed: true }));
        return;
      }

      if (e.target.closest('#prev-btn')) { this._navigate(-1); return; }
      if (e.target.closest('#next-btn')) { this._navigate(1); return; }

      if (e.target.closest('#fav-btn')) {
        const p = this._photos[this._currentIndex];
        if (p) {
          this.dispatchEvent(new CustomEvent('lightbox-action', {
            bubbles: true, composed: true,
            detail: { action: 'favourite', photoId: p.id },
          }));
        }
        return;
      }

      if (e.target.closest('#delete-btn')) {
        const p = this._photos[this._currentIndex];
        if (p) {
          this.dispatchEvent(new CustomEvent('lightbox-action', {
            bubbles: true, composed: true,
            detail: { action: 'delete', photoId: p.id },
          }));
        }
        return;
      }

      // Comments toggle
      if (e.target.closest('#comments-btn')) {
        this._showComments = !this._showComments;
        const panel = this.shadow.querySelector('.side-panel');
        if (panel) panel.classList.toggle('hidden', !this._showComments);
        const btn = this.shadow.getElementById('comments-btn');
        if (btn) btn.classList.toggle('active', this._showComments);
        return;
      }

      // Rating in meta bar
      const ratingStar = e.target.closest('.meta-rating-star');
      if (ratingStar) {
        this._emitInfo('update-rating', { rating: ratingStar.dataset.rating });
        return;
      }

      // Tag suggestion click
      const suggestion = e.target.closest('.meta-tag-suggestion');
      if (suggestion) {
        this._emitInfo('add-tag', { tagName: suggestion.dataset.name });
        this._addingTag = false;
        this._tagQuery = '';
        return;
      }

      // Add tag button
      if (e.target.closest('#meta-add-tag')) {
        this._addingTag = true;
        this._tagQuery = '';
        this._updateMetaBar();
        return;
      }

      // Remove tag
      const removeTag = e.target.closest('[data-action="remove-tag"]');
      if (removeTag) {
        this._emitInfo('remove-tag', { tagId: removeTag.dataset.tagId });
        return;
      }
    });

    this.shadow.addEventListener('input', (e) => {
      const tagInput = e.target.closest('#meta-tag-input');
      if (tagInput) {
        this._tagQuery = tagInput.value;
        this._renderTagSuggestions();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      // Tag input in meta bar
      const tagInput = e.target.closest('#meta-tag-input');
      if (tagInput) {
        e.stopPropagation(); // Don't trigger lightbox shortcuts
        if (e.key === 'Enter' && tagInput.value.trim()) {
          this._emitInfo('add-tag', { tagName: tagInput.value.trim() });
          this._addingTag = false;
          this._tagQuery = '';
        }
        if (e.key === 'Escape') {
          this._addingTag = false;
          this._tagQuery = '';
          this._updateMetaBar();
        }
        return;
      }

      // Caption textarea — prevent lightbox shortcuts
      if (e.target.closest('#meta-caption')) {
        e.stopPropagation();
        return;
      }
    });

    // Caption change
    this.shadow.addEventListener('change', (e) => {
      if (e.target.closest('#meta-caption')) {
        this._emitInfo('update-caption', { caption: e.target.value });
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#meta-tag-input')) {
        setTimeout(() => { this._addingTag = false; this._tagQuery = ''; this._updateMetaBar(); }, 150);
      }
    });
  }

  _emitInfo(action, extra = {}) {
    const p = this._photos[this._currentIndex];
    if (!p) return;
    this.dispatchEvent(new CustomEvent('info-action', {
      bubbles: true, composed: true,
      detail: { action, photoId: p.id, ...extra },
    }));
  }

  _navigate(dir) {
    const newIndex = this._currentIndex + dir;
    if (newIndex < 0 || newIndex >= this._photos.length) return;
    this._currentIndex = newIndex;
    this._photo = null;
    this._addingTag = false;
    this._tagQuery = '';
    this._render();
    this._requestPhotoDetail();
  }

  _requestPhotoDetail() {
    const p = this._photos[this._currentIndex];
    if (p) {
      this.dispatchEvent(new CustomEvent('lightbox-load-detail', {
        bubbles: true, composed: true,
        detail: { photoId: p.id },
      }));
    }
  }

  _onKeyDown(e) {
    if (!this.hasAttribute('open')) return;
    // Don't intercept when typing in inputs
    if (e.target.closest('input, textarea')) return;

    switch (e.key) {
      case 'Escape':
        this.close();
        this.dispatchEvent(new CustomEvent('lightbox-close', { bubbles: true, composed: true }));
        break;
      case 'ArrowLeft': this._navigate(-1); break;
      case 'ArrowRight': this._navigate(1); break;
      case 'f': case 'F': {
        const p = this._photos[this._currentIndex];
        if (p) {
          this.dispatchEvent(new CustomEvent('lightbox-action', {
            bubbles: true, composed: true,
            detail: { action: 'favourite', photoId: p.id },
          }));
        }
        break;
      }
      case 'i': case 'I': {
        this._showComments = !this._showComments;
        const panel = this.shadow.querySelector('.side-panel');
        if (panel) panel.classList.toggle('hidden', !this._showComments);
        const btn = this.shadow.getElementById('comments-btn');
        if (btn) btn.classList.toggle('active', this._showComments);
        break;
      }
    }
  }

  _getTagSuggestions() {
    const q = this._tagQuery.toLowerCase().trim();
    if (!q) return [];
    const existingNames = new Set((this._photo?.tags || []).map(t => t.name.toLowerCase()));
    const matches = this._allTags
      .filter(t => t.name.toLowerCase().includes(q) && !existingNames.has(t.name.toLowerCase()))
      .slice(0, 8)
      .map(t => ({ name: t.name, isNew: false }));
    const exactMatch = this._allTags.some(t => t.name.toLowerCase() === q) || existingNames.has(q);
    if (!exactMatch && q.length > 0) {
      matches.push({ name: this._tagQuery.trim(), isNew: true });
    }
    return matches;
  }

  _renderTagSuggestions() {
    const container = this.shadow.getElementById('meta-tag-suggestions');
    if (!container) return;
    const suggestions = this._getTagSuggestions();
    if (!suggestions.length) {
      container.classList.remove('visible');
      return;
    }
    container.innerHTML = suggestions.map(s => `
      <div class="meta-tag-suggestion" data-name="${this._escAttr(s.name)}">
        ${this._esc(s.name)}
        ${s.isNew ? '<span class="new-badge">new</span>' : ''}
      </div>
    `).join('');
    container.classList.add('visible');
  }

  _getCameraInfo(exif) {
    const result = {};
    if (exif.Model) result.model = exif.Model;
    if (exif.LensModel) result.lens = exif.LensModel;
    const parts = [];
    if (exif.FocalLength) parts.push(`${exif.FocalLength}mm`);
    if (exif.FNumber) parts.push(`f/${exif.FNumber}`);
    if (exif.ISOSpeedRatings) parts.push(`ISO ${exif.ISOSpeedRatings}`);
    if (exif.ExposureTime) {
      const et = exif.ExposureTime;
      parts.push(et < 1 ? `1/${Math.round(1/et)}s` : `${et}s`);
    }
    if (parts.length) result.settings = parts.join(' · ');
    return result;
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

customElements.define('pos-photos-lightbox', PosPhotosLightbox);
