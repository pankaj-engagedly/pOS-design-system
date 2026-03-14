// pos-task-form — Create/edit task form molecule
// Composes: ui-input, ui-select, ui-textarea, ui-button, pos-subtask-list

import './pos-subtask-list.js';

class PosTaskForm extends HTMLElement {
  static get observedAttributes() {
    return ['mode']; // 'create' or 'edit'
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._expanded = false;
    this._taskData = null; // holds full task data in edit mode (including subtasks)
    this._attachments = []; // attachment metadata objects
    this._pendingAttachmentIds = []; // IDs for new task creation
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
    // Focus title input
    const uiInput = this.shadow.getElementById('title');
    if (uiInput) setTimeout(() => { uiInput._input?.focus(); }, 0);
  }

  get mode() {
    return this.getAttribute('mode') || 'create';
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .form-container {
          padding: var(--pos-space-md);
          background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          margin-bottom: var(--pos-space-sm);
        }

        .title-row {
          display: flex;
          gap: var(--pos-space-sm);
          align-items: center;
        }

        .title-row ui-input {
          flex: 1;
        }

        .details {
          display: none;
          margin-top: var(--pos-space-md);
        }

        .details.visible {
          display: block;
        }

        .form-row {
          display: flex;
          gap: var(--pos-space-sm);
          margin-bottom: var(--pos-space-sm);
        }

        .form-row > * {
          flex: 1;
        }

        .field-label {
          display: block;
          font-size: var(--pos-raw-font-size-xs);
          font-weight: var(--pos-font-weight-medium);
          color: var(--pos-color-text-secondary);
          margin-bottom: var(--pos-space-xs);
        }

        ui-textarea {
          width: 100%;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--pos-space-sm);
          margin-top: var(--pos-space-md);
        }

        .attachment-section {
          margin-top: var(--pos-space-md);
        }

