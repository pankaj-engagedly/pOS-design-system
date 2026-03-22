// pos-subtask-list — Checklist of subtasks molecule
// Composes: ui-checkbox, ui-input, ui-button

class PosSubtaskList extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._subtasks = [];
  }

  set subtasks(val) {
    this._subtasks = val || [];
    this.render();
    this.bindEvents();
  }

  get subtasks() {
    return this._subtasks;
  }

  set taskId(val) {
    this._taskId = val;
  }

  get taskId() {
    return this._taskId;
  }

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
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--pos-space-sm);
        }

        .count {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-secondary);
        }

        .subtask {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 3px 0;
        }

        .subtask-title {
          flex: 1;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-primary);
        }

        .subtask-title.completed {
          text-decoration: line-through;
          color: var(--pos-color-text-secondary);
        }

        .delete-btn {
          background: none;
          border: none;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          font-size: var(--pos-font-size-xs);
          padding: 2px var(--pos-space-xs);
          opacity: 0;
          transition: opacity 0.1s ease;
        }

        .subtask:hover .delete-btn {
          opacity: 1;
        }

        .add-row {
          display: flex;
          align-items: center;
          gap: var(--pos-space-xs);
          margin-top: var(--pos-space-sm);
        }

        .add-row ui-input {
          flex: 1;
        }

        .add-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.1s, color 0.1s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .add-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }
      </style>

      <div class="header">
        <span class="count">${total > 0 ? `Subtasks ${completed}/${total}` : 'Subtasks'}</span>
      </div>

      ${this._subtasks.map(s => `
        <div class="subtask">
          <ui-checkbox data-id="${s.id}" ${s.is_completed ? 'checked' : ''}></ui-checkbox>
          <span class="subtask-title ${s.is_completed ? 'completed' : ''}">${this._escapeHtml(s.title)}</span>
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
    this.shadow.querySelectorAll('ui-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        this.dispatchEvent(new CustomEvent('subtask-toggle', {
          bubbles: true, composed: true,
          detail: { taskId: this._taskId, subtaskId: cb.dataset.id, completed: cb.checked },
        }));
      });
    });

    this.shadow.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('subtask-delete', {
          bubbles: true, composed: true,
          detail: { taskId: this._taskId, subtaskId: btn.dataset.delete },
        }));
      });
    });

    const uiInput = this.shadow.getElementById('new-subtask');
    const addSubtask = () => {
      if (uiInput && uiInput.value.trim()) {
        this.dispatchEvent(new CustomEvent('subtask-add', {
          bubbles: true, composed: true,
          detail: { taskId: this._taskId, title: uiInput.value.trim() },
        }));
        uiInput.value = '';
        uiInput.focus();
      }
    };

    uiInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addSubtask();
    });

    this.shadow.getElementById('add-subtask-btn')?.addEventListener('click', addSubtask);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define('pos-subtask-list', PosSubtaskList);
