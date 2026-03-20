// pos-kb-subscribe-dialog — Subscribe to a new feed (URL + podcast search)

import { icon } from '../../../shared/utils/icons.js';
import { subscribeFeed, discoverFeed } from '../services/feed-api.js';

class PosKBSubscribeDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._url = '';
    this._discovering = false;
    this._subscribing = false;
    this._preview = null;
    this._error = null;
    // Podcast search state
    this._mode = 'url'; // 'url' | 'podcast'
    this._podcastQuery = '';
    this._podcastResults = [];
    this._searching = false;
    this._searchTimeout = null;
  }

  open() {
    this._open = true;
    this._url = '';
    this._discovering = false;
    this._subscribing = false;
    this._preview = null;
    this._error = null;
    this._mode = 'url';
    this._podcastQuery = '';
    this._podcastResults = [];
    this._searching = false;
    this._render();
    setTimeout(() => this.shadow.getElementById('feed-url-input')?.focus(), 50);
  }

  close() {
    this._open = false;
    this._render();
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .dialog {
          background: var(--pos-color-background-primary);
          border-radius: var(--pos-radius-md);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          width: 480px;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        .dialog-header {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }
        .dialog-header h3 {
          margin: 0;
          flex: 1;
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
        }
        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
        }
        .close-btn:hover { background: var(--pos-color-border-default); }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
          padding: 0 var(--pos-space-md);
        }
        .tab {
          padding: var(--pos-space-sm) var(--pos-space-md);
          border: none;
          background: transparent;
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .tab:hover { color: var(--pos-color-text-primary); }
        .tab.active {
          color: var(--pos-color-action-primary);
          border-bottom-color: var(--pos-color-action-primary);
          font-weight: var(--pos-font-weight-medium);
        }

        .dialog-body {
          padding: var(--pos-space-md);
          overflow-y: auto;
          flex: 1;
        }

        .field-label {
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--pos-space-xs);
        }

        .url-row {
          display: flex;
          gap: var(--pos-space-xs);
        }

        .url-input {
          flex: 1;
          padding: var(--pos-space-sm);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
          box-sizing: border-box;
        }
        .url-input:focus { border-color: var(--pos-color-action-primary); }

        .discover-btn {
          padding: var(--pos-space-sm) var(--pos-space-md);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-primary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
        }
        .discover-btn:hover { background: var(--pos-color-background-secondary); }
        .discover-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .error {
          color: var(--pos-color-priority-urgent);
          font-size: var(--pos-font-size-xs);
          margin-top: var(--pos-space-xs);
        }

        .preview {
          margin-top: var(--pos-space-md);
          padding: var(--pos-space-sm);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: var(--pos-color-background-secondary);
        }
        .preview-title {
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          font-size: var(--pos-font-size-sm);
        }
        .preview-meta {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          margin-top: 4px;
          display: flex;
          gap: var(--pos-space-sm);
        }

        /* Podcast search */
        .search-input {
          width: 100%;
          padding: var(--pos-space-sm);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
          box-sizing: border-box;
        }
        .search-input:focus { border-color: var(--pos-color-action-primary); }

        .searching-hint {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          margin-top: var(--pos-space-xs);
          text-align: center;
          padding: var(--pos-space-sm) 0;
        }

        .podcast-results {
          margin-top: var(--pos-space-sm);
        }
        .podcast-result {
          display: flex;
          gap: var(--pos-space-sm);
          align-items: center;
          padding: var(--pos-space-sm);
          border-radius: var(--pos-radius-sm);
          transition: background 0.1s;
        }
        .podcast-result:hover { background: var(--pos-color-background-secondary); }
        .podcast-artwork {
          width: 48px;
          height: 48px;
          border-radius: var(--pos-radius-sm);
          object-fit: cover;
          flex-shrink: 0;
          background: var(--pos-color-background-secondary);
        }
        .podcast-info {
          flex: 1;
          min-width: 0;
        }
        .podcast-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .podcast-meta {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .podcast-subscribe-btn {
          padding: 4px 12px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-action-primary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.1s, color 0.1s;
        }
        .podcast-subscribe-btn:hover {
          background: var(--pos-color-action-primary);
          color: white;
        }
        .podcast-subscribe-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-md);
          border-top: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }

        .btn {
          padding: var(--pos-space-xs) var(--pos-space-md);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          border: 1px solid var(--pos-color-border-default);
          background: transparent;
          color: var(--pos-color-text-primary);
        }
        .btn:hover { background: var(--pos-color-background-secondary); }
        .btn-primary {
          background: var(--pos-color-action-primary);
          color: white;
          border-color: var(--pos-color-action-primary);
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>

      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>${icon('rss', 18)} Subscribe to Feed</h3>
            <button class="close-btn" id="close-btn">${icon('x', 16)}</button>
          </div>

          <div class="tabs">
            <button class="tab ${this._mode === 'url' ? 'active' : ''}" data-mode="url">URL</button>
            <button class="tab ${this._mode === 'podcast' ? 'active' : ''}" data-mode="podcast">Podcast Search</button>
          </div>

          <div class="dialog-body">
            ${this._mode === 'url' ? `
              <div class="field-label">Feed or Website URL</div>
              <div class="url-row">
                <input class="url-input" id="feed-url-input"
                       placeholder="https://blog.example.com or RSS URL" type="url"
                       value="${this._escAttr(this._url)}" />
                <button class="discover-btn" id="discover-btn" ${this._discovering ? 'disabled' : ''}>
                  ${this._discovering ? 'Checking\u2026' : 'Preview'}
                </button>
              </div>
              ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
              ${this._preview ? `
                <div class="preview">
                  <div class="preview-title">${this._esc(this._preview.title)}</div>
                  <div class="preview-meta">
                    <span>${this._esc(this._preview.feed_type.toUpperCase())}</span>
                    <span>${this._preview.item_count} items</span>
                  </div>
                </div>
              ` : ''}
            ` : `
              <input class="search-input" id="podcast-search"
                     placeholder="Search podcasts\u2026"
                     value="${this._escAttr(this._podcastQuery)}" />
              ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
              ${this._searching ? `<div class="searching-hint">Searching\u2026</div>` : ''}
              ${!this._searching && this._podcastResults.length > 0 ? `
                <div class="podcast-results">
                  ${this._podcastResults.map((p, i) => `
                    <div class="podcast-result">
                      <img class="podcast-artwork" src="${this._escAttr(p.artworkUrl100 || '')}" alt="" loading="lazy" />
                      <div class="podcast-info">
                        <div class="podcast-name">${this._esc(p.collectionName || p.trackName || '')}</div>
                        <div class="podcast-meta">${this._esc(p.artistName || '')} &middot; ${p.trackCount || 0} episodes</div>
                      </div>
                      <button class="podcast-subscribe-btn"
                              data-feed-url="${this._escAttr(p.feedUrl || '')}"
                              data-podcast-index="${i}"
                              ${!p.feedUrl || this._subscribing ? 'disabled' : ''}>
                        ${this._subscribing ? 'Subscribing\u2026' : 'Subscribe'}
                      </button>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            `}
          </div>

          <div class="dialog-footer">
            <button class="btn" id="cancel-btn">Cancel</button>
            ${this._mode === 'url' ? `
              <button class="btn btn-primary" id="subscribe-btn"
                      ${this._subscribing ? 'disabled' : ''}>
                ${this._subscribing ? 'Subscribing\u2026' : 'Subscribe'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.shadow.getElementById('overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'overlay') this.close();
    });
    this.shadow.getElementById('close-btn')?.addEventListener('click', () => this.close());
    this.shadow.getElementById('cancel-btn')?.addEventListener('click', () => this.close());

    // Tab switching
    this.shadow.querySelectorAll('[data-mode]').forEach(tab => {
      tab.addEventListener('click', () => {
        this._mode = tab.dataset.mode;
        this._error = null;
        this._render();
        if (this._mode === 'podcast') {
          setTimeout(() => this.shadow.getElementById('podcast-search')?.focus(), 50);
        } else {
          setTimeout(() => this.shadow.getElementById('feed-url-input')?.focus(), 50);
        }
      });
    });

    if (this._mode === 'url') {
      this.shadow.getElementById('discover-btn')?.addEventListener('click', () => this._discover());
      this.shadow.getElementById('subscribe-btn')?.addEventListener('click', () => this._subscribe());

      this.shadow.getElementById('feed-url-input')?.addEventListener('input', (e) => {
        this._url = e.target.value;
      });
      this.shadow.getElementById('feed-url-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this._preview) this._subscribe();
          else this._discover();
        }
        if (e.key === 'Escape') this.close();
      });
    } else {
      // Podcast search
      this.shadow.getElementById('podcast-search')?.addEventListener('input', (e) => {
        this._podcastQuery = e.target.value;
        clearTimeout(this._searchTimeout);
        if (this._podcastQuery.trim().length < 2) {
          this._podcastResults = [];
          this._renderPodcastResults();
          return;
        }
        this._searchTimeout = setTimeout(() => this._searchPodcasts(), 400);
      });
      this.shadow.getElementById('podcast-search')?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });

      // Podcast subscribe button delegation
      this.shadow.addEventListener('click', (e) => {
        const btn = e.target.closest('.podcast-subscribe-btn');
        if (btn && btn.dataset.feedUrl && !btn.disabled) {
          this._subscribePodcast(btn.dataset.feedUrl);
        }
      }, { once: false });
    }
  }

  _renderPodcastResults() {
    // Partial re-render: update just the body content without full re-render
    // to preserve the search input focus and value
    this._render();
    // Re-focus search input
    setTimeout(() => {
      const input = this.shadow.getElementById('podcast-search');
      if (input) {
        input.focus();
        // Restore cursor to end
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 0);
  }

  async _discover() {
    this._url = this.shadow.getElementById('feed-url-input')?.value.trim() || this._url;
    const url = this._url;
    if (!url) { this._error = 'Please enter a URL'; this._render(); return; }

    this._discovering = true;
    this._error = null;
    this._preview = null;
    this._render();

    try {
      this._preview = await discoverFeed(url);
      this._discovering = false;
      this._render();
    } catch (err) {
      this._error = err.message || 'Could not find a feed at this URL';
      this._discovering = false;
      this._render();
    }
  }

  async _subscribe() {
    this._url = this.shadow.getElementById('feed-url-input')?.value.trim() || this._url;
    const url = this._url;
    if (!url) return;

    this._subscribing = true;
    this._error = null;
    this._render();

    try {
      await subscribeFeed(url);
      this.close();
      this.dispatchEvent(new CustomEvent('feed-subscribed', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err.message || 'Failed to subscribe';
      this._subscribing = false;
      this._render();
    }
  }

  async _searchPodcasts() {
    const q = this._podcastQuery.trim();
    if (!q) return;
    this._searching = true;
    this._render();
    // Re-focus after render
    setTimeout(() => {
      const input = this.shadow.getElementById('podcast-search');
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 0);
    try {
      const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&limit=10`);
      const data = await resp.json();
      this._podcastResults = data.results || [];
      this._searching = false;
      this._render();
      setTimeout(() => {
        const input = this.shadow.getElementById('podcast-search');
        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      }, 0);
    } catch (err) {
      this._error = 'Search failed';
      this._searching = false;
      this._render();
    }
  }

  async _subscribePodcast(feedUrl) {
    this._subscribing = true;
    this._error = null;
    this._render();
    try {
      await subscribeFeed(feedUrl);
      this.close();
      this.dispatchEvent(new CustomEvent('feed-subscribed', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err.message || 'Failed to subscribe';
      this._subscribing = false;
      this._render();
    }
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

customElements.define('pos-kb-subscribe-dialog', PosKBSubscribeDialog);
