// pos-task-item — Single task row molecule
// Composes: ui-checkbox

class PosTaskItem extends HTMLElement {
  static get observedAttributes() {
    return ['task-id', 'title', 'status', 'priority', 'due-date', 'list-name', 'subtask-done', 'subtask-total', 'attachment-count'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) {
      this.render();
      this.bindEvents();
    }
  }

  get isDone() {
    return this.getAttribute('status') === 'done';
  }

  render() {
    const title = this.getAttribute('title') || '';
    const priority = this.getAttribute('priority') || 'none';
    const dueDate = this.getAttribute('due-date');
    const listName = this.getAttribute('list-name');
    const subtaskDone = parseInt(this.getAttribute('subtask-done')) || 0;
    const subtaskTotal = parseInt(this.getAttribute('subtask-total')) || 0;
    const attachmentCount = parseInt(this.getAttribute('attachment-count')) || 0;
    const isDone = this.isDone;

    const isOverdue = dueDate && !isDone && new Date(dueDate) < new Date();

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .task-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-radius: var(--pos-radius-md);
          cursor: pointer;
          transition: background-color 0.1s ease;
        }

        .task-row:hover {
          background-color: var(--pos-color-background-secondary);
        }

        ui-checkbox {
          flex-shrink: 0;
        }

        .title {
          flex: 1;
          font-family: var(--pos-font-family-default);
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          min-width: 0;
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
          gap: var(--pos-space-sm);
          flex-shrink: 0;
        }

        .priority-badge {
          font-size: var(--pos-raw-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          padding: 2px var(--pos-space-xs);
          border-radius: var(--pos-radius-sm);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .priority-low {
          background: color-mix(in srgb, var(--pos-color-priority-low) 15%, transparent);
          color: var(--pos-color-priority-low);
        }
        .priority-medium {
          background: color-mix(in srgb, var(--pos-color-priority-medium) 15%, transparent);
          color: var(--pos-color-priority-medium);
        }
        .priority-high {
          background: color-mix(in srgb, var(--pos-color-priority-high) 15%, transparent);
          color: var(--pos-color-priority-high);
        }
        .priority-urgent {
          background: color-mix(in srgb, var(--pos-color-priority-urgent) 15%, transparent);
          color: var(--pos-color-priority-urgent);
        }

        .due-date {
          font-size: var(--pos-raw-font-size-xs);
          color: var(--pos-color-text-secondary);
        }

        .due-date.overdue {
          color: var(--pos-color-priority-urgent);
          font-weight: var(--pos-font-weight-medium);
        }

        .list-name {
          font-size: var(--pos-raw-font-size-xs);
          color: var(--pos-color-text-disabled);
          padding: 2px var(--pos-space-xs);
          background: var(--pos-color-background-secondary);
          border-radius: var(--pos-radius-sm);
        }

        .subtask-progress {
          font-size: var(--pos-raw-font-size-xs);
          color: var(--pos-color-text-secondary);
          white-space: nowrap;
        }

        .attachment-count {
          font-size: var(--pos-raw-font-size-xs);
          color: var(--pos-color-text-secondary);
          white-space: nowrap;
        }
      </style>

      <div class="task-row">
        <ui-checkbox id="checkbox" ${isDone ? 'checked' : ''}></ui-checkbox>
        <span class="title ${isDone ? 'done' : ''}">${this._escapeHtml(title)}</span>
        <div class="meta">
          ${subtaskTotal > 0 ? `<span class="subtask-progress">${subtaskDone}/${subtaskTotal}</span>` : ''}
          ${attachmentCount > 0 ? `<span class="attachment-count">${attachmentCount} file${attachmentCount > 1 ? 's' : ''}</span>` : ''}
          ${priority !== 'none' ? `<span class="priority-badge priority-${priority}">${priority}</span>` : ''}
          ${dueDate ? `<span class="due-date ${isOverdue ? 'overdue' : ''}">${this._formatDate(dueDate)}</span>` : ''}
          ${listName ? `<span class="list-name">${this._escapeHtml(listName)}</span>` : ''}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const checkbox = this.shadow.getElementById('checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('toggle-status', {
        bubbles: true, composed: true,
        detail: { taskId: this.getAttribute('task-id'), done: !this.isDone },
      }));
    });

    this.shadow.querySelector('.task-row').addEventListener('click', (e) => {
      if (e.target.closest('ui-checkbox')) return;
      this.dispatchEvent(new CustomEvent('select-task', {
        bubbles: true, composed: true,
        detail: { taskId: this.getAttribute('task-id') },
      }));
    });
  }

  _formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define('pos-task-item', PosTaskItem);
