// pos-photos-photo-info — Info panel inside lightbox (EXIF, tags, comments, people, albums)

import { icon } from '../../../shared/utils/icons.js';
import { getTags } from '../services/photos-api.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    width: 320px;
    height: 100%;
    overflow-y: auto;
    background: var(--pos-color-background-secondary);
    border-left: 1px solid var(--pos-color-border-default);
    padding: var(--pos-space-md);
    box-sizing: border-box;
    color: var(--pos-color-text-primary);
    font-size: var(--pos-font-size-sm);
  }

  h3 {
    font-size: var(--pos-font-size-sm);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: var(--pos-space-md) 0 var(--pos-space-xs);
  }
  h3:first-child { margin-top: 0; }

  .caption-input {
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
    resize: vertical;
    min-height: 32px;
  }
  .caption-input:focus { border-color: var(--pos-color-action-primary); }

  .rating {
    display: flex;
    gap: 2px;
    margin: var(--pos-space-xs) 0;
  }
  .rating-star {
    cursor: pointer;
    color: var(--pos-color-text-secondary);
    transition: color 0.1s;
    background: none;
    border: none;
    padding: 2px;
    display: flex;
  }
  .rating-star.filled { color: #fbbf24; }
  .rating-star:hover { color: #f59e0b; }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    color: var(--pos-color-text-secondary);
  }
  .detail-row .label { color: var(--pos-color-text-secondary); }
  .detail-row .value { color: var(--pos-color-text-primary); text-align: right; }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: var(--pos-space-xs) 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: 99px;
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-primary);
  }

  .chip-remove {
    cursor: pointer;
    color: var(--pos-color-text-secondary);
    display: flex;
    background: none;
    border: none;
    padding: 0;
  }
  .chip-remove:hover { color: var(--pos-color-priority-urgent); }

  .add-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    background: transparent;
    border: 1px dashed var(--pos-color-border-default);
    border-radius: 99px;
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
  }
  .add-chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }

  .add-input {
    padding: 2px 8px;
    border: 1px solid var(--pos-color-action-primary);
    border-radius: 99px;
    font-size: var(--pos-font-size-xs);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    width: 100px;
  }
  .tag-input-wrap {
    position: relative;
    min-width: 100px;
    flex: 1;
  }
  .tag-input-wrap .add-input {
    width: 100%;
    box-sizing: border-box;
  }
  .tag-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    max-height: 150px;
    overflow-y: auto;
    z-index: 100;
    margin-top: 2px;
    display: none;
  }
  .tag-suggestions.visible { display: block; }
  .tag-suggestion {
    padding: 6px 8px;
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
  }
  .tag-suggestion:hover { background: var(--pos-color-background-secondary); }
  .tag-suggestion .new-badge {
    font-size: 10px;
    color: var(--pos-color-action-primary);
    font-style: italic;
  }

  .comment-list {
    margin: var(--pos-space-xs) 0;
  }
  .comment-item {
    padding: 4px 0;
    border-bottom: 1px solid var(--pos-color-border-default);
  }
  .comment-text { color: var(--pos-color-text-primary); }
  .comment-date { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); margin-top: 2px; }

  .comment-input-wrap {
    display: flex;
    gap: 4px;
    margin-top: var(--pos-space-xs);
  }
  .comment-input {
    flex: 1;
    padding: 4px var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-xs);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
  }
  .comment-input:focus { border-color: var(--pos-color-action-primary); }
  .comment-submit {
    padding: 4px 8px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-action-primary);
    color: white;
    font-size: var(--pos-font-size-xs);
    cursor: pointer;
  }
