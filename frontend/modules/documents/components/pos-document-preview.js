// pos-document-preview — full-screen overlay for previewing documents
// Supports: PDF (iframe), images, text/json/csv/markdown (fetched), video, audio
// Falls back to a "not supported" card with download CTA for other types
// Right info panel: metadata, editable description, threaded comments

import { deleteDocument, updateDocument, getComments, createComment, updateComment, deleteComment } from '../services/documents-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import { icon, fileTypeIcon } from '../../../shared/utils/icons.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';

const TAG = 'pos-document-preview';

const FAVOURITES_KEY = 'pos-doc-favourites';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60)   return 'just now';
  if (diffMin < 60)   return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr  < 24)   return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7)    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImage(ct) { return ct && /^image\//.test(ct); }
function isPdf(ct)   { return ct && ct.includes('pdf'); }
function isText(ct)  { return ct && (ct.startsWith('text/') || ct === 'application/json' || ct === 'application/xml'); }
function isVideo(ct) { return ct && ct.startsWith('video/'); }
function isAudio(ct) { return ct && ct.startsWith('audio/'); }
function isExcel(ct) {
  return ct && (ct.includes('spreadsheet') || ct.includes('excel') || ct === 'text/csv'
    || ct === 'application/vnd.ms-excel'
    || ct === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function isWord(ct) {
  return ct && (ct.includes('wordprocessingml') || ct === 'application/msword'
    || ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

class PosDocumentPreview extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._doc = null;
    this._list = [];
    this._index = -1;
    this._textContent = null;
    this._loadingText = false;
    this._open = false;
    this._blobUrl = null;
    this._loadingBlob = false;
    this._officeHtml = null;
    this._loadingOffice = false;

    // Info panel state
    this._panelOpen = true;
    this._comments = [];
    this._loadingComments = false;
    this._submittingComment = false;
    this._editingCommentId = null;
    this._descEditing = false;
    this._descValue = '';
    this._descSaving = false;
  }

  connectedCallback() {
    // Event delegation once on shadow root — not in render
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('input', (e) => this._handleInput(e));
    this.shadow.addEventListener('keydown', (e) => this._handleShadowKey(e));
    this._keyHandler = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open(doc, documentList = []) {
    // Revoke previous blob URL to avoid memory leaks
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }

    this._doc = doc;
    this._list = documentList;
    this._index = documentList.findIndex(d => d.id === doc.id);
    this._textContent = null;
    this._loadingText = false;
    this._loadingBlob = false;
    this._blobUrl = null;
    this._officeHtml = null;
    this._loadingOffice = false;
    this._open = true;
    // Reset info panel data for new doc
    this._comments = [];
    this._loadingComments = false;
    this._submittingComment = false;
    this._editingCommentId = null;
    this._descEditing = false;
    this._descValue = doc.description || '';
    this._descSaving = false;
    document.body.style.overflow = 'hidden';
    this._render();

    if (doc.attachment_id) {
      if (isText(doc.content_type)) {
        this._fetchText(doc.attachment_id);
      } else if (isExcel(doc.content_type)) {
        this._fetchExcel(doc.attachment_id);
      } else if (isWord(doc.content_type)) {
        this._fetchWord(doc.attachment_id);
      } else if (isPdf(doc.content_type) || isImage(doc.content_type) || isVideo(doc.content_type) || isAudio(doc.content_type)) {
        this._fetchBlob(doc.attachment_id);
      }
    }

    this._loadComments();
  }

  close() {
    this._open = false;
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }
    document.body.style.overflow = '';
    this._render();
    this.dispatchEvent(new CustomEvent('preview-closed', { bubbles: true, composed: true }));
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _getFavourites() {
    try { return JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]'); }
    catch { return []; }
  }

  _isFavourite(docId) {
    return this._getFavourites().includes(docId);
  }

  async _fetchText(attachmentId) {
    this._loadingText = true;
    this._renderContent();
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      this._textContent = await res.text();
    } catch {
      this._textContent = '(Failed to load file content)';
    }
    this._loadingText = false;
    this._renderContent();
  }

  async _downloadWithAuth(attachmentId, filename) {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download file');
    }
  }

  async _fetchBlob(attachmentId) {
    this._loadingBlob = true;
    this._renderContent();
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      this._blobUrl = URL.createObjectURL(blob);
    } catch {
      this._blobUrl = null;
    }
    this._loadingBlob = false;
    this._renderContent();
  }

  async _fetchExcel(attachmentId) {
    this._loadingOffice = true;
    this._renderContent();
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const buf = await res.arrayBuffer();
      // Dynamic import SheetJS from CDN
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
      const wb = XLSX.read(buf, { type: 'array' });
      // Build HTML with sheet tabs
      const sheetNames = wb.SheetNames;
      let html = '';
      for (const name of sheetNames) {
        const ws = wb.Sheets[name];
        const tableHtml = XLSX.utils.sheet_to_html(ws, { editable: false });
        html += `<div class="sheet-tab-label">${esc(name)}</div>${tableHtml}`;
      }
      this._officeHtml = html;
    } catch (err) {
      console.error('Excel preview failed:', err);
      this._officeHtml = null;
    }
    this._loadingOffice = false;
    this._renderContent();
  }

  async _fetchWord(attachmentId) {
    this._loadingOffice = true;
    this._renderContent();
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const buf = await res.arrayBuffer();
      // Dynamic import mammoth from CDN
      const mammoth = await import('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm');
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      this._officeHtml = result.value;
    } catch (err) {
      console.error('Word preview failed:', err);
      this._officeHtml = null;
    }
    this._loadingOffice = false;
    this._renderContent();
  }

  async _loadComments() {
    if (!this._doc) return;
    this._loadingComments = true;
    this._renderPanel();
    try {
      this._comments = await getComments(this._doc.id);
    } catch {
      this._comments = [];
    }
    this._loadingComments = false;
    this._renderPanel();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    if (!this._open) {
      this.shadow.innerHTML = '';
      return;
    }

    const doc = this._doc;
    const isFav = this._isFavourite(doc.id);
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

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

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
        .header-icon {
          display: flex;
          align-items: center;
          color: rgba(255,255,255,0.5);
          flex-shrink: 0;
        }
        .header-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .hdr-btn {
          background: transparent;
          color: rgba(255,255,255,0.8);
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          transition: background 0.1s;
        }
        .hdr-btn:hover { background: rgba(255,255,255,0.12); }
        .hdr-btn.fav-active { color: #f59e0b; }
        .hdr-btn.close-btn { color: rgba(255,255,255,0.6); }
        .hdr-btn.delete-btn:hover { color: #ef4444; }
        .hdr-btn.panel-btn-active { background: rgba(255,255,255,0.15); color: #fff; }
        .hdr-sep {
          width: 1px;
          height: 20px;
          background: rgba(255,255,255,0.15);
          margin: 0 4px;
        }

        /* ── Body (content + panel) ── */
        .body {
          flex: 1;
          display: flex;
          min-height: 0;
          overflow: hidden;
        }

        /* ── Content area ── */
        .content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          position: relative;
          min-height: 0;
          min-width: 0;
        }

        .content iframe {
          width: 80%;
          height: 100%;
          border: none;
          background: white;
          display: block;
        }

        .content img {
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
          border-radius: 4px;
        }

        .content video,
        .content audio {
          max-width: 90%;
          border-radius: 8px;
          outline: none;
        }

        .text-pre {
          max-width: 800px;
          width: 90%;
          max-height: 90%;
          padding: 24px;
          background: #fff;
          color: #333;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.6;
          border-radius: 8px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
          box-sizing: border-box;
        }

        /* Office document preview (Excel tables, Word HTML) */
        .office-preview {
          max-width: 1000px;
          width: 95%;
          max-height: 92%;
          padding: 24px;
          background: #fff;
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px;
          line-height: 1.5;
          border-radius: 8px;
          overflow: auto;
          box-sizing: border-box;
        }
        .office-preview table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
        }
        .office-preview th,
        .office-preview td {
          border: 1px solid #e2e8f0;
          padding: 6px 10px;
          text-align: left;
          font-size: 12px;
          white-space: nowrap;
        }
        .office-preview th {
          background: #f8fafc;
          font-weight: 600;
          color: #475569;
        }
        .office-preview tr:hover td {
          background: #f8fafc;
        }
        .sheet-tab-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          padding: 8px 0 4px;
          border-bottom: 2px solid #3b82f6;
          margin-bottom: 8px;
          display: inline-block;
        }
        /* Word document styles */
        .office-preview h1 { font-size: 22px; margin: 16px 0 8px; }
        .office-preview h2 { font-size: 18px; margin: 14px 0 6px; }
        .office-preview h3 { font-size: 15px; margin: 12px 0 4px; }
        .office-preview p { margin: 8px 0; line-height: 1.6; }
        .office-preview ul, .office-preview ol { margin: 8px 0; padding-left: 24px; }
        .office-preview img { max-width: 100%; }

        .loading-text {
          color: rgba(255,255,255,0.5);
          font-size: 14px;
        }

        /* Unsupported card */
        .unsupported-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .unsupported-icon { color: #94a3b8; }
        .unsupported-name { font-size: 15px; font-weight: 600; color: #1e293b; word-break: break-all; }
        .unsupported-meta { font-size: 12px; color: #64748b; }
        .unsupported-note { font-size: 13px; color: #64748b; margin: 4px 0; }
        .unsupported-dl {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 10px 20px;
          background: var(--pos-color-action-primary, #3b82f6);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          font-weight: 500;
        }
        .unsupported-dl:hover { opacity: 0.9; }

        /* ── Nav arrows ── */
        .nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          z-index: 10;
        }
        .nav-btn:hover { background: rgba(255,255,255,0.22); }
        .nav-btn.prev { left: 16px; }
        .nav-btn.next { right: 16px; }

        /* ── Info panel ── */
        .info-panel {
          width: 320px;
          flex-shrink: 0;
          background: #fff;
          border-left: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform: translateX(0);
          transition: width 0.2s ease;
        }
        .info-panel.hidden {
          width: 0;
          border-left: none;
          overflow: hidden;
        }

        .panel-header {
          height: 48px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
          gap: 8px;
        }
        .panel-title {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }
        .panel-close-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: #64748b;
          display: flex;
          align-items: center;
        }
        .panel-close-btn:hover { background: #f1f5f9; color: #1e293b; }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Details section ── */
        .section-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .meta-row {
          display: flex;
          gap: 8px;
          font-size: 12px;
          margin-bottom: 6px;
          align-items: flex-start;
        }
        .meta-label { color: #64748b; flex-shrink: 0; min-width: 60px; }
        .meta-value { color: #1e293b; word-break: break-all; }

        /* ── Description section ── */
        .desc-display {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid transparent;
          min-height: 32px;
        }
        .desc-display:hover { border-color: #e2e8f0; background: #f8fafc; }
        .desc-placeholder { color: #94a3b8; font-style: italic; }

        .desc-edit-area {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border: 1px solid #3b82f6;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          color: #1e293b;
          resize: vertical;
          min-height: 80px;
          outline: none;
          line-height: 1.5;
        }

        .desc-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
        .btn-sm {
          padding: 5px 12px;
          border-radius: 5px;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          border: none;
          font-weight: 500;
        }
        .btn-primary {
          background: #3b82f6;
          color: #fff;
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-primary:disabled { opacity: 0.5; cursor: default; }
        .btn-ghost {
          background: transparent;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }
        .btn-ghost:hover { background: #f1f5f9; }

        /* ── Comments section ── */
        .comments-loading {
          font-size: 13px;
          color: #94a3b8;
          text-align: center;
          padding: 16px 0;
        }
        .comments-empty {
          font-size: 13px;
          color: #94a3b8;
          text-align: center;
          padding: 16px 0;
          font-style: italic;
        }

        .comment-item {
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
          position: relative;
        }
        .comment-item:last-child { border-bottom: none; }

        .comment-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .comment-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #3b82f6;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .comment-author {
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          flex: 1;
        }
        .comment-time {
          font-size: 11px;
          color: #94a3b8;
        }
        .comment-menu-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          color: #94a3b8;
          display: none;
          align-items: center;
        }
        .comment-item:hover .comment-menu-btn { display: flex; }
        .comment-menu-btn:hover { background: #f1f5f9; color: #475569; }

        .comment-body {
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
          padding-left: 32px;
        }

        .comment-edit-area {
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          border: 1px solid #3b82f6;
          border-radius: 5px;
          font-size: 13px;
          font-family: inherit;
          color: #1e293b;
          resize: vertical;
          min-height: 60px;
          outline: none;
          margin-top: 4px;
          margin-left: 32px;
          width: calc(100% - 32px);
        }

        .comment-edit-actions {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          padding-left: 32px;
        }

        /* Comment dropdown menu */
        .comment-dropdown {
          position: absolute;
          right: 0;
          top: 28px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          z-index: 100;
          min-width: 110px;
          overflow: hidden;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: #374151;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          font-family: inherit;
        }
        .dropdown-item:hover { background: #f8fafc; }
        .dropdown-item.danger { color: #ef4444; }
        .dropdown-item.danger:hover { background: #fef2f2; }

        /* ── Add comment ── */
        .add-comment-area {
          margin-top: 8px;
        }
        .add-comment-textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          color: #1e293b;
          resize: vertical;
          min-height: 68px;
          outline: none;
          transition: border-color 0.15s;
        }
        .add-comment-textarea:focus { border-color: #3b82f6; }
        .add-comment-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 6px;
        }
        .post-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          background: #3b82f6;
          color: #fff;
          border: none;
          font-size: 13px;
          font-family: inherit;
          font-weight: 500;
          cursor: pointer;
        }
        .post-btn:hover { background: #2563eb; }
        .post-btn:disabled { opacity: 0.5; cursor: default; }

        .divider {
          height: 1px;
          background: #f1f5f9;
          margin: 0 -16px;
        }
      </style>

      <div class="overlay" data-role="overlay">

        <!-- Header -->
        <div class="header">
          <span class="header-icon">${fileTypeIcon(doc.content_type, 18)}</span>
          <span class="header-name" title="${esc(doc.name)}">${esc(doc.name)}</span>
          <div class="header-actions">
            <button class="hdr-btn" data-action="download" title="Download">
              ${icon('download', 16)}
            </button>
            <button class="hdr-btn${this._isFavourite(doc.id) ? ' fav-active' : ''}" data-action="toggle-fav" title="${this._isFavourite(doc.id) ? 'Remove from favourites' : 'Add to favourites'}">
              ${icon('star', 16)}
            </button>
            <span class="hdr-sep"></span>
            <button class="hdr-btn${this._panelOpen ? ' panel-btn-active' : ''}" data-action="toggle-panel" title="Details & Comments">
              ${icon('panel-right', 16)}
            </button>
            <span class="hdr-sep"></span>
            <button class="hdr-btn delete-btn" data-action="delete" title="Delete">
              ${icon('trash-2', 16)}
            </button>
            <button class="hdr-btn close-btn" data-action="close" title="Close (Esc)">
              ${icon('x', 18)}
            </button>
          </div>
        </div>

        <!-- Body: content + info panel -->
        <div class="body">

          <!-- Content -->
          <div class="content" data-role="content">
            ${this._renderContentHtml(doc)}

            ${this._index > 0 ? `<button class="nav-btn prev" data-action="prev" title="Previous">${icon('chevron-left', 20)}</button>` : ''}
            ${this._index < this._list.length - 1 && this._list.length > 1 ? `<button class="nav-btn next" data-action="next" title="Next">${icon('chevron-right', 20)}</button>` : ''}
          </div>

          <!-- Info panel -->
          <div class="info-panel${this._panelOpen ? '' : ' hidden'}" data-role="info-panel">
            ${this._renderPanelHtml()}
          </div>

        </div>

      </div>
    `;
  }

  _renderPanelHtml() {
    if (!this._doc) return '';
    const doc = this._doc;

    // Details section
    const detailsHtml = `
      <div>
        <div class="section-label">Details</div>
        <div class="meta-row"><span class="meta-label">Name</span><span class="meta-value">${esc(doc.name)}</span></div>
        <div class="meta-row"><span class="meta-label">Type</span><span class="meta-value">${esc(doc.content_type || '—')}</span></div>
        <div class="meta-row"><span class="meta-label">Size</span><span class="meta-value">${formatBytes(doc.file_size)}</span></div>
        <div class="meta-row"><span class="meta-label">Modified</span><span class="meta-value">${formatRelativeTime(doc.updated_at)}</span></div>
      </div>
    `;

    // Description section
    let descHtml;
    if (this._descEditing) {
      descHtml = `
        <div>
          <div class="section-label">Description</div>
          <textarea class="desc-edit-area" data-role="desc-textarea" placeholder="Add a description…">${esc(this._descValue)}</textarea>
          <div class="desc-actions">
            <button class="btn-sm btn-primary" data-action="desc-save"${this._descSaving ? ' disabled' : ''}>${this._descSaving ? 'Saving…' : 'Save'}</button>
            <button class="btn-sm btn-ghost" data-action="desc-cancel">Cancel</button>
          </div>
        </div>
      `;
    } else {
      const hasDesc = doc.description && doc.description.trim();
      descHtml = `
        <div>
          <div class="section-label">Description</div>
          <div class="desc-display" data-action="desc-edit" title="Click to edit">
            ${hasDesc
              ? `<span>${esc(doc.description)}</span>`
              : `<span class="desc-placeholder">Click to add a description…</span>`
            }
          </div>
        </div>
      `;
    }

    // Comments section
    let commentsBodyHtml;
    if (this._loadingComments) {
      commentsBodyHtml = `<div class="comments-loading">Loading…</div>`;
    } else if (this._comments.length === 0) {
      commentsBodyHtml = `<div class="comments-empty">No comments yet</div>`;
    } else {
      commentsBodyHtml = this._comments.map(c => this._renderCommentHtml(c)).join('');
    }

    const commentCount = this._comments.length;
    const commentsHtml = `
      <div>
        <div class="section-label">Comments${commentCount > 0 ? ` (${commentCount})` : ''}</div>
        <div data-role="comments-list">
          ${commentsBodyHtml}
        </div>
        <div class="add-comment-area">
          <textarea class="add-comment-textarea" data-role="new-comment" placeholder="Add a comment…"></textarea>
          <div class="add-comment-footer">
            <button class="post-btn" data-action="post-comment"${this._submittingComment ? ' disabled' : ''}>
              ${icon('send', 13)} ${this._submittingComment ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    `;

    return `
      <div class="panel-header">
        <span class="panel-title">Details</span>
        <button class="panel-close-btn" data-action="toggle-panel" title="Close panel">${icon('x', 14)}</button>
      </div>
      <div class="panel-body">
        ${detailsHtml}
        <div class="divider"></div>
        ${descHtml}
        <div class="divider"></div>
        ${commentsHtml}
      </div>
    `;
  }

  _renderCommentHtml(c) {
    const isEditing = this._editingCommentId === c.id;
    const initial = 'Y'; // "You" since we only have user_id and it's always the current user

    if (isEditing) {
      return `
        <div class="comment-item" data-comment-id="${c.id}">
          <div class="comment-meta">
            <div class="comment-avatar">${initial}</div>
            <span class="comment-author">You</span>
            <span class="comment-time">${formatRelativeTime(c.created_at)}</span>
          </div>
          <textarea class="comment-edit-area" data-role="edit-comment-textarea" data-comment-id="${c.id}">${esc(c.content)}</textarea>
          <div class="comment-edit-actions">
            <button class="btn-sm btn-primary" data-action="comment-save" data-comment-id="${c.id}">Save</button>
            <button class="btn-sm btn-ghost" data-action="comment-cancel-edit" data-comment-id="${c.id}">Cancel</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="comment-item" data-comment-id="${c.id}">
        <div class="comment-meta">
          <div class="comment-avatar">${initial}</div>
          <span class="comment-author">You</span>
          <span class="comment-time">${formatRelativeTime(c.created_at)}</span>
          <button class="comment-menu-btn" data-action="comment-menu" data-comment-id="${c.id}" title="Options">
            ${icon('more-horizontal', 14)}
          </button>
        </div>
        <div class="comment-body">${esc(c.content)}</div>
      </div>
    `;
  }

  // Re-render only the content area (used after text fetch completes)
  _renderContent() {
    if (!this._open) return;
    const contentEl = this.shadow.querySelector('[data-role="content"]');
    if (!contentEl) return;

    contentEl.innerHTML = `
      ${this._renderContentHtml(this._doc)}
      ${this._index > 0 ? `<button class="nav-btn prev" data-action="prev" title="Previous">${icon('chevron-left', 20)}</button>` : ''}
      ${this._index < this._list.length - 1 && this._list.length > 1 ? `<button class="nav-btn next" data-action="next" title="Next">${icon('chevron-right', 20)}</button>` : ''}
    `;
  }

  // Re-render only the info panel (used after comment load/update)
  _renderPanel() {
    if (!this._open) return;
    const panelEl = this.shadow.querySelector('[data-role="info-panel"]');
    if (!panelEl) return;
    panelEl.innerHTML = this._renderPanelHtml();
  }

  _renderContentHtml(doc) {
    if (!doc.attachment_id) {
      return this._unsupportedHtml(doc);
    }

    // For binary types, we need the blob URL (fetched with auth headers)
    if (isPdf(doc.content_type) || isImage(doc.content_type) || isVideo(doc.content_type) || isAudio(doc.content_type)) {
      if (this._loadingBlob) {
        return `<div class="loading-text">Loading preview…</div>`;
      }
      if (!this._blobUrl) {
        return this._unsupportedHtml(doc);
      }

      if (isPdf(doc.content_type)) {
        return `<iframe src="${this._blobUrl}" title="${esc(doc.name)}"></iframe>`;
      }
      if (isImage(doc.content_type)) {
        return `<img src="${this._blobUrl}" alt="${esc(doc.name)}">`;
      }
      if (isVideo(doc.content_type)) {
        return `<video controls src="${this._blobUrl}"></video>`;
      }
      if (isAudio(doc.content_type)) {
        return `<audio controls src="${this._blobUrl}"></audio>`;
      }
    }

    // Office documents (Excel, Word) — rendered as HTML
    if (isExcel(doc.content_type) || isWord(doc.content_type)) {
      if (this._loadingOffice) {
        return `<div class="loading-text">Loading preview…</div>`;
      }
      if (this._officeHtml) {
        return `<div class="office-preview">${this._officeHtml}</div>`;
      }
      return this._unsupportedHtml(doc);
    }

    if (isText(doc.content_type)) {
      if (this._loadingText) {
        return `<div class="loading-text">Loading content…</div>`;
      }
      if (this._textContent !== null) {
        return `<pre class="text-pre">${this._escHtml(this._textContent)}</pre>`;
      }
      return `<div class="loading-text">Loading content…</div>`;
    }

    return this._unsupportedHtml(doc);
  }

  _unsupportedHtml(doc) {
    const url = doc.attachment_id ? `/api/attachments/${doc.attachment_id}/download` : '#';
    return `
      <div class="unsupported-card">
        <div class="unsupported-icon">${fileTypeIcon(doc.content_type, 48)}</div>
        <div class="unsupported-name">${esc(doc.name)}</div>
        <div class="unsupported-meta">${esc(doc.content_type || 'Unknown type')} · ${formatBytes(doc.file_size)}</div>
        <div class="unsupported-note">Preview not available for this file type</div>
        ${doc.attachment_id ? `<button class="unsupported-dl" data-action="download">${icon('download', 14)} Download</button>` : ''}
      </div>
    `;
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  async _handleClick(e) {
    // Close any open dropdown if clicking outside it
    const existingDropdown = this.shadow.querySelector('.comment-dropdown');
    if (existingDropdown && !e.target.closest('.comment-dropdown') && !e.target.closest('[data-action="comment-menu"]')) {
      existingDropdown.remove();
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) {
      if (e.target.dataset.role === 'overlay') this.close();
      return;
    }

    const action = btn.dataset.action;

    if (action === 'close') { this.close(); return; }

    if (action === 'download') {
      if (this._doc?.attachment_id) {
        this._downloadWithAuth(this._doc.attachment_id, this._doc.name);
      }
      return;
    }

    if (action === 'toggle-fav') {
      const favs = this._getFavourites();
      const id = this._doc.id;
      const idx = favs.indexOf(id);
      if (idx === -1) favs.push(id);
      else favs.splice(idx, 1);
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favs));
      const favBtn = this.shadow.querySelector('[data-action="toggle-fav"]');
      if (favBtn) {
        const isNowFav = idx === -1;
        favBtn.classList.toggle('fav-active', isNowFav);
        favBtn.title = isNowFav ? 'Remove from favourites' : 'Add to favourites';
      }
      this.dispatchEvent(new CustomEvent('toggle-favourite', {
        detail: { documentId: this._doc.id }, bubbles: true, composed: true,
      }));
      return;
    }

    if (action === 'toggle-panel') {
      this._panelOpen = !this._panelOpen;
      // Toggle visibility without full re-render
      const panelEl = this.shadow.querySelector('[data-role="info-panel"]');
      const panelBtn = this.shadow.querySelector('[data-action="toggle-panel"]');
      if (panelEl) panelEl.classList.toggle('hidden', !this._panelOpen);
      if (panelBtn) panelBtn.classList.toggle('panel-btn-active', this._panelOpen);

      if (this._panelOpen && this._comments.length === 0 && !this._loadingComments) {
        this._loadComments();
      }
      return;
    }

    if (action === 'delete') {
      if (!await confirmDialog(`Delete "${this._doc.name}"?`, { confirmLabel: 'Delete', danger: true })) return;
      try {
        await deleteDocument(this._doc.id);
        this.close();
        this.dispatchEvent(new CustomEvent('document-deleted', {
          detail: { documentId: this._doc.id }, bubbles: true, composed: true,
        }));
      } catch {
        alert('Failed to delete document');
      }
      return;
    }

    if (action === 'prev') { this._navigate(-1); return; }
    if (action === 'next') { this._navigate(1); return; }

    // Description actions
    if (action === 'desc-edit') {
      this._descEditing = true;
      this._descValue = this._doc.description || '';
      this._renderPanel();
      // Focus the textarea
      const ta = this.shadow.querySelector('[data-role="desc-textarea"]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }

    if (action === 'desc-cancel') {
      this._descEditing = false;
      this._descValue = this._doc.description || '';
      this._renderPanel();
      return;
    }

    if (action === 'desc-save') {
      await this._saveDescription();
      return;
    }

    // Comment actions
    if (action === 'post-comment') {
      await this._postComment();
      return;
    }

    if (action === 'comment-menu') {
      this._showCommentMenu(btn, btn.dataset.commentId);
      return;
    }

    if (action === 'comment-edit') {
      this._editingCommentId = btn.dataset.commentId;
      this._renderPanel();
      const ta = this.shadow.querySelector(`[data-role="edit-comment-textarea"][data-comment-id="${this._editingCommentId}"]`);
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }

    if (action === 'comment-cancel-edit') {
      this._editingCommentId = null;
      this._renderPanel();
      return;
    }

    if (action === 'comment-save') {
      await this._saveCommentEdit(btn.dataset.commentId);
      return;
    }

    if (action === 'comment-delete') {
      await this._deleteComment(btn.dataset.commentId);
      return;
    }
  }

  _handleInput(e) {
    // Track description textarea value as user types (for save button state)
    if (e.target.dataset.role === 'desc-textarea') {
      this._descValue = e.target.value;
    }
  }

  _handleShadowKey(e) {
    // Escape inside description textarea → cancel edit
    if (e.key === 'Escape' && e.target.dataset.role === 'desc-textarea') {
      e.stopPropagation();
      this._descEditing = false;
      this._descValue = this._doc.description || '';
      this._renderPanel();
      return;
    }
    // Escape inside edit-comment textarea → cancel edit
    if (e.key === 'Escape' && e.target.dataset.role === 'edit-comment-textarea') {
      e.stopPropagation();
      this._editingCommentId = null;
      this._renderPanel();
      return;
    }
  }

  _handleKey(e) {
    if (!this._open) return;
    // Don't hijack arrow keys when typing inside the panel
    const active = this.shadow.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;

    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this._navigate(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); this._navigate(1); return; }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async _saveDescription() {
    const ta = this.shadow.querySelector('[data-role="desc-textarea"]');
    const newDesc = ta ? ta.value.trim() : this._descValue.trim();
    this._descSaving = true;
    this._renderPanel();
    try {
      const updated = await updateDocument(this._doc.id, { description: newDesc });
      this._doc = { ...this._doc, description: updated.description };
      this._descEditing = false;
      this._descValue = updated.description || '';
      this._descSaving = false;
      this._renderPanel();
      // Notify parent so document list stays in sync
      this.dispatchEvent(new CustomEvent('document-updated', {
        detail: { document: updated }, bubbles: true, composed: true,
      }));
    } catch {
      this._descSaving = false;
      this._renderPanel();
      alert('Failed to save description');
    }
  }

  async _postComment() {
    const ta = this.shadow.querySelector('[data-role="new-comment"]');
    if (!ta) return;
    const content = ta.value.trim();
    if (!content) return;

    this._submittingComment = true;
    this._renderPanel();
    try {
      const comment = await createComment(this._doc.id, content);
      this._comments = [comment, ...this._comments];
      this._submittingComment = false;
      this._renderPanel();
    } catch {
      this._submittingComment = false;
      this._renderPanel();
      alert('Failed to post comment');
    }
  }

  async _saveCommentEdit(commentId) {
    const ta = this.shadow.querySelector(`[data-role="edit-comment-textarea"][data-comment-id="${commentId}"]`);
    if (!ta) return;
    const content = ta.value.trim();
    if (!content) return;

    try {
      const updated = await updateComment(commentId, content);
      this._comments = this._comments.map(c => c.id === commentId ? updated : c);
      this._editingCommentId = null;
      this._renderPanel();
    } catch {
      alert('Failed to update comment');
    }
  }

  async _deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(commentId);
      this._comments = this._comments.filter(c => c.id !== commentId);
      this._renderPanel();
    } catch {
      alert('Failed to delete comment');
    }
  }

  _showCommentMenu(anchorBtn, commentId) {
    // Remove any existing dropdown
    const existing = this.shadow.querySelector('.comment-dropdown');
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement('div');
    dropdown.className = 'comment-dropdown';
    dropdown.innerHTML = `
      <button class="dropdown-item" data-action="comment-edit" data-comment-id="${commentId}">
        ${icon('edit', 13)} Edit
      </button>
      <button class="dropdown-item danger" data-action="comment-delete" data-comment-id="${commentId}">
        ${icon('trash-2', 13)} Delete
      </button>
    `;

    // Position relative to the comment-item
    const commentItem = anchorBtn.closest('.comment-item');
    if (commentItem) {
      commentItem.style.position = 'relative';
      commentItem.appendChild(dropdown);
    }
  }

  _navigate(delta) {
    const next = this._index + delta;
    if (next < 0 || next >= this._list.length) return;
    const nextDoc = this._list[next];
    this.open(nextDoc, this._list);
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

customElements.define(TAG, PosDocumentPreview);
