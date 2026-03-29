// pos-task-list — Task list with grouped card view + filter chips
// Inbox view  → grouped by list (cards)
// List view   → grouped by time bucket (cards)
// Smart views (today, upcoming, completed) → flat list

import './pos-task-item.js';
import './pos-task-form.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-page-header.js';
import '../../../../design-system/src/components/ui-chips.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
];

class PosTaskList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._tasks = [];
    this._listName = '';
    this._viewMode = null;
    this._collapsedGroups = new Set();
    this._addingToGroup = null;
    this._addingSubtaskToTask = null;
    this._activeFilter = 'all';
  }

  set tasks(val) { this._tasks = val || []; this.render(); }
  set listName(val) { this._listName = val; this.render(); }
  set viewMode(val) { this._viewMode = val; this._activeFilter = 'all'; }

  editTask() { }

  connectedCallback() {
    this._bindShadowEvents();
    this.render();
  }

  // ─── Filtering ────────────────────────────────────────────

  _getFilteredTasks() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    switch (this._activeFilter) {
      case 'today':
        return this._tasks.filter(t => t.due_date === today);
      case 'tomorrow':
        return this._tasks.filter(t => t.due_date === tomorrow);
      case 'upcoming':
        return this._tasks.filter(t => t.due_date && t.due_date > today);
      default:
        return this._tasks;
    }
  }

  // ─── Grouping ─────────────────────────────────────────────

  _getGroups(tasks) {
    // All smart views group by list for consistency; list view is flat
    if (this._viewMode) return this._groupByList(tasks);
    return null;
  }

  _groupByList(tasks) {
    const map = new Map();
    for (const task of tasks) {
      const key = task.list_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, { key, label: task.list_name || 'List', listId: task.list_id, tasks: [] });
      }
      map.get(key).tasks.push(task);
    }
    return [...map.values()].map(g => ({
      ...g,
      total: g.tasks.length,
      done: g.tasks.filter(t => t.status === 'done').length,
    }));
  }

  // ─── Rendering ────────────────────────────────────────────

  render() {
    const showFilterChips = (this._viewMode === 'inbox' || !this._viewMode); // chips on inbox + list views
    const filteredTasks = this._getFilteredTasks();
    const groups = this._getGroups(filteredTasks);
    const isSmartView = !!this._viewMode;

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .filters {
          padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-md);
          flex-shrink: 0;
        }

        .scroll {
          flex: 1;
          overflow-y: auto;
          padding: 0 var(--pos-space-lg) var(--pos-space-lg);
        }

        /* ── Group cards ── */
        .group {
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          margin-bottom: var(--pos-space-md);
          background: var(--pos-color-background-primary);
          box-shadow: 0 1px 3px color-mix(in srgb, var(--pos-color-text-primary) 6%, transparent);
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          cursor: pointer;
          user-select: none;
          background: var(--pos-color-background-secondary);
          border-radius: var(--pos-radius-md) var(--pos-radius-md) 0 0;
        }
        .group-header:hover { background: color-mix(in srgb, var(--pos-color-border-default) 40%, transparent); }
        .group.collapsed .group-header { border-radius: var(--pos-radius-md); }

        .group-chevron {
          color: var(--pos-color-text-secondary);
          display: flex;
          align-items: center;
          transition: transform 0.15s;
        }
        .group-chevron.open { transform: rotate(90deg); }

        .group-name {
          flex: 1;
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
        }
        .group-count {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
        }

        .group-body { }

        /* ── Subtask rows (inline inside group cards) ── */
        .subtask-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 3px var(--pos-space-md) 3px calc(var(--pos-space-md) + 28px);
        }
        .subtask-check {
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--pos-color-border-default);
          border-radius: 3px;
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s, border-color 0.1s;
        }
        .subtask-check.done {
          background: var(--pos-color-action-primary);
          border-color: var(--pos-color-action-primary);
          color: #fff;
        }
        .subtask-check svg { pointer-events: none; }
        .subtask-title {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .subtask-title.done {
          text-decoration: line-through;
          opacity: 0.6;
        }
        .subtask-add-trigger {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 2px var(--pos-space-md) 2px calc(var(--pos-space-md) + 28px);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }
        pos-task-item:hover + .subtask-row + .subtask-add-trigger,
        pos-task-item:hover + .subtask-add-trigger,
        .subtask-row:hover + .subtask-add-trigger,
        .subtask-add-trigger:hover { opacity: 1; }
        .subtask-add-trigger .subtask-check {
          border-style: dashed;
          color: var(--pos-color-text-disabled);
        }
        .subtask-add-label {
          font-size: 11px;
          color: var(--pos-color-text-disabled);
        }
        .subtask-add-row { padding-bottom: var(--pos-space-xs); }
        .subtask-add-input {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          color: var(--pos-color-text-primary);
          border: none;
          border-bottom: 1px solid var(--pos-color-action-primary);
          outline: none;
          background: transparent;
          padding: 2px 0;
        }

        .group-add {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          border-top: 1px solid var(--pos-color-border-default);
          transition: color 0.1s;
        }
        .group-add:hover { color: var(--pos-color-action-primary); }
        .group-add svg { flex-shrink: 0; }

        /* ── Flat list (smart views) ── */
        .add-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-radius: var(--pos-radius-md);
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          margin-top: var(--pos-space-sm);
          transition: background 0.1s, color 0.1s;
        }
        .add-row:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--pos-space-2xl) var(--pos-space-lg);
          color: var(--pos-color-text-secondary);
          text-align: center;
        }
        .empty h3 { margin: 0 0 var(--pos-space-xs); font-size: var(--pos-font-size-md); }
        .empty p  { margin: 0; font-size: var(--pos-font-size-sm); }
        .empty-add-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--pos-space-xs);
          margin-top: var(--pos-space-md);
          padding: 6px 16px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
        }
        .empty-add-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
      </style>

      <pos-page-header>
        ${this._esc(this._listName)}
        <span slot="subtitle">${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}</span>
      </pos-page-header>

      ${showFilterChips ? `<div class="filters"><ui-chips id="filter-chips" active="${this._activeFilter}"></ui-chips></div>` : ''}

      <div class="scroll">
        ${groups ? this._renderGroups(groups, isSmartView) : this._renderFlat(filteredTasks, isSmartView)}
      </div>
    `;

    if (showFilterChips) {
      const chips = this.shadow.getElementById('filter-chips');
      if (chips) chips.items = FILTERS;
    }
  }

  _renderGroups(groups, isSmartView) {
    if (groups.length === 0) {
      if (this._addingToGroup === '_empty') {
        return `<pos-task-form mode="create" data-group="_empty" ${this._viewMode ? `data-view="${this._viewMode}"` : ''}></pos-task-form>`;
      }
      return `<div class="empty">
        <h3>No tasks</h3>
        <p>Nothing here yet</p>
        <button class="empty-add-btn" data-action="add-to-group" data-group-key="_empty">${icon('plus', 13)} Add Task</button>
      </div>`;
    }

    return groups.map(g => {
      const collapsed = this._collapsedGroups.has(g.key);
      const showForm = this._addingToGroup === g.key;

      return `
        <div class="group ${collapsed ? 'collapsed' : ''}" data-group-key="${g.key}">
          <div class="group-header" data-action="toggle-group" data-group-key="${g.key}">
            <span class="group-chevron ${collapsed ? '' : 'open'}">${icon('chevron-right', 14)}</span>
            <span class="group-name">${this._esc(g.label)}</span>
            <span class="group-count">${g.done}/${g.total}</span>
          </div>

          ${collapsed ? '' : `
            <div class="group-body">
              ${g.tasks.map(t => this._renderTaskWithSubtasks(t, isSmartView)).join('')}
              ${showForm
            ? `<pos-task-form mode="create" data-group="${g.key}" data-list-id="${g.listId || ''}" data-list-name="${this._escAttr(g.label)}" ${this._viewMode ? `data-view="${this._viewMode}"` : ''}></pos-task-form>`
            : `<div class="group-add" data-action="add-to-group" data-group-key="${g.key}" data-list-id="${g.listId || ''}">
                     ${icon('plus', 13)} Add task
                   </div>`
          }
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  _renderFlat(tasks, isSmartView) {
    const showing = this._addingToGroup === 'flat';
    const isEmpty = tasks.length === 0 && !showing;
    return `
      <div class="flat-task-list">
        ${isEmpty
        ? `<div class="empty">
            <h3>No tasks</h3>
            <p>Nothing here yet</p>
            <button class="empty-add-btn" data-action="add-to-group" data-group-key="flat">${icon('plus', 13)} Add Task</button>
          </div>`
        : `
          ${tasks.map(t => this._renderTaskWithSubtasks(t, isSmartView)).join('')}
          ${showing
            ? `<pos-task-form mode="create" data-group="flat" data-list-name="${this._escAttr(this._listName)}"></pos-task-form>`
            : `<div class="add-row" data-action="add-to-group" data-group-key="flat">${icon('plus', 13)} Add task</div>`
          }
        `}
      </div>
    `;
  }

  _renderTaskWithSubtasks(t, isSmartView) {
    const taskHtml = `
      <pos-task-item
        task-id="${t.id}"
        title="${this._escAttr(t.title)}"
        status="${t.status}"
        priority="${t.priority}"
        ${t.due_date ? `due-date="${t.due_date}"` : ''}
        ${t.subtask_total ? `subtask-done="${t.subtask_done || 0}" subtask-total="${t.subtask_total}"` : ''}
        ${t.attachment_ids?.length ? `attachment-count="${t.attachment_ids.length}"` : ''}
        ${isSmartView && t.list_name ? `list-name="${this._escAttr(t.list_name)}"` : ''}
      ></pos-task-item>
    `;

    // Render inline subtask rows if full subtask objects are available
    const subtasks = t.subtasks;
    if (!subtasks || subtasks.length === 0) return taskHtml;

    const subtaskRows = subtasks.map(s => `
      <div class="subtask-row"
           data-action="toggle-subtask"
           data-subtask-id="${s.id}"
           data-task-id="${t.id}"
           data-completed="${s.is_completed ? 'true' : 'false'}">
        <span class="subtask-check ${s.is_completed ? 'done' : ''}">
          ${s.is_completed ? icon('check', 10) : ''}
        </span>
        <span class="subtask-title ${s.is_completed ? 'done' : ''}">${this._esc(s.title)}</span>
      </div>
    `).join('');

    // Inline add subtask
    const addSubtaskHtml = this._addingSubtaskToTask === t.id
      ? `<div class="subtask-row subtask-add-row">
           <span class="subtask-check"></span>
           <input class="subtask-add-input" data-add-subtask-for="${t.id}" placeholder="Subtask title…" />
         </div>`
      : `<div class="subtask-add-trigger" data-action="add-subtask-inline" data-task-id="${t.id}">
           <span class="subtask-check">${icon('plus', 9)}</span>
           <span class="subtask-add-label">Add subtask</span>
         </div>`;

    return taskHtml + subtaskRows + addSubtaskHtml;
  }

  // ─── Events ───────────────────────────────────────────────

  _bindShadowEvents() {
    // ui-chips chip-select (composed: true — crosses shadow boundary)
    this.shadow.addEventListener('chip-select', (e) => {
      this._activeFilter = e.detail.key;
      this._addingToGroup = null;
      this.render();
    });

    this.shadow.addEventListener('click', (e) => {
      // Toggle group collapse
      const toggleEl = e.target.closest('[data-action="toggle-group"]');
      if (toggleEl) {
        const key = toggleEl.dataset.groupKey;
        if (this._collapsedGroups.has(key)) this._collapsedGroups.delete(key);
        else this._collapsedGroups.add(key);
        this.render();
        return;
      }

      // Open add form inside group
      const addEl = e.target.closest('[data-action="add-to-group"]');
      if (addEl) {
        this._addingToGroup = addEl.dataset.groupKey;
        this.render();
        return;
      }

      // Inline add subtask trigger
      const addSubEl = e.target.closest('[data-action="add-subtask-inline"]');
      if (addSubEl) {
        this._addingSubtaskToTask = addSubEl.dataset.taskId;
        this.render();
        setTimeout(() => {
          const inp = this.shadow.querySelector(`[data-add-subtask-for="${addSubEl.dataset.taskId}"]`);
          inp?.focus();
        }, 0);
        return;
      }

      // Subtask toggle
      const subtaskRow = e.target.closest('[data-action="toggle-subtask"]');
      if (subtaskRow) {
        const { subtaskId, taskId, completed } = subtaskRow.dataset;
        this.dispatchEvent(new CustomEvent('subtask-toggle', {
          bubbles: true, composed: true,
          detail: {
            subtaskId,
            taskId,
            completed: completed !== 'true', // flip
          },
        }));
        return;
      }
    });

    // task-submit from pos-task-form
    this.shadow.addEventListener('task-submit', (e) => {
      e.stopPropagation();
      const createForm = this.shadow.querySelector('pos-task-form[mode="create"]');
      const listId = createForm?.dataset.listId || null;
      this._addingToGroup = null;
      this.dispatchEvent(new CustomEvent('task-create', {
        bubbles: true, composed: true,
        detail: { ...e.detail, ...(listId ? { list_id: listId } : {}) },
      }));
    });

    this.shadow.addEventListener('task-cancel', (e) => {
      e.stopPropagation();
      this._addingToGroup = null;
      this.render();
    });

    // Inline subtask input — Enter to submit, Escape to cancel
    this.shadow.addEventListener('keydown', (e) => {
      const inp = e.target.closest('[data-add-subtask-for]');
      if (!inp) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const title = inp.value.trim();
        if (title) {
          this.dispatchEvent(new CustomEvent('subtask-add', {
            bubbles: true, composed: true,
            detail: { taskId: inp.dataset.addSubtaskFor, title },
          }));
          inp.value = '';
        }
      }
      if (e.key === 'Escape') {
        this._addingSubtaskToTask = null;
        this.render();
      }
    });

    // Inline subtask input — blur to close
    this.shadow.addEventListener('focusout', (e) => {
      const inp = e.target.closest('[data-add-subtask-for]');
      if (inp && !inp.value.trim()) {
        this._addingSubtaskToTask = null;
        this.render();
      }
    });
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

customElements.define('pos-task-list', PosTaskList);