        .attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--pos-space-xs);
          margin-bottom: var(--pos-space-sm);
        }

        .attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--pos-space-xs);
          padding: 2px var(--pos-space-sm);
          background: var(--pos-color-background-tertiary, var(--pos-color-background-secondary));
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-raw-font-size-xs);
          font-family: var(--pos-font-family-default);
          color: var(--pos-color-text-primary);
        }

        .attachment-chip a {
          color: var(--pos-color-action-primary);
          text-decoration: none;
        }

        .attachment-chip a:hover {
          text-decoration: underline;
        }

        .attachment-chip .size {
          color: var(--pos-color-text-secondary);
        }

        .attachment-chip .remove-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          padding: 0 2px;
          line-height: 1;
        }

        .attachment-chip .remove-btn:hover {
          color: var(--pos-color-priority-urgent);
        }

        .file-input-wrapper {
          display: inline-block;
        }

        .file-input-wrapper input[type="file"] {
          display: none;
        }
      </style>

      <div class="form-container">
        <div class="title-row">
          <ui-input id="title" placeholder="Task title..."></ui-input>
          <ui-button id="expand-btn" variant="outline" size="sm">&#9662;</ui-button>
        </div>

        <div class="details ${this._expanded ? 'visible' : ''}" id="details">
          <div class="form-row">
            <div>
              <span class="field-label">Priority</span>
              <ui-select id="priority">
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </ui-select>
            </div>
            <div>
              <span class="field-label">Due date</span>
              <ui-input id="due-date" type="date"></ui-input>
            </div>
          </div>

          <div>
            <span class="field-label">Description</span>
            <ui-textarea id="description" placeholder="Add details..." rows="3"></ui-textarea>
          </div>

          ${this.mode === 'edit' ? `
          <div style="margin-top: var(--pos-space-md);">
            <span class="field-label">Subtasks</span>
            <pos-subtask-list id="subtask-list"></pos-subtask-list>
          </div>
          ` : ''}

          <div class="attachment-section">
            <span class="field-label">Attachments</span>
            <div class="attachment-list" id="attachment-list">
              ${this._attachments.map(a => `
                <span class="attachment-chip">
                  <a href="/api/attachments/${a.id}/download" target="_blank">${this._escapeHtml(a.filename)}</a>
                  <span class="size">${this._formatSize(a.size)}</span>
                  <button class="remove-btn" data-remove-attachment="${a.id}" title="Remove">&times;</button>
                </span>
              `).join('')}
            </div>
            <div class="file-input-wrapper">
              <ui-button id="attach-btn" variant="outline" size="sm">Attach file</ui-button>
              <input type="file" id="file-input" />
            </div>
          </div>

        </div>

        <div class="actions">
          <ui-button id="cancel-btn" variant="outline" size="sm">Cancel</ui-button>
          <ui-button id="submit-btn" size="sm">${this.mode === 'edit' ? 'Save' : 'Add task'}</ui-button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.shadow.getElementById('expand-btn').addEventListener('click', () => {
      this._expanded = !this._expanded;
      this.shadow.getElementById('details').classList.toggle('visible', this._expanded);
    });

    // Listen for keydown on the ui-input's internal input
    const titleInput = this.shadow.getElementById('title');
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submit();
      }
      if (e.key === 'Escape') {
        this._cancel();
      }
    });

    this.shadow.getElementById('submit-btn').addEventListener('click', () => this._submit());
    this.shadow.getElementById('cancel-btn').addEventListener('click', () => this._cancel());

    // Attachment: trigger file input when attach button clicked
    const attachBtn = this.shadow.getElementById('attach-btn');
    const fileInput = this.shadow.getElementById('file-input');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          this.dispatchEvent(new CustomEvent('attachment-upload', {
            bubbles: true, composed: true,
            detail: {
              file: fileInput.files[0],
              taskId: this._taskData?.id || null,
            },
          }));
          fileInput.value = '';
        }
      });
    }

    // Attachment remove
    this.shadow.querySelectorAll('[data-remove-attachment]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('attachment-remove', {
          bubbles: true, composed: true,
          detail: {
            attachmentId: btn.dataset.removeAttachment,
            taskId: this._taskData?.id || null,
          },
        }));
      });
    });
  }

  _submit() {
    const title = this.shadow.getElementById('title').value.trim();
    if (!title) return;

    const data = {
      title,
      priority: this.shadow.getElementById('priority').value,
      due_date: this.shadow.getElementById('due-date').value || null,
      description: this.shadow.getElementById('description').value || null,
    };

    // Include pending attachment IDs for create mode
    if (this._pendingAttachmentIds.length > 0) {
      data.attachment_ids = this._pendingAttachmentIds;
    }

    this.dispatchEvent(new CustomEvent('task-submit', { bubbles: true, composed: true, detail: data }));
  }

  _cancel() {
    this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
  }

  setAttachments(attachments) {
    this._attachments = attachments || [];
    // Re-render just the attachment list area
    const listEl = this.shadow.getElementById('attachment-list');
    if (listEl) {
      listEl.innerHTML = this._attachments.map(a => `
        <span class="attachment-chip">
          <a href="/api/attachments/${a.id}/download" target="_blank">${this._escapeHtml(a.filename)}</a>
          <span class="size">${this._formatSize(a.size)}</span>
          <button class="remove-btn" data-remove-attachment="${a.id}" title="Remove">&times;</button>
        </span>
      `).join('');
      // Rebind remove buttons
      listEl.querySelectorAll('[data-remove-attachment]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('attachment-remove', {
            bubbles: true, composed: true,
            detail: {
              attachmentId: btn.dataset.removeAttachment,
              taskId: this._taskData?.id || null,
            },
          }));
        });
      });
    }
  }

  addPendingAttachment(attachment) {
    this._pendingAttachmentIds.push(attachment.id);
    this._attachments.push(attachment);
    this.setAttachments(this._attachments);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  setValues(task) {
    if (!task) return;
    this._taskData = task;
    this.shadow.getElementById('title').value = task.title || '';
    this.shadow.getElementById('priority').value = task.priority || 'none';
    this.shadow.getElementById('due-date').value = task.due_date || '';
    this.shadow.getElementById('description').value = task.description || '';
    this._expanded = true;
    this.shadow.getElementById('details').classList.add('visible');

    // Pass subtasks to subtask list in edit mode
    const subtaskList = this.shadow.getElementById('subtask-list');
    if (subtaskList && task.subtasks) {
      subtaskList.taskId = task.id;
      subtaskList.subtasks = task.subtasks;
    }
  }
}

customElements.define('pos-task-form', PosTaskForm);