`);

class PosPhotosPhotoInfo extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._photo = null;
    this._addingTag = false;
    this._addingPerson = false;
    this._tagQuery = '';
    this._allTags = [];
  }

  set photo(val) {
    this._photo = val;
    this._render();
    if (val && !this._allTags.length) {
      getTags().then(tags => { this._allTags = tags; }).catch(() => {});
    }
  }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    const p = this._photo;
    if (!p) {
      this.shadow.innerHTML = `<div style="padding: var(--pos-space-md); color: var(--pos-color-text-secondary);">Select a photo to see details.</div>`;
      return;
    }

    const exif = p.exif_data || {};
    const camera = this._getCameraInfo(exif);

    this.shadow.innerHTML = `
      <h3>Caption</h3>
      <textarea class="caption-input" id="caption" placeholder="Add a caption\u2026">${this._esc(p.caption || '')}</textarea>

      <h3>Rating</h3>
      <div class="rating">
        ${[1,2,3,4,5].map(n => `
          <button class="rating-star ${(p.rating || 0) >= n ? 'filled' : ''}" data-rating="${n}">
            ${icon('star', 16)}
          </button>
        `).join('')}
      </div>

      <h3>Details</h3>
      ${p.taken_at ? `<div class="detail-row"><span class="label">Date</span><span class="value">${this._formatDate(p.taken_at)}</span></div>` : ''}
      ${p.width && p.height ? `<div class="detail-row"><span class="label">Size</span><span class="value">${p.width} × ${p.height}</span></div>` : ''}
      <div class="detail-row"><span class="label">File size</span><span class="value">${this._formatSize(p.file_size)}</span></div>
      ${camera.model ? `<div class="detail-row"><span class="label">Camera</span><span class="value">${camera.model}</span></div>` : ''}
      ${camera.lens ? `<div class="detail-row"><span class="label">Lens</span><span class="value">${camera.lens}</span></div>` : ''}
      ${camera.settings ? `<div class="detail-row"><span class="label">Settings</span><span class="value">${camera.settings}</span></div>` : ''}
      ${p.location_name ? `<div class="detail-row"><span class="label">Location</span><span class="value">${this._esc(p.location_name)}</span></div>` : ''}

      <h3>People</h3>
      <div class="chips">
        ${(p.people || []).map(person => `
          <span class="chip">
            ${this._esc(person.name)}
            <button class="chip-remove" data-action="remove-person" data-id="${person.id}">${icon('x', 10)}</button>
          </span>
        `).join('')}
        ${this._addingPerson
          ? `<input class="add-input" id="add-person-input" placeholder="Name\u2026" />`
          : `<button class="add-chip" id="add-person-btn">${icon('plus', 10)} Add</button>`
        }
      </div>

      <h3>Tags</h3>
      <div class="chips">
        ${(p.tags || []).map(tag => `
          <span class="chip">
            ${this._esc(tag.name)}
            <button class="chip-remove" data-action="remove-tag" data-tag-id="${tag.id}">${icon('x', 10)}</button>
          </span>
        `).join('')}
        ${this._addingTag
          ? `<div class="tag-input-wrap">
              <input class="add-input" id="add-tag-input" placeholder="Search or create tag\u2026" value="${this._esc(this._tagQuery)}" />
              <div class="tag-suggestions" id="tag-suggestions"></div>
            </div>`
          : `<button class="add-chip" id="add-tag-btn">${icon('plus', 10)} Add</button>`
        }
      </div>

      <h3>Albums</h3>
      <div class="chips">
        ${(p.albums || []).map(a => `
          <span class="chip">${this._esc(a.name)}</span>
        `).join('')}
      </div>

      <h3>Comments</h3>
      <div class="comment-list">
        ${(p.comments || []).map(c => `
          <div class="comment-item">
            <div class="comment-text">${this._esc(c.text)}</div>
            <div class="comment-date">${this._formatDate(c.created_at)}</div>
          </div>
        `).join('')}
      </div>
      <div class="comment-input-wrap">
        <input class="comment-input" id="comment-input" placeholder="Add a comment\u2026" />
        <button class="comment-submit" id="comment-submit">Send</button>
      </div>
    `;

    if (this._addingTag) {
      setTimeout(() => this.shadow.getElementById('add-tag-input')?.focus(), 0);
    }
    if (this._addingPerson) {
      setTimeout(() => this.shadow.getElementById('add-person-input')?.focus(), 0);
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Tag suggestion click
      const suggestion = e.target.closest('.tag-suggestion');
      if (suggestion) {
        this._emit('info-action', { action: 'add-tag', tagName: suggestion.dataset.name });
        this._addingTag = false;
        this._tagQuery = '';
        return;
      }

      // Rating
      const ratingBtn = e.target.closest('.rating-star');
      if (ratingBtn) {
        this._emit('info-action', { action: 'update-rating', rating: ratingBtn.dataset.rating });
        return;
      }

      // Add tag
      if (e.target.closest('#add-tag-btn')) {
        this._addingTag = true;
        this._tagQuery = '';
        this._render();
        return;
      }

      // Add person
      if (e.target.closest('#add-person-btn')) {
        this._addingPerson = true;
        this._render();
        return;
      }

      // Remove tag
      const removeTag = e.target.closest('[data-action="remove-tag"]');
      if (removeTag) {
        this._emit('info-action', { action: 'remove-tag', tagId: removeTag.dataset.tagId });
        return;
      }

      // Remove person
      const removePerson = e.target.closest('[data-action="remove-person"]');
      if (removePerson) {
        this._emit('info-action', { action: 'remove-person', personId: removePerson.dataset.id });
        return;
      }

      // Comment submit
      if (e.target.closest('#comment-submit')) {
        const input = this.shadow.getElementById('comment-input');
        if (input?.value.trim()) {
          this._emit('info-action', { action: 'add-comment', text: input.value.trim() });
          input.value = '';
        }
        return;
      }
    });

    this.shadow.addEventListener('input', (e) => {
      const tagInput = e.target.closest('#add-tag-input');
      if (tagInput) {
        this._tagQuery = tagInput.value;
        this._renderTagSuggestions();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      // Tag input
      const tagInput = e.target.closest('#add-tag-input');
      if (tagInput) {
        if (e.key === 'Enter' && tagInput.value.trim()) {
          this._emit('info-action', { action: 'add-tag', tagName: tagInput.value.trim() });
          this._addingTag = false;
          this._tagQuery = '';
        }
        if (e.key === 'Escape') { this._addingTag = false; this._tagQuery = ''; this._render(); }
        return;
      }

      // Person input
      const personInput = e.target.closest('#add-person-input');
      if (personInput) {
        if (e.key === 'Enter' && personInput.value.trim()) {
          this._emit('info-action', { action: 'add-person', personName: personInput.value.trim() });
          this._addingPerson = false;
        }
        if (e.key === 'Escape') { this._addingPerson = false; this._render(); }
        return;
      }

      // Comment input
      const commentInput = e.target.closest('#comment-input');
      if (commentInput && e.key === 'Enter' && commentInput.value.trim()) {
        this._emit('info-action', { action: 'add-comment', text: commentInput.value.trim() });
        commentInput.value = '';
      }
    });

    // Caption blur → save
    this.shadow.addEventListener('change', (e) => {
      if (e.target.closest('#caption')) {
        this._emit('info-action', { action: 'update-caption', caption: e.target.value });
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#add-tag-input')) {
        setTimeout(() => { this._addingTag = false; this._tagQuery = ''; this._render(); }, 150);
      }
      if (e.target.closest('#add-person-input')) {
        setTimeout(() => { this._addingPerson = false; this._render(); }, 150);
      }
    });
  }

  _emit(name, detail) {
    if (this._photo) detail.photoId = this._photo.id;
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
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
    const container = this.shadow.getElementById('tag-suggestions');
    if (!container) return;
    const suggestions = this._getTagSuggestions();
    if (!suggestions.length) {
      container.classList.remove('visible');
      return;
    }
    container.innerHTML = suggestions.map(s => `
      <div class="tag-suggestion" data-name="${this._esc(s.name)}">
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
}

customElements.define('pos-photos-photo-info', PosPhotosPhotoInfo);
