// pos-task-detail — Right-side flyout for viewing/editing a task
// Slides in from the right (Mac notification bar style)
// Emits: task-update, subtask-add, subtask-toggle, subtask-delete, attachment-upload, attachment-remove

import './pos-subtask-list.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../../design-system/src/components/ui-date-picker.js';

const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];

class PosTaskDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._task = null;
    this._attachments = [];
    this._editingTitle = false;
    this._editingDesc  = false;
    this._editingCommentId = null;
  }

  // ─── Public API ───────────────────────────────────────────

  openForTask(task) {
    this._task = task;
    this._attachments = [];
    this._editingTitle = false;
    this._editingDesc  = false;
    this._render();
    this._bindEvents();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    this._task = null;
  }

  // Called by pos-todos-app after a refresh
  refreshTask(task) {
    if (!task || !this._task || task.id !== this._task.id) return;
    this._task = task;
    this._showDateMenu = false;
    this._render();
    this._bindEvents();
  }

  setAttachments(attachments) {
    this._attachments = attachments || [];
    this._render();
    this._bindEvents();
  }

  // ─── Rendering ────────────────────────────────────────────

  _render() {
    if (!this._task) { this.shadow.innerHTML = ''; return; }

    const t = this._task;
    const today = new Date().toISOString().slice(0, 10);

    this.shadow.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0; right: 0;
          width: 380px;
          height: 100%;
          background: var(--pos-color-background-primary);
          border-left: 1px solid var(--pos-color-border-default);
          box-shadow: -6px 0 24px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.22s ease;
          z-index: 50;
          overflow: hidden;
        }
        :host([open]) { transform: translateX(0); }

        /* ── Header ── */
        .header {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 10px var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          flex-shrink: 0;
        }
        .list-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-medium);
          color: var(--pos-color-text-secondary);
          flex: 1;
        }
        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }
        .close-btn:hover { background: var(--pos-color-border-default); color: var(--pos-color-text-primary); }
        .close-btn svg { pointer-events: none; }

        /* ── Scroll body ── */
        .body {
          flex: 1;
          overflow-y: auto;
          padding: var(--pos-space-md) var(--pos-space-md) var(--pos-space-lg);
        }

        /* ── Title ── */
        .title-row {
          display: flex;
          align-items: flex-start;
          gap: var(--pos-space-sm);
          margin-bottom: var(--pos-space-sm);
        }
        .title-check {
          margin-top: 3px;
          flex-shrink: 0;
        }
        .title-text {
          flex: 1;
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          cursor: pointer;
          line-height: 1.4;
          word-break: break-word;
        }
        .title-text.done {
          text-decoration: line-through;
          color: var(--pos-color-text-secondary);
        }
        .title-input {
          flex: 1;
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          padding: 2px 6px;
          outline: none;
          background: transparent;
        }

        /* ── Description ── */
        .desc-section { margin-bottom: var(--pos-space-sm); }
        .desc-text {
          font-size: var(--pos-font-size-xs);
          color: ${t.description ? 'var(--pos-color-text-secondary)' : 'var(--pos-color-text-disabled)'};
          cursor: pointer;
          padding: var(--pos-space-xs) 0;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .desc-textarea {
          width: 100%;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          padding: var(--pos-space-xs);
          outline: none;
          background: transparent;
          resize: vertical;
          min-height: 60px;
          box-sizing: border-box;
        }

        /* ── Section divider ── */
        .section {
          border-top: 1px solid var(--pos-color-border-default);
          padding-top: var(--pos-space-sm);
          margin-bottom: var(--pos-space-sm);
        }
        .section-title {
          font-size: 10px;
          font-weight: var(--pos-font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--pos-color-text-secondary);
          margin-bottom: var(--pos-space-xs);
        }

        /* ── Detail rows ── */
        .detail-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 5px 0;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          width: 72px;
          flex-shrink: 0;
        }
        .detail-value {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-primary);
        }
        .detail-input, .detail-select {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          padding: 3px 6px;
          outline: none;
          background: var(--pos-color-background-primary);
        }
        .detail-input:focus, .detail-select:focus {
          border-color: var(--pos-color-action-primary);
        }

        /* ── Attachments ── */
        .attachment-item {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 3px 0;
          font-size: var(--pos-font-size-xs);
        }
        .attachment-item a {
          flex: 1;
          color: var(--pos-color-action-primary);
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .attachment-item a:hover { text-decoration: underline; }
        .attach-remove {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-secondary); font-size: 12px;
          padding: 0 2px; line-height: 1;
        }
        .attach-remove:hover { color: var(--pos-color-priority-urgent); }

        .attach-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px;
          border: 1px dashed var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          margin-top: var(--pos-space-xs);
          transition: border-color 0.1s, color 0.1s;
        }
        .attach-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        #file-input { display: none; }

        /* Priority colors */
        .priority-low    { color: var(--pos-color-priority-low); }
        .priority-medium { color: var(--pos-color-priority-medium); }
        .priority-high   { color: var(--pos-color-priority-high); }
        .priority-urgent { color: var(--pos-color-priority-urgent); }

        /* ── Comments ── */
        .comment-item {
          padding: var(--pos-space-xs) 0;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .comment-item:last-of-type { border-bottom: none; }
        .comment-meta {
          display: flex;
          align-items: center;
          gap: var(--pos-space-xs);
          margin-bottom: 2px;
        }
        .comment-date {
          font-size: 10px;
          color: var(--pos-color-text-disabled);
        }
        .comment-actions {
          margin-left: auto;
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.1s;
        }
        .comment-item:hover .comment-actions { opacity: 1; }
        .comment-action-btn {
          background: none; border: none; cursor: pointer;
          color: var(--pos-color-text-secondary); font-size: 11px;
          padding: 0 3px; line-height: 1;
        }
        .comment-action-btn:hover { color: var(--pos-color-action-primary); }
        .comment-action-btn.delete:hover { color: var(--pos-color-priority-urgent); }
        .comment-content {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-primary);
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .comment-edit-textarea {
          width: 100%;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          padding: var(--pos-space-xs);
          outline: none;
          background: transparent;
          resize: vertical;
          min-height: 40px;
          box-sizing: border-box;
        }
        .comment-add {
          display: flex;
          gap: var(--pos-space-xs);
          margin-top: var(--pos-space-xs);
        }
        .comment-input {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          padding: 5px 8px;
          outline: none;
          background: transparent;
          resize: none;
          min-height: 32px;
          box-sizing: border-box;
        }
        .comment-input:focus { border-color: var(--pos-color-action-primary); }
        .comment-submit {
          align-self: flex-end;
          padding: 5px 10px;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          font-weight: var(--pos-font-weight-medium);
          color: white;
          background: var(--pos-color-action-primary);
          border: none;
          border-radius: var(--pos-radius-sm);
          cursor: pointer;
        }
        .comment-submit:hover { opacity: 0.9; }

        /* ── Action bar ── */
        .action-bar {
          display: flex;
          gap: var(--pos-space-xs);
          padding: var(--pos-space-xs) 0;
        }
        .action-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
        }
        .action-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .action-btn.delete:hover { border-color: var(--pos-color-priority-urgent); color: var(--pos-color-priority-urgent); }
      </style>

      <!-- Header -->
      <div class="header">
        <span class="list-badge">${icon('check-square', 13)} ${this._esc(t.list_name || 'Inbox')}</span>
        <button class="close-btn" id="close-btn">${icon('x', 16)}</button>
      </div>

      <!-- Body -->
      <div class="body">

        <!-- Title + status toggle -->
        <div class="title-row">
          <ui-checkbox class="title-check" id="status-check" ${t.status === 'done' ? 'checked' : ''}></ui-checkbox>
          ${this._editingTitle
            ? `<input class="title-input" id="title-input" value="${this._escAttr(t.title)}" />`
            : `<span class="title-text ${t.status === 'done' ? 'done' : ''}" id="title-text">${this._esc(t.title)}</span>`
          }
        </div>

        <!-- Description -->
        <div class="desc-section">
          ${this._editingDesc
            ? `<textarea class="desc-textarea" id="desc-textarea">${this._esc(t.description || '')}</textarea>`
            : `<div class="desc-text" id="desc-text">${t.description ? this._esc(t.description) : 'Add a description…'}</div>`
          }
        </div>

        <!-- Subtasks -->
        <div class="section">
          <pos-subtask-list id="subtask-list"></pos-subtask-list>
        </div>

        <!-- Details -->
        <div class="section">
          <div class="section-title">Details</div>
          <div class="detail-row">
            <span class="detail-label">Due date</span>
            <ui-date-picker id="date-picker" value="${t.due_date || ''}" placeholder="Set date" variant="inline"></ui-date-picker>
          </div>
          <div class="detail-row">
            <span class="detail-label">Priority</span>
            <select class="detail-select" id="priority">
              ${PRIORITIES.map(p => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Attachments -->
        <div class="section">
          <div class="section-title">Attachments</div>
          ${this._attachments.map(a => `
            <div class="attachment-item">
              ${icon('upload', 13)}
              <a href="/api/attachments/${a.id}/download" target="_blank">${this._esc(a.filename)}</a>
              <button class="attach-remove" data-remove="${a.id}" title="Remove">×</button>
            </div>
          `).join('')}
          <button class="attach-btn" id="attach-btn">${icon('plus', 13)} Attach file</button>
          <input type="file" id="file-input" />
        </div>

        <!-- Comments -->
        <div class="section">
          <div class="section-title">Comments (${(t.comments || []).length})</div>
          ${(t.comments || []).map(c => `
            <div class="comment-item" data-comment-id="${c.id}">
              <div class="comment-meta">
                <span class="comment-date">${this._formatDate(c.created_at)}${c.updated_at !== c.created_at ? ' (edited)' : ''}</span>
                <span class="comment-actions">
                  <button class="comment-action-btn edit" data-edit-comment="${c.id}" title="Edit">edit</button>
                  <button class="comment-action-btn delete" data-delete-comment="${c.id}" title="Delete">×</button>
                </span>
              </div>
              ${this._editingCommentId === c.id
                ? `<textarea class="comment-edit-textarea" data-editing-comment="${c.id}">${this._esc(c.content)}</textarea>`
                : `<div class="comment-content">${this._esc(c.content)}</div>`
              }
            </div>
          `).join('')}
          <div class="comment-add">
            <textarea class="comment-input" id="comment-input" placeholder="Add a comment..." rows="1"></textarea>
            <button class="comment-submit" id="comment-submit">Add</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="section">
          <div class="action-bar">
            <button class="action-btn" id="duplicate-btn">${icon('copy', 13)} Duplicate</button>
            <button class="action-btn delete" id="delete-btn">${icon('trash-2', 13)} Delete</button>
          </div>
        </div>

      </div>
    `;

    // Wire up subtask list
    const subtaskList = this.shadow.getElementById('subtask-list');
    if (subtaskList) {
      subtaskList.taskId = t.id;
      subtaskList.subtasks = t.subtasks || [];
    }
  }

  _bindEvents() {
    if (!this._task) return;
    const t = this._task;

    // Close
    this.shadow.getElementById('close-btn')?.addEventListener('click', () => this.close());

    // Status toggle (checkbox)
    const statusCheck = this.shadow.getElementById('status-check');
    statusCheck?.addEventListener('change', () => {
      this._emit('task-update', { taskId: t.id, status: statusCheck.checked ? 'done' : 'todo' });
    });

    // Title: click to edit
    this.shadow.getElementById('title-text')?.addEventListener('click', () => {
      this._editingTitle = true;
      this._render(); this._bindEvents();
      setTimeout(() => {
        const inp = this.shadow.getElementById('title-input');
        inp?.focus();
        inp?.select();
      }, 0);
    });

    const titleInput = this.shadow.getElementById('title-input');
    titleInput?.addEventListener('blur', () => {
      const val = titleInput.value.trim();
      if (val && val !== t.title) this._emit('task-update', { taskId: t.id, title: val });
      this._editingTitle = false;
      this._render(); this._bindEvents();
    });
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleInput.blur(); }
      if (e.key === 'Escape') { this._editingTitle = false; this._render(); this._bindEvents(); }
    });

    // Description: click to edit
    this.shadow.getElementById('desc-text')?.addEventListener('click', () => {
      this._editingDesc = true;
      this._render(); this._bindEvents();
      setTimeout(() => this.shadow.getElementById('desc-textarea')?.focus(), 0);
    });

    const descTA = this.shadow.getElementById('desc-textarea');
    descTA?.addEventListener('blur', () => {
      const val = descTA.value.trim() || null;
      if (val !== (t.description || null)) this._emit('task-update', { taskId: t.id, description: val });
      this._editingDesc = false;
      this._render(); this._bindEvents();
    });
    descTA?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this._editingDesc = false; this._render(); this._bindEvents(); }
    });

    // Due date — ui-date-picker component
    this.shadow.getElementById('date-picker')?.addEventListener('date-change', (e) => {
      const val = e.detail.value || null;
      this._task = { ...this._task, due_date: val };
      this._emit('task-update', { taskId: t.id, due_date: val });
    });

    // Priority
    this.shadow.getElementById('priority')?.addEventListener('change', (e) => {
      this._emit('task-update', { taskId: t.id, priority: e.target.value });
    });

    // Attachments
    const fileInput = this.shadow.getElementById('file-input');
    this.shadow.getElementById('attach-btn')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this._emit('attachment-upload', { file: fileInput.files[0], taskId: t.id });
        fileInput.value = '';
      }
    });
    this.shadow.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._emit('attachment-remove', { attachmentId: btn.dataset.remove, taskId: t.id });
      });
    });

    // Comments — add
    const commentInput = this.shadow.getElementById('comment-input');
    const commentSubmit = this.shadow.getElementById('comment-submit');
    commentSubmit?.addEventListener('click', () => {
      const val = commentInput?.value.trim();
      if (val) {
        this._emit('comment-add', { taskId: t.id, content: val });
        commentInput.value = '';
      }
    });
    commentInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commentSubmit?.click();
      }
    });

    // Comments — edit
    this.shadow.querySelectorAll('[data-edit-comment]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._editingCommentId = btn.dataset.editComment;
        this._render(); this._bindEvents();
        setTimeout(() => {
          const ta = this.shadow.querySelector(`[data-editing-comment="${btn.dataset.editComment}"]`);
          ta?.focus();
        }, 0);
      });
    });
    this.shadow.querySelectorAll('[data-editing-comment]').forEach(ta => {
      ta.addEventListener('blur', () => {
        const val = ta.value.trim();
        if (val) this._emit('comment-update', { commentId: ta.dataset.editingComment, content: val });
        this._editingCommentId = null;
        this._render(); this._bindEvents();
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this._editingCommentId = null; this._render(); this._bindEvents(); }
      });
    });

    // Comments — delete
    this.shadow.querySelectorAll('[data-delete-comment]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._emit('comment-delete', { taskId: t.id, commentId: btn.dataset.deleteComment });
      });
    });

    // Duplicate
    this.shadow.getElementById('duplicate-btn')?.addEventListener('click', () => {
      this._emit('task-duplicate', { taskId: t.id });
    });

    // Delete
    this.shadow.getElementById('delete-btn')?.addEventListener('click', () => {
      this._emit('task-delete', { taskId: t.id });
    });
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }
}

customElements.define('pos-task-detail', PosTaskDetail);
