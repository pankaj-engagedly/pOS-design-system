// pos-kb-item-card — KB item card using shared pos-content-card

import { icon } from '../../../shared/utils/icons.js';
import './pos-content-card.js';

const TYPE_LABELS = {
  article: 'Article',
  video: 'Video',
  podcast: 'Podcast',
  excerpt: 'Excerpt',
  document: 'Document',
};

class PosKBItemCard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
    this._selected = false;
  }

  set item(val) { this._item = val; this._render(); }
  set selected(val) { this._selected = val; this._render(); }

  connectedCallback() {
    this.shadow.addEventListener('card-action', (e) => {
      // Handle open-url directly to preserve user gesture for window.open
      if (e.detail.action === 'open-url' && this._item?.url) {
        window.open(this._item.url, '_blank', 'noopener');
        return;
      }
      this.dispatchEvent(new CustomEvent('item-action', {
        bubbles: true, composed: true,
        detail: { action: e.detail.action, itemId: this._item?.id },
      }));
    });
    this.shadow.addEventListener('card-click', () => {
      this.dispatchEvent(new CustomEvent('item-select', {
        bubbles: true, composed: true,
        detail: { itemId: this._item?.id },
      }));
    });
  }

  _render() {
    const it = this._item;
    if (!it) { this.shadow.innerHTML = ''; return; }

    const domain = this._getDomain(it.url);
    const sourceLabel = it.source || it.site_name || domain || TYPE_LABELS[it.item_type] || '';

    const isCompact = this.hasAttribute('compact');
    if (!this.shadow.querySelector('pos-content-card')) {
      this.shadow.innerHTML = `<pos-content-card${isCompact ? ' compact' : ''}></pos-content-card>`;
    }

    const card = this.shadow.querySelector('pos-content-card');
    if (isCompact) card.setAttribute('compact', '');
    else card.removeAttribute('compact');
    card.card = {
      id: it.id,
      title: it.title,
      summary: it.preview_text || '',
      sourceLabel,
      sourceIcon: null,
      thumbnailUrl: it.thumbnail_url || null,
      timeLabel: this._formatDate(it.created_at),
      url: it.url,
      isStarred: false,
      isSaved: it.is_favourite,
      rating: it.rating || null,
      tags: it.tags || [],
      muted: false,
      selected: this._selected,
    };
    // Hover actions (top-right corner)
    card.actionsHtml = `
      <button class="${it.is_favourite ? 'active' : ''}" data-action="favourite" title="${it.is_favourite ? 'Unfavourite' : 'Favourite'}">${icon('star', 14)}</button>
      <button class="delete" data-action="delete" title="Delete">${icon('trash', 14)}</button>
    `;
    // Inline action (always visible in footer)
    card.inlineActionsHtml = it.url
      ? `<button class="card-inline-action" data-action="open-url" title="Open link">${icon('external-link', 14)}</button>`
      : '';
  }

  _getDomain(url) {
    if (!url) return '';
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return ''; }
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}

customElements.define('pos-kb-item-card', PosKBItemCard);
