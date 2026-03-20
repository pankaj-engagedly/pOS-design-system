// pos-content-card — Shared Medium-style content card
// Used by pos-kb-item-card and pos-kb-feed-item-card
// Purely presentational — parents handle events via card-action / card-click

import { icon } from '../../../shared/utils/icons.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; }

  .card {
    padding: var(--pos-space-lg) 0;
    border-bottom: 1px solid var(--pos-color-border-default);
    cursor: pointer;
  }
  .card.muted .source-name,
  .card.muted .title,
  .card.muted .summary { opacity: 0.55; }
  .card.selected {
    background: var(--pos-color-background-secondary);
    margin: 0 calc(var(--pos-space-sm) * -1);
    padding-left: var(--pos-space-sm);
    padding-right: var(--pos-space-sm);
    border-radius: var(--pos-radius-sm);
  }

  /* Source row */
  .source-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--pos-space-sm);
  }
  .source-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .source-icon-fallback {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-secondary);
  }
  .source-name {
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-primary);
    font-weight: var(--pos-font-weight-medium);
  }

  /* Body */
  .card-body {
    display: flex;
    gap: var(--pos-space-md);
    align-items: flex-start;
  }
  .card-text {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: var(--pos-font-size-md);
    font-weight: var(--pos-font-weight-bold, 700);
    color: var(--pos-color-text-primary);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  .summary {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-thumb {
    width: 120px;
    height: 120px;
    border-radius: var(--pos-radius-sm);
    object-fit: cover;
    flex-shrink: 0;
  }

  /* Tags + rating extras row */
  .extras {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    margin-top: var(--pos-space-xs);
    flex-wrap: wrap;
  }
  .rating-stars {
    display: flex;
    gap: 1px;
    color: #f59e0b;
  }
  .rating-stars svg { flex-shrink: 0; }
  .tag-chip {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 99px;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-secondary);
  }

  /* Footer */
  .card-footer {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    margin-top: var(--pos-space-sm);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
    flex: 1;
  }
  .meta .dot { font-size: 10px; }
  .star-indicator {
    color: #f59e0b;
    display: flex;
    align-items: center;
  }

  /* Action area (injected via actionsHtml) */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .card-actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    padding: 0;
    transition: color 0.1s, background 0.1s;
  }
  .card-actions button:hover {
    color: var(--pos-color-text-primary);
    background: var(--pos-color-background-secondary);
  }
  .card-actions button svg { pointer-events: none; }
  .card-actions .starred { color: #f59e0b; }
  .card-actions .saved { color: var(--pos-color-action-primary); }
  .card-actions .active { color: #f59e0b; }
  .card-actions .delete:hover { color: var(--pos-color-priority-urgent); }

  /* ── Compact mode (vertical card for grid view) ── */
  :host([compact]) { height: 100%; }
  :host([compact]) .card {
    padding: 0;
    border-bottom: none;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md, 8px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  :host([compact]) .card.selected {
    margin: 0;
    border-color: var(--pos-color-action-primary);
  }
  :host([compact]) .card-thumb-top {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
  }
  :host([compact]) .card-thumb-placeholder {
    width: 100%;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg,
      var(--pos-color-background-secondary) 0%,
      var(--pos-color-border-default) 100%);
    color: var(--pos-color-text-secondary);
    opacity: 0.5;
  }
  :host([compact]) .card-body {
    padding: var(--pos-space-sm) var(--pos-space-md) 0;
    flex-direction: column;
    gap: var(--pos-space-xs);
  }
  :host([compact]) .card-thumb { display: none; }
  :host([compact]) .title {
    font-size: var(--pos-font-size-sm);
    -webkit-line-clamp: 2;
    margin-bottom: 0;
  }
  :host([compact]) .summary { display: none; }
  :host([compact]) .source-row {
    margin-bottom: 0;
    padding: var(--pos-space-sm) var(--pos-space-md) 0;
  }
  :host([compact]) .extras {
    padding: 0 var(--pos-space-md);
    min-height: 20px;
    max-height: 22px;
    overflow: hidden;
  }
  :host([compact]) .card-footer {
    padding: var(--pos-space-xs) var(--pos-space-md) var(--pos-space-sm);
    margin-top: auto;
  }
  :host([compact]) .card-actions button {
    width: 26px;
    height: 26px;
  }
`);

class PosContentCard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._data = null;
    this._actionsHtml = '';
    this._compact = false;
  }

  static get observedAttributes() { return ['compact']; }

  attributeChangedCallback(name) {
    if (name === 'compact') {
      this._compact = this.hasAttribute('compact');
      this._render();
    }
  }

  set card(val) {
    this._data = val;
    this._render();
  }

  set selected(val) {
    if (this._data) {
      this._data = { ...this._data, selected: val };
      this._render();
    }
  }

  set actionsHtml(val) {
    this._actionsHtml = val || '';
    this._renderActions();
  }

  connectedCallback() {
    this.shadow.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('card-action', {
          bubbles: true, composed: true,
          detail: { action: actionBtn.dataset.action, ...actionBtn.dataset },
        }));
        return;
      }
      if (e.target.closest('.card')) {
        this.dispatchEvent(new CustomEvent('card-click', {
          bubbles: true, composed: true,
        }));
      }
    });
  }

  _render() {
    const data = this._data;
    if (!data) { this.shadow.innerHTML = ''; return; }

    const sourceIconHtml = data.sourceIcon
      ? `<img class="source-icon" src="${this._escAttr(data.sourceIcon)}" alt="" />`
      : `<div class="source-icon-fallback">${icon('rss', 10)}</div>`;

    const isCompact = this.hasAttribute('compact');

    let thumbTopHtml = '';
    if (isCompact) {
      thumbTopHtml = data.thumbnailUrl
        ? `<img class="card-thumb-top" src="${this._escAttr(data.thumbnailUrl)}" alt="" loading="lazy" />`
        : `<div class="card-thumb-placeholder">${icon('image', 32)}</div>`;
    }

    const thumbHtml = (!isCompact && data.thumbnailUrl)
      ? `<img class="card-thumb" src="${this._escAttr(data.thumbnailUrl)}" alt="" loading="lazy" />`
      : '';

    const summaryHtml = data.summary
      ? `<div class="summary">${this._esc(data.summary)}</div>`
      : '';

    const hasExtras = (data.rating && data.rating > 0) || (data.tags && data.tags.length > 0);
    let extrasHtml = '';
    if (hasExtras) {
      const starsHtml = data.rating
        ? `<div class="rating-stars">${[1,2,3,4,5].map(n =>
            `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${n <= data.rating ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          ).join('')}</div>`
        : '';
      const allTags = data.tags || [];
      const maxTags = isCompact ? 2 : allTags.length;
      const visibleTags = allTags.slice(0, maxTags);
      const overflowCount = allTags.length - maxTags;
      const tagsHtml = visibleTags.map(t =>
        `<span class="tag-chip">${this._esc(t.name)}</span>`
      ).join('') + (overflowCount > 0 ? `<span class="tag-chip">+${overflowCount}</span>` : '');
      extrasHtml = `<div class="extras">${starsHtml}${tagsHtml}</div>`;
    }
    // In compact mode, always reserve space for extras row
    if (isCompact && !hasExtras) {
      extrasHtml = `<div class="extras"></div>`;
    }

    const starredHtml = data.isStarred
      ? `<span class="star-indicator">${icon('star', 12)}</span>`
      : '';
    const savedHtml = data.isSaved
      ? `<span class="dot">&middot;</span><span>Saved</span>`
      : '';

    this.shadow.innerHTML = `
      <div class="card ${data.muted ? 'muted' : ''} ${data.selected ? 'selected' : ''}">
        ${thumbTopHtml}
        <div class="source-row">
          ${sourceIconHtml}
          <span class="source-name">${this._esc(data.sourceLabel)}</span>
        </div>
        <div class="card-body">
          <div class="card-text">
            <div class="title">${this._esc(data.title)}</div>
            ${summaryHtml}
          </div>
          ${thumbHtml}
        </div>
        ${extrasHtml}
        <div class="card-footer">
          <div class="meta">
            <span>${this._esc(data.timeLabel)}</span>
            ${starredHtml}
            ${savedHtml}
          </div>
          <div class="card-actions" id="card-actions"></div>
        </div>
      </div>
    `;

    // Inject actions after render
    this._renderActions();
  }

  _renderActions() {
    const container = this.shadow.getElementById('card-actions');
    if (container) container.innerHTML = this._actionsHtml;
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

customElements.define('pos-content-card', PosContentCard);
