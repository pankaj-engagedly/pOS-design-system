// pos-kb-lightbox — Full-screen overlay for viewing KB items
// Content routing: YouTube embed, image, video, audio, richtext (Tiptap), article card
// Info panel: collections, rating, tags (mirrors pos-kb-item-detail)

import { icon } from '../../../shared/utils/icons.js';
import { getCollections, addToCollection, removeFromCollection, getTags } from '../services/kb-api.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';
import { tiptapToHtml } from '../utils/tiptap-renderer.js';
import '../../../../design-system/src/components/ui-tag-input.js';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── YouTube / Vimeo helpers ──────────────────────────────────────────────────

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url) {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function isDirectMedia(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?|\/|#|$)/i.test(url);
}

function isDirectAudio(url) {
  if (!url) return false;
  return /\.(mp3|wav|ogg|aac|m4a|flac)(\?|\/|#|$)/i.test(url);
}

function isDirectImage(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|$)/i.test(url);
}

function isInternalAttachment(url) {
  return url && url.startsWith('/api/attachments/');
}

// ── Content type detection ───────────────────────────────────────────────────

function detectContentType(item) {
  const yt = getYouTubeId(item.url);
  if (yt) return 'youtube';
  const vimeo = getVimeoId(item.url);
  if (vimeo) return 'vimeo';

  if (item.url && isDirectImage(item.url)) return 'image';
  if (item.url && isDirectMedia(item.url)) return 'video';
  if (item.url && isDirectAudio(item.url)) return 'audio';

  // item_type 'image' — uploaded image files
  if (item.item_type === 'image' && item.url) return 'image';

  // item_type-based detection for media uploads (audio/video/image files)
  if (item.item_type === 'media' && item.url) {
    if (isDirectAudio(item.url) || isDirectAudio(item.title)) return 'audio';
    if (isDirectImage(item.url) || isDirectImage(item.title)) return 'image';
    if (isDirectMedia(item.url) || isDirectMedia(item.title)) return 'video';
    // Fallback: guess from title extension
    const ext = (item.title || '').split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(ext)) return 'image';
    if (['mp3','wav','ogg','aac','m4a','flac'].includes(ext)) return 'audio';
    return 'video';
  }

  // document type: PDF, Word, Excel, etc. (uploaded files)
  if (item.item_type === 'document' && item.url) return 'document';

  // Text/excerpt: rich text content (Tiptap JSON)
  if (item.item_type === 'text') return 'richtext';
  if (item.content && typeof item.content === 'object') return 'richtext';

  // Default: article card with open-in-browser
  return 'article';
}

