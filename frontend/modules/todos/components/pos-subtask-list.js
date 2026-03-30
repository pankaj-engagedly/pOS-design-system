// pos-subtask-list — Checklist of subtasks with edit + drag-drop reorder

class PosSubtaskList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._subtasks = [];
    this._editingId = null;
    this._dragId = null;
  }

  set subtasks(val) {
    this._subtasks = val || [];
    this._editingId = null;
    this.render();
    this.bindEvents();
  }

  get subtasks() { return this._subtasks; }
  set taskId(val) { this._taskId = val; }
  get taskId() { return this._taskId; }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  render() {
    const completed = this._subtasks.filter(s => s.is_completed).length;
    const total = this._subtasks.length;

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--pos-space-sm);
        }
        .count { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); }

        .subtask {
          display: flex; align-items: center; gap: var(--pos-space-sm);
          padding: 3px 0; border-radius: var(--pos-radius-sm);
          transition: background 0.1s;
        }
        .subtask.drag-over { background: var(--pos-color-background-secondary); }

        .drag-handle {
          cursor: grab; color: var(--pos-color-text-disabled);
          font-size: 11px; padding: 0 2px; opacity: 0;
          transition: opacity 0.1s; user-select: none;
        }
        .subtask:hover .drag-handle { opacity: 1; }
        .drag-handle:active { cursor: grabbing; }

        .subtask-title {
          flex: 1; font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-primary); cursor: pointer;
        }
        .subtask-title.completed {
          text-decoration: line-through; color: var(--pos-color-text-secondary);
        }
        .subtask-title:hover { color: var(--pos-color-action-primary); }

        .edit-input {
          flex: 1; font-size: var(--pos-font-size-xs); font-family: inherit;
          color: var(--pos-color-text-primary);
          border: none; border-bottom: 1px solid var(--pos-color-action-primary);
          outline: none; background: transparent; padding: 1px 0;
        }

        .delete-btn {
          background: none; border: none; color: var(--pos-color-text-secondary);
          cursor: pointer; font-size: var(--pos-font-size-xs);
          padding: 2px var(--pos-space-xs); opacity: 0; transition: opacity 0.1s;
        }
        .subtask:hover .delete-btn { opacity: 1; }
        .delete-btn:hover { color: var(--pos-color-priority-urgent); }

        .add-row {
          display: flex; align-items: center; gap: var(--pos-space-xs);
          margin-top: var(--pos-space-sm);
        }
        .add-row ui-input { flex: 1; }
        .add-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px 10px; border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm); background: transparent;
          color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs);
          font-family: inherit; cursor: pointer; transition: border-color 0.1s, color 0.1s;
          white-space: nowrap; flex-shrink: 0;
        }
        .add-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
      </style>

      <div class="header">
        <span class="count">${total > 0 ? `Subtasks ${completed}/${total}` : 'Subtasks'}</span>
      </div>

      ${this._subtasks.map(s => `
        <div class="subtask" draggable="true" data-subtask-id="${s.id}">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <ui-checkbox data-id="${s.id}" ${s.is_completed ? 'checked' : ''}></ui-checkbox>
          ${this._editingId === s.id
            ? `<input class="edit-input" data-edit-id="${s.id}" value="${this._escAttr(s.title)}" />`
            : `<span class="subtask-title ${s.is_completed ? 'completed' : ''}" data-title-id="${s.id}">${this._escapeHtml(s.title)}</span>`
          }
          <button class="delete-btn" data-delete="${s.id}" title="Delete">&times;</button>
        </div>
      `).join('')}

      <div class="add-row">
        <ui-input id="new-subtask" placeholder="Add subtask..." size="sm"></ui-input>
        <button class="add-btn" id="add-subtask-btn">Add</button>
      </div>
    `;
  }

  bindEvents() {
    // Toggle
    this.shadow.querySelectorAll('ui-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        this._emit('subtask-toggle', { taskId: this._taskId, subtaskId: cb.dataset.id, completed: cb.checked });
      });
    });

    // Delete
    this.shadow.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._emit('subtask-delete', { taskId: this._taskId, subtaskId: btn.dataset.delete });
      });
    });

    // Click title to edit
    this.shadow.querySelectorAll('[data-title-id]').forEach(span => {
      span.addEventListener('click', () => {
        this._editingId = span.dataset.titleId;
        this.render();
        this.bindEvents();
        const inp = this.shadow.querySelector(`[data-edit-id="${this._editingId}"]`);
        inp?.focus();
        inp?.select();
      });
    });

    // Edit input — blur to save, Enter to save, Escape to cancel
    this.shadow.querySelectorAll('[data-edit-id]').forEach(inp => {
      const save = () => {
        const val = inp.value.trim();
        const subtask = this._subtasks.find(s => s.id === inp.dataset.editId);
        if (val && subtask && val !== subtask.title) {
          this._emit('subtask-update', { taskId: this._taskId, subtaskId: inp.dataset.editId, title: val });
        }
        this._editingId = null;
        this.render();
        this.bindEvents();
      };
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') { this._editingId = null; this.render(); this.bindEvents(); }
      });
    });

    // Add subtask
    const uiInput = this.shadow.getElementById('new-subtask');
    const addSubtask = () => {
      if (uiInput && uiInput.value.trim()) {
        this._emit('subtask-add', { taskId: this._taskId, title: uiInput.value.trim() });
        uiInput.value = '';
        uiInput.focus();
      }
    };
    uiInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSubtask(); });
    this.shadow.getElementById('add-subtask-btn')?.addEventListener('click', addSubtask);

    // Drag & drop reorder
    this._bindDragDrop();
  }

  _bindDragDrop() {
    const rows = this.shadow.querySelectorAll('.subtask[draggable]');
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        this._dragId = row.dataset.subtaskId;
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.4';
      });

      row.addEventListener('dragend', () => {
        this._dragId = null;
        row.style.opacity = '1';
        this.shadow.querySelectorAll('.subtask').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const fromId = this._dragId;
        const toId = row.dataset.subtaskId;
        if (!fromId || fromId === toId) return;

        // Reorder locally
        const items = [...this._subtasks];
        const fromIdx = items.findIndex(s => s.id === fromId);
        const toIdx = items.findIndex(s => s.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;

        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        this._subtasks = items;
        this.render();
        this.bindEvents();

        // Emit reorder event with ordered IDs
        this._emit('subtask-reorder', {
          taskId: this._taskId,
          orderedIds: items.map(s => s.id),
        });
      });
    });
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
}

customElements.define('pos-subtask-list', PosSubtaskList);
