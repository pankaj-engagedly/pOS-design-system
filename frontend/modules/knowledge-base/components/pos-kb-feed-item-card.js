// pos-kb-feed-item-card — Feed item card using shared pos-content-card

import { icon } from '../../../shared/utils/icons.js';
import './pos-content-card.js';

class PosKBFeedItemCard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
  }

  set item(val) { this._item = val; this._render(); }

  connectedCallback() {
    this.shadow.addEventListener('card-action', (e) => {
      this.dispatchEvent(new CustomEvent('feed-item-action', {
        bubbles: true, composed: true,
        detail: { action: e.detail.action, itemId: this._item?.id, item: this._item },
      }));
    });
    this.shadow.addEventListener('card-click', () => {
      if (!this._item?.url) return;
      // Mark as read
      if (!this._item.is_read) {
        this.dispatchEvent(new CustomEvent('feed-item-action', {
          bubbles: true, composed: true,
          detail: { action: 'toggle-read', itemId: this._item.id, item: this._item },
        }));
      }
      // Audio URLs → play in lightbox; everything else → open in browser
      if (/\.(mp3|wav|ogg|aac|m4a|flac)(\?|\/|#|$)/i.test(this._item.url)) {
        this.dispatchEvent(new CustomEvent('feed-item-play', {
          bubbles: true, composed: true,
          detail: { item: this._item },
        }));
      } else {
        window.open(this._item.url, '_blank', 'noopener');
      }
    });
  }

  _render() {
    const it = this._item;
    if (!it) { this.shadow.innerHTML = ''; return; }

    const isRead = !!it.is_read;

    if (!this.shadow.querySelector('pos-content-card')) {
      this.shadow.innerHTML = '<pos-content-card></pos-content-card>';
    }

    const card = this.shadow.querySelector('pos-content-card');
    card.card = {
      id: it.id,
      title: it.title,
      summary: it.summary ? this._stripHtml(it.summary) : '',
      sourceLabel: it.source_title || it.author || '',
      sourceIcon: it.source_icon_url || null,
      thumbnailUrl: it.thumbnail_url || null,
      timeLabel: this._timeAgo(it.published_at || it.created_at),
      url: it.url,
      isStarred: it.is_starred,
      isSaved: !!it.kb_item_id,
      rating: null,
      tags: [],
      muted: isRead,
      selected: false,
    };
    card.actionsHtml = `
      <button data-action="toggle-read" title="${isRead ? 'Mark unread' : 'Mark read'}">${icon(isRead ? 'eye-off' : 'eye', 16)}</button>
      <button class="${it.is_starred ? 'starred' : ''}" data-action="toggle-star" title="${it.is_starred ? 'Unstar' : 'Star'}">${icon('star', 16)}</button>
      <button class="${it.kb_item_id ? 'saved' : ''}" data-action="save-to-kb" title="${it.kb_item_id ? 'Saved to KB' : 'Save to KB'}">${icon('bookmark', 16)}</button>
    `;
  }

  _stripHtml(html) {
    if (!html) return '';
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || d.innerText || '').trim();
  }

  _timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

customElements.define('pos-kb-feed-item-card', PosKBFeedItemCard);
