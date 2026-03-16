// pos-vault-field-row — single field row with reveal/copy/edit/delete

const TAG = 'pos-vault-field-row';
const MASK = '••••••••';

const TYPE_ICONS = {
  text: '📝', secret: '🔑', url: '🔗', email: '📧', phone: '📞', notes: '📋',
};

class PosVaultFieldRow extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._revealed = false;
    this._revealedValue = null;
    this._editing = false;
  }

  set field(val) {
    this._field = val;
    this._revealed = false;
    this._revealedValue = null;
    this._editing = false;
    this.render();
  }

  get field() { return this._field; }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('keydown', (e) => this._handleKeydown(e));
    this.shadow.addEventListener('blur', (e) => this._handleBlur(e), true);
  }

  render() {
    if (!this._field) return;
    const f = this._field;
    const isSecret = f.field_type === 'secret';
    const displayValue = isSecret
      ? (this._revealed ? (this._revealedValue || MASK) : MASK)
      : f.field_value;

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--pos-color-border-subtle, #f1f5f9); }
        :host(:last-child) { border-bottom: none; }
        .type-icon { font-size: 14px; width: 20px; text-align: center; flex-shrink: 0; padding-top: 2px; }
        .field-body { flex: 1; min-width: 0; }
        .field-name { font-size: 11px; color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
        .field-name-input {
          font-size: 11px; color: var(--pos-color-text-secondary); background: none;
          border: none; border-bottom: 1px solid var(--pos-color-action-primary);
          outline: none; width: 100%; font-family: inherit; padding: 0;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .field-value { font-size: 13px; color: var(--pos-color-text-primary); word-break: break-all; }
        .field-value.masked { color: var(--pos-color-text-secondary); letter-spacing: 2px; }
        .field-value-input {
          font-size: 13px; color: var(--pos-color-text-primary); background: none;
          border: none; border-bottom: 1px solid var(--pos-color-action-primary);
          outline: none; width: 100%; font-family: inherit; padding: 0;
        }
        .type-select {
          font-size: 11px; background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default); border-radius: 4px;
          padding: 1px 4px; font-family: inherit; cursor: pointer; margin-top: 4px;
        }
        .actions { display: flex; gap: 2px; flex-shrink: 0; padding-top: 2px; }
        .action-btn {
          background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 4px;
          color: var(--pos-color-text-secondary); border-radius: 3px; line-height: 1;
        }
        .action-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
        .copied { font-size: 10px; color: #22c55e; }
      </style>

      <div class="type-icon" title="${f.field_type}">${TYPE_ICONS[f.field_type] || '📝'}</div>

      <div class="field-body">
        ${this._editing
          ? `<input class="field-name-input" data-part="name" value="${this._esc(f.field_name)}" />`
          : `<div class="field-name">${this._esc(f.field_name)}</div>`
        }
        ${this._editing
          ? `
            <input class="field-value-input" data-part="value" value="${this._esc(isSecret && this._revealedValue ? this._revealedValue : (isSecret ? '' : f.field_value))}" placeholder="${isSecret ? 'Enter new secret value' : ''}" />
            <select class="type-select" data-part="type">
              ${['text','secret','url','email','phone','notes'].map(t =>
                `<option value="${t}" ${f.field_type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          `
          : `<div class="field-value ${isSecret && !this._revealed ? 'masked' : ''}">${this._esc(displayValue)}</div>`
        }
      </div>

      <div class="actions">
        ${isSecret && !this._editing ? `
          <button class="action-btn" data-action="reveal" title="${this._revealed ? 'Hide' : 'Reveal'}">${this._revealed ? '🙈' : '👁'}</button>
          <button class="action-btn" data-action="copy" title="Copy to clipboard">📋</button>
        ` : ''}
        ${this._editing
          ? `<button class="action-btn" data-action="save" title="Save">✓</button>
             <button class="action-btn" data-action="cancel" title="Cancel">✕</button>`
          : `<button class="action-btn" data-action="edit" title="Edit">✏️</button>
             <button class="action-btn" data-action="delete" title="Delete">🗑</button>`
        }
      </div>
    `;
  }

  async _handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    switch (btn.dataset.action) {
      case 'reveal':
        if (!this._revealed) {
          this.dispatchEvent(new CustomEvent('field-reveal', {
            detail: { fieldId: this._field.id },
            bubbles: true, composed: true,
          }));
        } else {
          this._revealed = false;
          this._revealedValue = null;
          this.render();
        }
        break;

      case 'copy':
        this.dispatchEvent(new CustomEvent('field-copy', {
          detail: { fieldId: this._field.id },
          bubbles: true, composed: true,
        }));
        break;

      case 'edit':
        this._editing = true;
        this.render();
        this.shadow.querySelector('[data-part="value"]')?.focus();
        break;

      case 'save':
        this._save();
        break;

      case 'cancel':
        this._editing = false;
        this.render();
        break;

      case 'delete':
        this.dispatchEvent(new CustomEvent('field-delete', {
          detail: { fieldId: this._field.id },
          bubbles: true, composed: true,
        }));
        break;
    }
  }

  _handleKeydown(e) {
    if (this._editing && e.key === 'Enter' && !e.shiftKey) this._save();
    if (this._editing && e.key === 'Escape') { this._editing = false; this.render(); }
  }

  _handleBlur(e) {
    // No auto-save on blur — user must click save
  }

  _save() {
    const nameInput = this.shadow.querySelector('[data-part="name"]');
    const valueInput = this.shadow.querySelector('[data-part="value"]');
    const typeSelect = this.shadow.querySelector('[data-part="type"]');

    const updates = {};
    if (nameInput && nameInput.value.trim() !== this._field.field_name) {
      updates.field_name = nameInput.value.trim();
    }
    if (typeSelect && typeSelect.value !== this._field.field_type) {
      updates.field_type = typeSelect.value;
    }
    if (valueInput && valueInput.value) {
      updates.field_value = valueInput.value;
    }

    this._editing = false;
    this.render();

    if (Object.keys(updates).length > 0) {
      this.dispatchEvent(new CustomEvent('field-update', {
        detail: { fieldId: this._field.id, updates },
        bubbles: true, composed: true,
      }));
    }
  }

  // Called by parent to set revealed value
  setRevealed(value) {
    this._revealed = true;
    this._revealedValue = value;
    this.render();
  }

  // Show temporary "Copied!" feedback in place of copy button
  showCopied() {
    const btn = this.shadow.querySelector('[data-action="copy"]');
    if (btn) {
      btn.textContent = '✓';
      btn.title = 'Copied!';
      setTimeout(() => {
        btn.textContent = '📋';
        btn.title = 'Copy to clipboard';
      }, 1500);
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosVaultFieldRow);
