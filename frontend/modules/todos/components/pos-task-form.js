// pos-task-form — Todoist-style inline create form (create mode only)
// Emits: task-submit, task-cancel, attachment-upload

import { icon } from '../../../shared/utils/icons.js';

const PRIORITIES = [
  { value: 'none',   label: 'Priority' },
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

class PosTaskForm extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._dueDate = '';
    this._priority = 'none';
    this._pendingAttachments = []; // full objects {id, filename}
    this._showPriorityMenu = false;
    this._menuCoords = null; // fixed coords for priority dropdown
    // Persist typed values across re-renders triggered by chip interactions
    this._title = '';
    this._desc = '';
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
    setTimeout(() => this.shadow.getElementById('title-input')?.focus(), 0);
  }

  // Called by pos-task-list to pre-fill context (e.g. due_date from time bucket)
  setValues({ due_date } = {}) {
    if (due_date) {
      this._dueDate = due_date;
      this._saveInputs();
      this._render();
      this._bindEvents();
    }
  }

  addPendingAttachment(attachment) {
    this._pendingAttachments.push(attachment);
    this._saveInputs();
    this._render();
    this._bindEvents();
  }

  // Save current input values before a re-render
  _saveInputs() {
    const title = this.shadow.getElementById('title-input');
    const desc  = this.shadow.getElementById('desc-input');
    if (title) this._title = title.value;
    if (desc)  this._desc  = desc.value;
  }

  _render() {
    const dateLabel = this._dueDate ? this._formatDate(this._dueDate) : null;
    const priorityLabel = this._priority !== 'none'
      ? PRIORITIES.find(p => p.value === this._priority)?.label
      : null;

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }

        .card {
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          background: var(--pos-color-background-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          margin-bottom: var(--pos-space-sm);
          overflow: visible;
        }

        .inputs {
          padding: var(--pos-space-md) var(--pos-space-md) var(--pos-space-xs);
        }

        .title-input {
          display: block;
          width: 100%;
          border: none;
          outline: none;
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-medium);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          background: transparent;
          padding: 0;
          margin-bottom: var(--pos-space-xs);
          box-sizing: border-box;
        }
        .title-input::placeholder { color: var(--pos-color-text-disabled); font-weight: 400; }

        .desc-input {
          display: block;
          width: 100%;
          border: none;
          outline: none;
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          color: var(--pos-color-text-secondary);
          background: transparent;
          padding: 0;
          resize: none;
          overflow: hidden;
          box-sizing: border-box;
          min-height: 1.4em;
        }
        .desc-input::placeholder { color: var(--pos-color-text-disabled); }

        .chips-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-xs);
          padding: var(--pos-space-xs) var(--pos-space-md) var(--pos-space-sm);
          border-top: 1px solid var(--pos-color-border-default);
          flex-wrap: wrap;
          position: relative;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 99px;
          background: transparent;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
          white-space: nowrap;
          position: relative;
        }
        .chip:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .chip.active { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); background: color-mix(in srgb, var(--pos-color-action-primary) 8%, transparent); }
        .chip svg { pointer-events: none; }

        .chip-clear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px; height: 14px;
          border-radius: 50%;
          margin-left: 2px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: inherit;
          padding: 0;
          font-size: 11px;
          line-height: 1;
        }
        .chip-clear:hover { background: color-mix(in srgb, currentColor 15%, transparent); }

        /* Pending attachment chips */
        .attach-chip-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 6px 3px 9px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: 99px;
          background: color-mix(in srgb, var(--pos-color-action-primary) 8%, transparent);
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-action-primary);
          max-width: 160px;
        }
        .attach-chip-item svg { flex-shrink: 0; }
        .attach-chip-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }

        /* Date input: invisible overlay on chip so showPicker() works */
        .date-chip-wrap {
          position: relative;
          display: inline-flex;
        }
        #date-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          width: 100%;
          height: 100%;
          cursor: pointer;
          border: none;
          padding: 0;
        }

        /* File input hidden */
        #file-input { display: none; }

        /* Priority dropdown — fixed so it escapes overflow:hidden ancestors */
        .priority-menu {
          position: fixed;
          top: 0; left: 0; /* overridden by JS */
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          z-index: 9999;
          overflow: hidden;
          min-width: 130px;
        }
        .priority-option {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 7px var(--pos-space-md);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
        }
        .priority-option:hover { background: var(--pos-color-background-secondary); }
        .priority-option.selected { color: var(--pos-color-action-primary); font-weight: var(--pos-font-weight-medium); }

        /* Bottom bar */
        .bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-top: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          border-radius: 0 0 var(--pos-radius-md) var(--pos-radius-md);
        }

        .list-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
        }

        .actions { display: flex; gap: var(--pos-space-sm); }

        .btn {
          display: inline-flex;
          align-items: center;
          padding: 5px 12px;
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          transition: background 0.1s, opacity 0.1s;
          border: 1px solid transparent;
        }
        .btn-cancel {
          background: transparent;
          border-color: var(--pos-color-border-default);
          color: var(--pos-color-text-secondary);
        }
        .btn-cancel:hover { background: var(--pos-color-background-primary); color: var(--pos-color-text-primary); }
        .btn-submit {
          background: var(--pos-color-action-primary);
          color: #fff;
          font-weight: var(--pos-font-weight-medium);
        }
        .btn-submit:hover { opacity: 0.88; }
        .btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }
      </style>

      <div class="card">
        <div class="inputs">
          <input id="title-input" class="title-input" placeholder="Task name" autocomplete="off"
                 value="${this._escAttr(this._title)}" />
          <textarea id="desc-input" class="desc-input" placeholder="Description" rows="1">${this._esc(this._desc)}</textarea>
        </div>

        <div class="chips-row">
          <div class="date-chip-wrap">
            ${dateLabel
              ? `<button class="chip active" id="date-chip">
                   ${icon('check-square', 12)} ${dateLabel}
                   <button class="chip-clear" id="date-clear">×</button>
                 </button>`
              : `<button class="chip" id="date-chip">${icon('check-square', 12)} Due date</button>`
            }
            <input type="date" id="date-input" value="${this._dueDate}" tabindex="-1" />
          </div>

          <button class="chip ${this._priority !== 'none' ? 'active' : ''}" id="priority-chip">
            ${icon('star', 12)}
            ${priorityLabel || 'Priority'}
          </button>

          <button class="chip ${this._pendingAttachments.length ? 'active' : ''}" id="attach-chip">
            ${icon('upload', 12)} Attach${this._pendingAttachments.length ? ` +${this._pendingAttachments.length}` : ''}
          </button>
          <input type="file" id="file-input" />

          ${this._pendingAttachments.map((a, i) => `
            <div class="attach-chip-item">
              ${icon('upload', 11)}
              <span class="attach-chip-name">${this._esc(a.filename)}</span>
              <button class="chip-clear" data-remove-attach="${i}" title="Remove">×</button>
            </div>
          `).join('')}

          ${this._showPriorityMenu ? `
            <div class="priority-menu" id="priority-menu">
              ${PRIORITIES.map(p => `
                <button class="priority-option ${this._priority === p.value ? 'selected' : ''}"
                        data-priority="${p.value}">${p.label}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="bottom-bar">
          <span class="list-badge">${icon('folder', 13)} Inbox</span>
          <div class="actions">
            <button class="btn btn-cancel" id="cancel-btn">Cancel</button>
            <button class="btn btn-submit" id="submit-btn">Add task</button>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const titleInput = this.shadow.getElementById('title-input');
    const descInput  = this.shadow.getElementById('desc-input');
    const dateInput  = this.shadow.getElementById('date-input');

    // Submit on Enter in title
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
      if (e.key === 'Escape') this._cancel();
    });

    // Auto-expand description textarea
    const autoResize = () => {
      descInput.style.height = 'auto';
      descInput.style.height = descInput.scrollHeight + 'px';
    };
    descInput?.addEventListener('input', autoResize);
    // Run once on render to handle pre-filled content
    if (descInput && this._desc) setTimeout(autoResize, 0);

    // Date chip → trigger date picker on the overlaid input
    this.shadow.getElementById('date-chip')?.addEventListener('click', (e) => {
      if (e.target.closest('#date-clear')) return;
      e.preventDefault();
      // Temporarily make input pointer-events active, trigger picker, then restore
      if (dateInput) {
        dateInput.style.pointerEvents = 'auto';
        try { dateInput.showPicker(); } catch { dateInput.click(); }
        setTimeout(() => { dateInput.style.pointerEvents = 'none'; }, 300);
      }
    });

    this.shadow.getElementById('date-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._dueDate = '';
      this._saveInputs();
      this._render();
      this._bindEvents();
    });

    dateInput?.addEventListener('change', () => {
      this._dueDate = dateInput.value;
      this._saveInputs();
      this._render();
      this._bindEvents();
    });

    // Priority chip → toggle menu
    this.shadow.getElementById('priority-chip')?.addEventListener('click', () => {
      this._showPriorityMenu = !this._showPriorityMenu;
      if (this._showPriorityMenu) {
        const chip = this.shadow.getElementById('priority-chip');
        const rect = chip?.getBoundingClientRect();
        this._menuCoords = rect ? { top: rect.bottom + 4, left: rect.left } : null;
      }
      this._saveInputs();
      this._render();
      this._bindEvents();
    });

    // Apply fixed coords to priority menu after render
    if (this._showPriorityMenu && this._menuCoords) {
      const menu = this.shadow.getElementById('priority-menu');
      if (menu) {
        menu.style.top  = this._menuCoords.top  + 'px';
        menu.style.left = this._menuCoords.left + 'px';
      }
    }

    // Priority option select
    this.shadow.querySelectorAll('[data-priority]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._priority = btn.dataset.priority;
        this._showPriorityMenu = false;
        this._menuCoords = null;
        this._saveInputs();
        this._render();
        this._bindEvents();
        setTimeout(() => this.shadow.getElementById('title-input')?.focus(), 0);
      });
    });

    // Click outside priority menu
    if (this._showPriorityMenu) {
      setTimeout(() => {
        document.addEventListener('click', (e) => {
          if (!this.contains(e.target) && !this.shadow.contains(e.composedPath()[0])) {
            this._showPriorityMenu = false;
            this._menuCoords = null;
            this._saveInputs();
            this._render();
            this._bindEvents();
          }
        }, { once: true, capture: true });
      }, 0);
    }

    // Attach chip
    const fileInput = this.shadow.getElementById('file-input');
    this.shadow.getElementById('attach-chip')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.dispatchEvent(new CustomEvent('attachment-upload', {
          bubbles: true, composed: true,
          detail: { file: fileInput.files[0], taskId: null },
        }));
        fileInput.value = '';
      }
    });

    // Remove pending attachment
    this.shadow.querySelectorAll('[data-remove-attach]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.removeAttach);
        this._pendingAttachments.splice(idx, 1);
        this._saveInputs();
        this._render();
        this._bindEvents();
      });
    });

    this.shadow.getElementById('submit-btn')?.addEventListener('click', () => this._submit());
    this.shadow.getElementById('cancel-btn')?.addEventListener('click', () => this._cancel());
  }

  _submit() {
    const titleEl = this.shadow.getElementById('title-input');
    const title = (titleEl ? titleEl.value : this._title).trim();
    if (!title) return;
    const descEl = this.shadow.getElementById('desc-input');
    const desc = (descEl ? descEl.value : this._desc).trim();
    this.dispatchEvent(new CustomEvent('task-submit', {
      bubbles: true, composed: true,
      detail: {
        title,
        description: desc || null,
        due_date: this._dueDate || null,
        priority: this._priority,
        ...(this._pendingAttachments.length ? { attachment_ids: this._pendingAttachments.map(a => a.id) } : {}),
      },
    }));
  }

  _cancel() {
    this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
  }

  _formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

customElements.define('pos-task-form', PosTaskForm);
