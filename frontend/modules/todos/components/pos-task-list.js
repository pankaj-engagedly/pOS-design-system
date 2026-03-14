// pos-task-list — Scrollable task list organism with header, filters, and inline add
// Composes: ui-button, pos-task-item, pos-task-form

import './pos-task-item.js';
import './pos-task-form.js';

class PosTaskList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._tasks = [];
    this._listName = '';
    this._viewMode = null; // null = list mode, or 'inbox'/'today'/'upcoming'/'completed'
    this._showForm = false;
    this._editingTask = null; // task object being edited
    this._filter = 'active'; // 'all', 'active', 'done'
  }

  set tasks(val) {
    this._tasks = val || [];
    this.render();
  }

  set listName(val) {
    this._listName = val;
    this.render();
  }

  set viewMode(val) {
    this._viewMode = val;
  }

  editTask(task) {
    this._editingTask = task;
    this._showForm = false;
    this.render();
  }

  connectedCallback() {
    this._bindShadowEvents();
    this.render();
  }

  render() {
    const filtered = this._getFilteredTasks();
    const activeCount = this._tasks.filter(t => t.status !== 'done' && t.status !== 'archived').length;
    const isSmartView = !!this._viewMode;

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--pos-space-lg);
          border-bottom: 1px solid var(--pos-color-border-default);
          margin-bottom: var(--pos-space-md);
        }

        .header-left h2 {
          margin: 0;
          font-family: var(--pos-font-family-default);
          font-size: var(--pos-font-size-lg);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
        }

        .header-left .count {
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-secondary);
          margin-top: 2px;
        }

        .filters {
          display: flex;
          gap: var(--pos-space-xs);
          margin-bottom: var(--pos-space-md);
        }

        .task-list {
          flex: 1;
          overflow-y: auto;
        }

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--pos-space-2xl) var(--pos-space-lg);
          color: var(--pos-color-text-secondary);
        }

        .empty h3 {
          margin: 0 0 var(--pos-space-xs);
          font-size: var(--pos-font-size-md);
        }

        .empty p {
          margin: 0;
          font-size: var(--pos-font-size-sm);
        }

        .inline-add {
          margin-top: var(--pos-space-sm);
        }

        .add-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-radius: var(--pos-radius-md);
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: var(--pos-font-family-default);
          transition: background-color 0.1s ease;
        }

        .add-row:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }

        .add-icon {
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-bold);
        }
      </style>

      <div class="header">
        <div class="header-left">
          <h2>${this._escapeHtml(this._listName)}</h2>
          <div class="count">${activeCount} task${activeCount !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="filters">
        <ui-button size="sm" variant="${this._filter === 'all' ? 'solid' : 'outline'}" data-filter="all">All</ui-button>
        <ui-button size="sm" variant="${this._filter === 'active' ? 'solid' : 'outline'}" data-filter="active">Active</ui-button>
        <ui-button size="sm" variant="${this._filter === 'done' ? 'solid' : 'outline'}" data-filter="done">Done</ui-button>
      </div>

      <div class="task-list">
        ${filtered.length === 0 && !this._showForm ? `
          <div class="empty">
            <h3>No tasks yet</h3>
            <p>Click "+ Add task" below to get started</p>
          </div>
        ` : filtered.map(t => {
          if (this._editingTask && this._editingTask.id === t.id) {
            return `<pos-task-form mode="edit" data-task-id="${t.id}"></pos-task-form>`;
          }
          return `
            <pos-task-item
              task-id="${t.id}"
              title="${this._escapeAttr(t.title)}"
              status="${t.status}"
              priority="${t.priority}"
              ${t.due_date ? `due-date="${t.due_date}"` : ''}
              ${t.subtask_total ? `subtask-done="${t.subtask_done || 0}" subtask-total="${t.subtask_total}"` : ''}
              ${t.attachment_ids && t.attachment_ids.length > 0 ? `attachment-count="${t.attachment_ids.length}"` : ''}
              ${isSmartView && t.list_name ? `list-name="${this._escapeAttr(t.list_name)}"` : ''}
            ></pos-task-item>
          `;
        }).join('')}
      </div>

      <div class="inline-add">
        ${this._showForm
          ? '<pos-task-form mode="create"></pos-task-form>'
          : '<div class="add-row" id="add-row"><span class="add-icon">+</span> Add task</div>'
        }
      </div>
    `;

    // Pre-fill edit form if editing
    if (this._editingTask) {
      const form = this.shadow.querySelector(`pos-task-form[data-task-id="${this._editingTask.id}"]`);
      if (form) {
        setTimeout(() => form.setValues(this._editingTask), 0);
      }
    }
  }

  _bindShadowEvents() {
    this.shadow.addEventListener('click', (e) => {
      const addRow = e.target.closest('#add-row');
      if (addRow) {
        this._showForm = true;
        this._editingTask = null;
        this.render();
        return;
      }

      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        this._filter = filterBtn.dataset.filter;
        this.render();
        return;
      }
    });

    // Create or edit task
    this.shadow.addEventListener('task-submit', (e) => {
      e.stopPropagation();
      // Find which form dispatched — check if it has a task ID (edit mode)
      const formEl = this.shadow.querySelector('pos-task-form[mode="edit"]');
      if (formEl && this._editingTask) {
        this.dispatchEvent(new CustomEvent('task-update', {
          bubbles: true, composed: true,
          detail: { taskId: this._editingTask.id, ...e.detail },
        }));
        this._editingTask = null;
      } else {
        this._showForm = false;
        this.dispatchEvent(new CustomEvent('task-create', { bubbles: true, composed: true, detail: e.detail }));
      }
    });

    this.shadow.addEventListener('task-cancel', (e) => {
      e.stopPropagation();
      this._showForm = false;
      this._editingTask = null;
      this.render();
    });
  }

  _getFilteredTasks() {
    let tasks = [...this._tasks];

    if (this._filter === 'active') {
      tasks = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
    } else if (this._filter === 'done') {
      tasks = tasks.filter(t => t.status === 'done');
    }

    return tasks;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-task-list', PosTaskList);
