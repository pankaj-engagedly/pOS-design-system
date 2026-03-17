// pos-task-item — Flat task row inside a group card
// Composes: ui-checkbox

import { icon } from '../../../shared/utils/icons.js';

const PRIORITY_COLORS = {
  low:    'var(--pos-color-priority-low)',
  medium: 'var(--pos-color-priority-medium)',
  high:   'var(--pos-color-priority-high)',
  urgent: 'var(--pos-color-priority-urgent)',
};

class PosTaskItem extends HTMLElement {
  static get observedAttributes() {
    return ['task-id', 'title', 'status', 'priority', 'due-date', 'list-name', 'attachment-count'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() { this.render(); this.bindEvents(); }
  attributeChangedCallback() {
    if (this.shadow.innerHTML) { this.render(); this.bindEvents(); }
  }

  get isDone() { return this.getAttribute('status') === 'done'; }

  render() {
    const title          = this.getAttribute('title') || '';
    const priority       = this.getAttribute('priority') || 'none';
    const dueDate        = this.getAttribute('due-date');
    const listName       = this.getAttribute('list-name');
    const subtaskDone    = parseInt(this.getAttribute('subtask-done')) || 0;
    const subtaskTotal   = parseInt(this.getAttribute('subtask-total')) || 0;
    const attachCount    = parseInt(this.getAttribute('attachment-count')) || 0;
    const isDone         = this.isDone;
    const today          = new Date().toISOString().slice(0, 10);
    const isOverdue      = dueDate && !isDone && dueDate < today;
    const flagColor      = PRIORITY_COLORS[priority] || null;

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }

        .task-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 8px var(--pos-space-md);
          cursor: pointer;
          transition: background 0.1s;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        :host(:last-of-type) .task-row { border-bottom: none; }
        .task-row:hover { background: color-mix(in srgb, var(--pos-color-action-primary) 4%, transparent); }

        .title-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .title {
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .title.done {
          text-decoration: line-through;
          color: var(--pos-color-text-secondary);
        }
        .meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .list-chip {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: 99px;
          padding: 1px 7px;
          white-space: nowrap;
        }

        .attach-hint {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .due {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          white-space: nowrap;
        }
        .due.overdue { color: var(--pos-color-priority-urgent); }
        .due.today   { color: var(--pos-color-priority-medium); }
        .due svg     { flex-shrink: 0; }

        .priority-flag { display: flex; align-items: center; }
        .priority-flag svg { pointer-events: none; }
      </style>

      <div class="task-row">
        <ui-checkbox id="checkbox" ${isDone ? 'checked' : ''}></ui-checkbox>

        <div class="title-col">
          <span class="title ${isDone ? 'done' : ''}">${this._esc(title)}</span>
        </div>

        <div class="meta">
          ${listName ? `<span class="list-chip">${this._esc(listName)}</span>` : ''}
          ${attachCount > 0 ? `<span class="attach-hint">${icon('upload', 11)} ${attachCount}</span>` : ''}
          ${dueDate ? `
            <span class="due ${isOverdue ? 'overdue' : dueDate === today ? 'today' : ''}">
              ${icon('calendar', 11)} ${this._formatDate(dueDate)}
            </span>` : ''}
          ${flagColor ? `
            <span class="priority-flag" style="color:${flagColor}" title="${priority}">
              ${icon('flag', 13)}
            </span>` : ''}
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.shadow.getElementById('checkbox')?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('toggle-status', {
        bubbles: true, composed: true,
        detail: { taskId: this.getAttribute('task-id'), done: !this.isDone },
      }));
    });

    this.shadow.querySelector('.task-row')?.addEventListener('click', (e) => {
      if (e.target.closest('ui-checkbox')) return;
      this.dispatchEvent(new CustomEvent('select-task', {
        bubbles: true, composed: true,
        detail: { taskId: this.getAttribute('task-id') },
      }));
    });
  }

  _formatDate(dateStr) {
    const today    = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const weekEnd  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    if (dateStr < today)    return 'Overdue';
    if (dateStr === today)  return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    if (dateStr <= weekEnd) return 'This week';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-task-item', PosTaskItem);