class PosKBLightbox extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._item = null;
    this._list = [];
    this._index = -1;
    this._open = false;
    this._panelOpen = true;
    this._blobUrl = null;

    // Detail panel state
    this._collections = [];
    this._itemCollectionIds = new Set();
    this._allTags = [];

    // Office preview state
    this._officeHtml = null;
    this._loadingOffice = false;
  }

  connectedCallback() {
    this.shadow.addEventListener('click', (e) => this._handleClick(e));

    // Tag events → detail-action bridge (bind once, not on render)
    this.shadow.addEventListener('tag-add', (e) => {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'add-tag-submit', itemId: this._item?.id, tagName: e.detail.name },
      }));
    });
    this.shadow.addEventListener('tag-remove', (e) => {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'remove-tag', itemId: this._item?.id, tagId: e.detail.tagId },
      }));
    });

    this._keyHandler = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  open(item, itemList = []) {
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }
    this._officeHtml = null;
    this._loadingOffice = false;
    this._item = item;
    this._list = itemList;
    this._index = itemList.findIndex(i => i.id === item.id);
    this._itemCollectionIds = new Set((item.collection_ids || []).map(String));
    this._open = true;
    document.body.style.overflow = 'hidden';
    this._render();
    this._loadPanelData();

    // Fetch blob for internal attachment URLs (media uploads)
    if (isInternalAttachment(item.url)) {
      const ext = (item.title || '').split('.').pop()?.toLowerCase();
      if (['xls', 'xlsx', 'csv'].includes(ext)) {
        this._fetchExcel(item.url);
      } else if (['doc', 'docx'].includes(ext)) {
        this._fetchWord(item.url);
      } else {
        this._fetchBlob(item.url);
      }
    }
  }

  close() {
    this._open = false;
    this._item = null;
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }
    document.body.style.overflow = '';
    this.shadow.innerHTML = '';
    this.dispatchEvent(new CustomEvent('lightbox-closed', { bubbles: true, composed: true }));
  }

  refreshItem(item) {
    if (!item || !this._item || item.id !== this._item.id) return;
    this._item = item;
    this._itemCollectionIds = new Set((item.collection_ids || []).map(String));
    this._render();
    this._loadPanelData();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  _navigate(dir) {
    const newIdx = this._index + dir;
    if (newIdx < 0 || newIdx >= this._list.length) return;
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }
    this._officeHtml = null;
    this._loadingOffice = false;
    this._index = newIdx;
    const item = this._list[newIdx];
    this._item = item;
    this._itemCollectionIds = new Set((item.collection_ids || []).map(String));
    this._render();
    this._loadPanelData();
    if (isInternalAttachment(item.url)) {
      const ext = (item.title || '').split('.').pop()?.toLowerCase();
      if (['xls', 'xlsx', 'csv'].includes(ext)) {
        this._fetchExcel(item.url);
      } else if (['doc', 'docx'].includes(ext)) {
        this._fetchWord(item.url);
      } else {
        this._fetchBlob(item.url);
      }
    }
    // Fire event so app can load full item detail (with content field)
    this.dispatchEvent(new CustomEvent('lightbox-navigate', {
      bubbles: true, composed: true,
      detail: { itemId: item.id },
    }));
  }

  async _fetchBlob(url) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      this._blobUrl = URL.createObjectURL(blob);
      this._render();
      this._loadPanelData();
    } catch (err) {
      console.error('Failed to fetch media blob', err);
    }
  }

  async _fetchExcel(url) {
    this._loadingOffice = true;
    this._render();
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      const buffer = await res.arrayBuffer();
      const XLSX = (await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')).default;
      const wb = XLSX.read(buffer);
      let html = '';
      for (const name of wb.SheetNames) {
        html += `<div class="sheet-tab-label">${name}</div>`;
        html += XLSX.utils.sheet_to_html(wb.Sheets[name]);
      }
      this._officeHtml = html;
    } catch (err) {
      console.error('Excel preview failed', err);
      this._officeHtml = null;
    }
    this._loadingOffice = false;
    this._render();
    this._loadPanelData();
  }

  async _fetchWord(url) {
    this._loadingOffice = true;
    this._render();
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      const buffer = await res.arrayBuffer();
      const mammoth = await import('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm');
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      this._officeHtml = result.value;
    } catch (err) {
      console.error('Word preview failed', err);
      this._officeHtml = null;
    }
    this._loadingOffice = false;
    this._render();
    this._loadPanelData();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async _loadPanelData() {
    try {
      const [collections, tags] = await Promise.all([
        getCollections().catch(() => []),
        getTags().catch(() => []),
      ]);
      this._collections = collections;
      this._allTags = tags;
      this._renderCollections();
      const tagEl = this.shadow.getElementById('tag-input');
      if (tagEl) tagEl.allTags = tags;
    } catch { /* ignore */ }
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  _handleKey(e) {
    if (!this._open) return;
    if (e.key === 'Escape') { this.close(); return; }
    if (e.key === 'ArrowLeft') { this._navigate(-1); return; }
    if (e.key === 'ArrowRight') { this._navigate(1); return; }
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  _handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'close') { this.close(); return; }
    if (action === 'prev') { this._navigate(-1); return; }
    if (action === 'next') { this._navigate(1); return; }
    if (action === 'toggle-panel') {
      this._panelOpen = !this._panelOpen;
      this._render();
      this._loadPanelData();
      return;
    }

    if (action === 'open-url' && this._item?.url) {
      window.open(this._item.url, '_blank', 'noopener');
      return;
    }

    if (action === 'favourite') {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'favourite', itemId: this._item?.id },
      }));
      return;
    }

    if (action === 'delete') {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'delete', itemId: this._item?.id },
      }));
      return;
    }

    // Collection chip
    const colChip = e.target.closest('[data-col-id]');
    if (colChip) { this._toggleCollection(colChip.dataset.colId); return; }

    // Rating star
    const star = e.target.closest('[data-rating]');
    if (star) {
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'update-rating', itemId: this._item?.id, rating: parseInt(star.dataset.rating) },
      }));
      return;
    }

    // Tag events are handled via tag-add/tag-remove from ui-tag-input
  }

  // ── Collection toggle ──────────────────────────────────────────────────────

  async _toggleCollection(collectionId) {
    if (!this._item) return;
    try {
      if (this._itemCollectionIds.has(collectionId)) {
        await removeFromCollection(collectionId, this._item.id);
        this._itemCollectionIds.delete(collectionId);
      } else {
        await addToCollection(collectionId, this._item.id);
        this._itemCollectionIds.add(collectionId);
      }
      this._renderCollections();
      this.dispatchEvent(new CustomEvent('detail-action', {
        bubbles: true, composed: true,
        detail: { action: 'collections-changed', itemId: this._item.id },
      }));
    } catch (err) {
      console.error('Failed to toggle collection', err);
    }
  }

  _renderCollections() {
    const container = this.shadow.getElementById('lb-collection-chips');
    if (!container || !this._collections.length) return;
    container.innerHTML = this._collections.map(c => `
      <button class="collection-chip ${this._itemCollectionIds.has(c.id) ? 'in-collection' : ''}"
              data-col-id="${c.id}">
        ${esc(c.name)}
      </button>
    `).join('');
  }

  // ── Content rendering ──────────────────────────────────────────────────────

  _getMediaUrl() {
    // Use blob URL for internal attachments, raw URL for external
    if (isInternalAttachment(this._item?.url)) {
      return this._blobUrl; // null while loading
    }
    return this._item?.url;
  }

  _getContentHtml() {
    const item = this._item;
    const type = detectContentType(item);
    const mediaUrl = this._getMediaUrl();

    // For internal attachments, show loading while blob is being fetched
    // (skip for Excel/Word/CSV — they use _fetchExcel/_fetchWord with their own loading state)
    if (isInternalAttachment(item.url) && !mediaUrl && type !== 'document') {
      return `<div class="loading-text">Loading media…</div>`;
    }

    switch (type) {
      case 'youtube': {
        const id = getYouTubeId(item.url);
        return `<iframe class="video-embed" src="https://www.youtube.com/embed/${id}?autoplay=0&rel=0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
      }

      case 'vimeo': {
        const id = getVimeoId(item.url);
        return `<iframe class="video-embed" src="https://player.vimeo.com/video/${id}" allowfullscreen></iframe>`;
      }

      case 'image':
        return `<img src="${escAttr(mediaUrl)}" alt="${escAttr(item.title)}" />`;

      case 'video':
        return `<video controls src="${escAttr(mediaUrl)}"></video>`;

      case 'audio':
        return `
          <div class="audio-player">
            ${item.thumbnail_url ? `<img class="audio-art" src="${escAttr(item.thumbnail_url)}" alt="" />` : `<div class="audio-art-placeholder">${icon('music', 48)}</div>`}
            <div class="audio-title">${esc(item.title)}</div>
            ${item.author ? `<div class="audio-author">${esc(item.author)}</div>` : ''}
            <audio controls src="${escAttr(mediaUrl)}"></audio>
          </div>`;

      case 'document': {
        const title = item.title || '';
        const ext = title.split('.').pop()?.toLowerCase();
        if (ext === 'pdf' && mediaUrl) {
          return `<iframe class="doc-embed" src="${escAttr(mediaUrl)}" title="${escAttr(title)}"></iframe>`;
        }
        if (['xls','xlsx','csv'].includes(ext)) {
          if (this._loadingOffice) return `<div class="loading-text">Loading preview…</div>`;
          if (this._officeHtml) return `<div class="office-preview">${this._officeHtml}</div>`;
          return `
            <div class="article-card">
              <div style="font-size:48px;opacity:0.3;margin-bottom:12px">${icon('file-text', 48)}</div>
              <h2 class="article-title">${esc(title)}</h2>
              ${mediaUrl ? `<a class="article-open-btn" href="${escAttr(mediaUrl)}" download="${escAttr(title)}">${icon('download', 16)} Download</a>` : ''}
            </div>`;
        }
        if (['doc','docx'].includes(ext)) {
          if (this._loadingOffice) return `<div class="loading-text">Loading preview…</div>`;
          if (this._officeHtml) return `<div class="office-preview">${this._officeHtml}</div>`;
          return `
            <div class="article-card">
              <div style="font-size:48px;opacity:0.3;margin-bottom:12px">${icon('file-text', 48)}</div>
              <h2 class="article-title">${esc(title)}</h2>
              ${mediaUrl ? `<a class="article-open-btn" href="${escAttr(mediaUrl)}" download="${escAttr(title)}">${icon('download', 16)} Download</a>` : ''}
            </div>`;
        }
        if (['ppt','pptx'].includes(ext)) {
          return `
            <div class="article-card">
              <div style="font-size:48px;opacity:0.3;margin-bottom:12px">${icon('file-text', 48)}</div>
              <h2 class="article-title">${esc(title)}</h2>
              <div class="article-source">Preview not available for this file type</div>
              ${mediaUrl ? `<a class="article-open-btn" href="${escAttr(mediaUrl)}" download="${escAttr(title)}">${icon('download', 16)} Download</a>` : ''}
            </div>`;
        }
        // Fallback
        return `
          <div class="article-card">
            <div style="font-size:48px;opacity:0.3;margin-bottom:12px">${icon('file', 48)}</div>
            <h2 class="article-title">${esc(title)}</h2>
            ${mediaUrl ? `<a class="article-open-btn" href="${escAttr(mediaUrl)}" download="${escAttr(title)}">${icon('download', 16)} Download</a>` : ''}
          </div>`;
      }

      case 'richtext': {
        const html = tiptapToHtml(item.content);
        return `<div class="reading-pane">${html}</div>`;
      }

      case 'article':
      default:
        return `
          <div class="article-card">
            ${item.thumbnail_url ? `<img class="article-img" src="${escAttr(item.thumbnail_url)}" alt="" onerror="this.style.display='none'" />` : ''}
            <h2 class="article-title">${esc(item.title)}</h2>
            ${item.site_name || item.source ? `<div class="article-source">${esc(item.site_name || item.source)}</div>` : ''}
            ${item.author ? `<div class="article-author">${icon('user', 12)} ${esc(item.author)}</div>` : ''}
            ${item.preview_text ? `<div class="article-preview">${esc(item.preview_text)}</div>` : ''}
            ${item.url ? `<button class="article-open-btn" data-action="open-url">${icon('external-link', 16)} Open in Browser</button>` : ''}
          </div>`;
    }
  }

  // ── Panel HTML ─────────────────────────────────────────────────────────────

  _getPanelHtml() {
    const it = this._item;
    return `
      <div class="panel-header">
        <span class="panel-title">Details</span>
        <button class="panel-close-btn" data-action="toggle-panel">${icon('x', 14)}</button>
      </div>
      <div class="panel-body">
        <div class="panel-item-title">${esc(it.title)}</div>

        ${it.url ? `<a class="panel-url" href="${escAttr(it.url)}" target="_blank" rel="noopener">
          ${icon('external-link', 12)} ${esc(this._shortenUrl(it.url))}
        </a>` : ''}

        ${it.preview_text ? `<div class="panel-preview">${esc(it.preview_text)}</div>` : ''}

        <div class="panel-field">
          <div class="panel-field-label">Collections</div>
          <div class="collection-chips" id="lb-collection-chips"></div>
        </div>

        <div class="panel-field">
          <div class="panel-field-label">Rating</div>
          <div class="rating-stars">
            ${[1,2,3,4,5].map(n => `
              <button class="star-btn ${it.rating >= n ? 'filled' : ''}" data-rating="${n}">
                ${icon('star', 18)}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="panel-field">
          <div class="panel-field-label">Tags</div>
          <ui-tag-input id="tag-input"></ui-tag-input>
        </div>

        <div class="panel-field">
          <div class="panel-field-label">Info</div>
          <div class="panel-meta">
            ${it.source ? `<div class="meta-row">${icon('globe', 11)} ${esc(it.source)}</div>` : ''}
            ${it.author ? `<div class="meta-row">${icon('user', 11)} ${esc(it.author)}</div>` : ''}
            ${it.reading_time_min ? `<div class="meta-row">${icon('clock', 11)} ${it.reading_time_min} min read</div>` : ''}
            ${it.word_count ? `<div class="meta-row">${icon('file-text', 11)} ${it.word_count.toLocaleString()} words</div>` : ''}
            <div class="meta-row">${icon('calendar', 11)} Added ${new Date(it.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <button class="delete-btn" data-action="delete">Delete item</button>
      </div>
    `;
  }

  // ── Main render ────────────────────────────────────────────────────────────

  _render() {
    if (!this._open || !this._item) {
      this.shadow.innerHTML = '';
      return;
    }

    const it = this._item;
    const hasPrev = this._index > 0;
    const hasNext = this._index < this._list.length - 1 && this._list.length > 1;

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }

        .overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.92);
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ── Header ── */
        .header {
          height: 56px;
          flex-shrink: 0;
          background: #1f1f1f;
          color: #fff;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .header-icon { display: flex; align-items: center; color: rgba(255,255,255,0.5); flex-shrink: 0; }
        .header-name {
          flex: 1; font-size: 14px; font-weight: 500; color: #fff;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
        }
        .header-type {
          font-size: 11px; color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.08); padding: 2px 8px;
          border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        .header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .hdr-btn {
          background: transparent; color: rgba(255,255,255,0.8); border: none;
          cursor: pointer; padding: 8px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          line-height: 1; transition: background 0.1s;
        }
        .hdr-btn:hover { background: rgba(255,255,255,0.12); }
        .hdr-btn.fav-active { color: #f59e0b; }
        .hdr-btn.close-btn { color: rgba(255,255,255,0.6); }
        .hdr-btn.panel-active { background: rgba(255,255,255,0.15); color: #fff; }
        .hdr-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.15); margin: 0 4px; }

        /* ── Body ── */
        .body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

        /* ── Content area ── */
        .content {
          flex: 1; display: flex; align-items: center; justify-content: center;
          overflow: auto; position: relative; min-height: 0; min-width: 0;
        }

        .loading-text {
          color: rgba(255,255,255,0.5); font-size: 14px;
        }

        .content img {
          max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 4px;
        }

        .content video { max-width: 90%; border-radius: 8px; outline: none; }

        .doc-embed {
          width: 80%; height: 100%; border: none; background: white; border-radius: 4px;
        }

        .video-embed {
          width: 80%; aspect-ratio: 16/9; border: none; border-radius: 8px;
          max-height: 85%;
        }

        /* ── Audio player ── */
        .audio-player {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 40px; text-align: center; max-width: 400px;
        }
        .audio-art {
          width: 200px; height: 200px; object-fit: cover; border-radius: 12px;
        }
        .audio-art-placeholder {
          width: 200px; height: 200px; border-radius: 12px;
          background: rgba(255,255,255,0.06); display: flex;
          align-items: center; justify-content: center;
          color: rgba(255,255,255,0.2);
        }
        .audio-title { font-size: 18px; font-weight: 600; color: #fff; }
        .audio-author { font-size: 14px; color: rgba(255,255,255,0.5); }
        .audio-player audio { width: 320px; }

        /* ── Reading pane (richtext) ── */
        .reading-pane {
          max-width: 700px; width: 90%; max-height: 90%; padding: 40px;
          background: #fff; color: #1e293b; border-radius: 8px;
          overflow: auto; box-sizing: border-box;
          font-size: 15px; line-height: 1.7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .reading-pane h1 { font-size: 24px; margin: 20px 0 10px; }
        .reading-pane h2 { font-size: 20px; margin: 18px 0 8px; }
        .reading-pane h3 { font-size: 17px; margin: 16px 0 6px; }
        .reading-pane p { margin: 8px 0; }
        .reading-pane ul, .reading-pane ol { margin: 8px 0; padding-left: 24px; }
        .reading-pane blockquote {
          border-left: 3px solid #cbd5e1; margin: 12px 0; padding: 8px 16px;
          color: #475569; font-style: italic;
        }
        .reading-pane pre {
          background: #f1f5f9; border-radius: 6px; padding: 16px;
          overflow-x: auto; font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 13px;
        }
        .reading-pane code {
          background: #f1f5f9; padding: 2px 5px; border-radius: 3px;
          font-size: 0.9em;
        }
        .reading-pane pre code { background: none; padding: 0; }
        .reading-pane a { color: #3b82f6; }
        .reading-pane hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }

        /* ── Office preview (Excel / Word) ── */
        .office-preview {
          max-width: 1000px; width: 95%; max-height: 92%; padding: 24px;
          background: #fff; color: #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px; line-height: 1.5; border-radius: 8px;
          overflow: auto; box-sizing: border-box;
        }
        .office-preview table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        .office-preview th, .office-preview td {
          border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 12px;
        }
        .office-preview th { background: #f8fafc; font-weight: 600; color: #475569; }
        .sheet-tab-label {
          font-size: 12px; font-weight: 600; color: #64748b;
          padding: 8px 0 4px; border-bottom: 2px solid #3b82f6;
          margin-bottom: 8px; display: inline-block;
        }
        .office-preview h1 { font-size: 22px; margin: 16px 0 8px; }
        .office-preview h2 { font-size: 18px; margin: 14px 0 6px; }
        .office-preview h3 { font-size: 15px; margin: 12px 0 4px; }
        .office-preview p { margin: 8px 0; line-height: 1.6; }
        .office-preview ul, .office-preview ol { margin: 8px 0; padding-left: 24px; }
        .office-preview img { max-width: 100%; }

        /* ── Article card ── */
        .article-card {
          background: #fff; border-radius: 12px; padding: 40px;
          max-width: 500px; width: 90%; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .article-img {
          width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px;
        }
        .article-title { font-size: 20px; font-weight: 600; color: #1e293b; line-height: 1.3; }
        .article-source { font-size: 13px; color: #64748b; }
        .article-author { font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .article-preview {
          font-size: 14px; color: #475569; line-height: 1.6; text-align: left;
          max-height: 160px; overflow: hidden;
        }
        .article-open-btn {
          display: inline-flex; align-items: center; gap: 8px;
          margin-top: 8px; padding: 12px 24px;
          background: var(--pos-color-action-primary, #3b82f6); color: white;
          border: none; border-radius: 8px; font-size: 14px; font-family: inherit;
          font-weight: 500; cursor: pointer;
        }
        .article-open-btn:hover { opacity: 0.9; }

        /* ── Nav arrows ── */
        .nav-btn {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(255,255,255,0.1); color: white;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; z-index: 10;
        }
        .nav-btn:hover { background: rgba(255,255,255,0.22); }
        .nav-btn.prev { left: 16px; }
        .nav-btn.next { right: 16px; }

        /* ── Info panel ── */
        .info-panel {
          width: 320px; flex-shrink: 0; background: #fff;
          border-left: 1px solid #e2e8f0;
          display: flex; flex-direction: column; overflow: hidden;
          transition: width 0.2s ease;
        }
        .info-panel.hidden { width: 0; border-left: none; overflow: hidden; }

        .panel-header {
          height: 48px; display: flex; align-items: center;
          padding: 0 16px; border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0; gap: 8px;
        }
        .panel-title { flex: 1; font-size: 13px; font-weight: 600; color: #1e293b; }
        .panel-close-btn {
          background: transparent; border: none; cursor: pointer;
          padding: 4px; border-radius: 4px; color: #64748b; display: flex; align-items: center;
        }
        .panel-close-btn:hover { background: #f1f5f9; color: #1e293b; }

        .panel-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 16px;
        }

        .panel-item-title {
          font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.4;
        }
        .panel-url {
          display: flex; align-items: center; gap: 4px;
          color: #3b82f6; font-size: 12px; text-decoration: none; word-break: break-all;
        }
        .panel-url:hover { text-decoration: underline; }
        .panel-preview {
          font-size: 13px; color: #475569; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
        }

        .panel-field { }
        .panel-field-label {
          font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;
        }

        .collection-chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .collection-chip {
          padding: 4px 10px; border-radius: 99px;
          border: 1px solid #e2e8f0; background: transparent;
          color: #64748b; font-size: 11px; font-family: inherit;
          cursor: pointer; white-space: nowrap; transition: all 0.1s;
        }
        .collection-chip:hover { border-color: #3b82f6; color: #3b82f6; }
        .collection-chip.in-collection {
          background: #3b82f6; color: white; border-color: #3b82f6;
        }

        .rating-stars { display: flex; gap: 2px; }
        .star-btn {
          background: none; border: none; cursor: pointer; padding: 2px;
          color: #e2e8f0;
        }
        .star-btn.filled { color: #f59e0b; }
        .star-btn:hover { color: #f59e0b; }

        .panel-meta { font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; align-items: center; gap: 6px; }

        .delete-btn {
          width: 100%; padding: 8px; border: 1px solid #e2e8f0;
          border-radius: 6px; background: transparent; color: #ef4444;
          font-size: 13px; font-family: inherit; cursor: pointer;
        }
        .delete-btn:hover { background: #ef4444; color: white; border-color: #ef4444; }

        @media (max-width: 768px) {
          .info-panel {
            position: fixed;
            top: 48px;
            right: 0;
            bottom: 0;
            width: 280px;
            transform: translateX(100%);
            transition: transform 0.2s ease;
            z-index: 2001;
          }
          .info-panel:not(.hidden) {
            transform: translateX(0);
          }
          .nav-btn { display: none; }
        }
      </style>

      <div class="overlay">
        <div class="header">
          <span class="header-icon">${icon('layers', 18)}</span>
          <span class="header-name">${esc(it.title)}</span>
          <span class="header-type">${esc(it.item_type || 'url')}</span>
          <div class="header-actions">
            ${it.url ? `<button class="hdr-btn" data-action="open-url" title="Open URL">${icon('external-link', 16)}</button>` : ''}
            <button class="hdr-btn ${it.is_favourite ? 'fav-active' : ''}" data-action="favourite" title="${it.is_favourite ? 'Unfavourite' : 'Favourite'}">${icon('star', 16)}</button>
            <button class="hdr-btn ${this._panelOpen ? 'panel-active' : ''}" data-action="toggle-panel" title="Toggle details">${icon('sidebar', 16)}</button>
            <div class="hdr-sep"></div>
            <button class="hdr-btn close-btn" data-action="close" title="Close">${icon('x', 18)}</button>
          </div>
        </div>

        <div class="body">
          <div class="content">
            ${hasPrev ? `<button class="nav-btn prev" data-action="prev">${icon('chevron-left', 22)}</button>` : ''}
            ${this._getContentHtml()}
            ${hasNext ? `<button class="nav-btn next" data-action="next">${icon('chevron-right', 22)}</button>` : ''}
          </div>
          <div class="info-panel ${this._panelOpen ? '' : 'hidden'}">
            ${this._panelOpen ? this._getPanelHtml() : ''}
          </div>
        </div>
      </div>
    `;

    // Wire up tag component after render
    if (this._panelOpen) {
      const tagEl = this.shadow.getElementById('tag-input');
      if (tagEl) {
        tagEl.tags = it.tags || [];
        tagEl.allTags = this._allTags;
      }
    }
  }

  _shortenUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname.length > 30 ? u.pathname.substring(0, 30) + '\u2026' : u.pathname);
    } catch {
      return url.length > 50 ? url.substring(0, 50) + '\u2026' : url;
    }
  }
}

customElements.define('pos-kb-lightbox', PosKBLightbox);
