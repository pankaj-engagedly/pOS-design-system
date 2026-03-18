// pos-vault-item-detail — item detail panel with fields, tags, inline editing

import './pos-vault-field-row.js';
import * as api from '../services/vault-api.js';
import { confirmDialog } from '../../../shared/components/pos-confirm-dialog.js';
import store from '../store.js';

const TAG = 'pos-vault-item-detail';

const FIELD_TYPES = ['text', 'secret', 'url', 'email', 'phone', 'notes'];

class PosVaultItemDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
    this._addingField = false;
  }

  connectedCallback() {
    this.render();
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
    this.shadow.addEventListener('input', (e) => this._handleInput(e));
    this.shadow.addEventListener('keydown', (e) => this._handleKeydown(e));
    // Field row events bubble up through shadow DOM
    this.shadow.addEventListener('field-reveal', (e) => this._onReveal(e));
    this.shadow.addEventListener('field-copy', (e) => this._onCopy(e));
    this.shadow.addEventListener('field-update', (e) => this._onFieldUpdate(e));
    this.shadow.addEventListener('field-delete', (e) => this._onFieldDelete(e));
    this._unsub = store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  render() {
    const { selectedItem } = store.getState();

    if (!selectedItem) {
      this.shadow.innerHTML = `
        <style>
          :host { display: flex; align-items: center; justify-content: center; height: 100%; }
          .empty { color: var(--pos-color-text-secondary); font-size: 14px; text-align: center; }
          .empty-icon { font-size: 48px; margin-bottom: 12px; }
        </style>
        <div class="empty">
          <div class="empty-icon">🔐</div>
          <div>Select an item to view details</div>
          <div style="font-size:12px;margin-top:6px">or click + to add a new one</div>
        </div>
      `;
      return;
    }

    const item = selectedItem;

    this.shadow.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .detail-header {
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .item-icon-btn {
          font-size: 24px; background: none; border: 1px solid transparent;
          border-radius: 6px; cursor: pointer; padding: 2px 6px;
          width: 40px; text-align: center;
        }
        .item-icon-btn:hover { border-color: var(--pos-color-border-default); background: var(--pos-color-background-secondary); }
        .name-input {
          flex: 1; font-size: 18px; font-weight: 600; background: none;
          border: none; border-bottom: 2px solid transparent;
          outline: none; font-family: inherit; color: var(--pos-color-text-primary);
          padding: 2px 0;
        }
        .name-input:focus { border-bottom-color: var(--pos-color-action-primary); }
        .fav-btn { background: none; border: none; cursor: pointer; font-size: 18px; padding: 2px; }
        .desc-input {
          width: 100%; box-sizing: border-box; font-size: 13px; background: none;
          border: none; outline: none; font-family: inherit; color: var(--pos-color-text-secondary);
          resize: none; padding: 0; line-height: 1.5;
        }
        .tags-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
        .tag-badge {
          display: flex; align-items: center; gap: 4px;
          background: var(--pos-color-action-primary-subtle, #eff6ff);
          border: 1px solid var(--pos-color-border-default); border-radius: 4px;
          padding: 2px 8px; font-size: 12px; color: var(--pos-color-action-primary);
        }
        .tag-remove { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--pos-color-text-secondary); padding: 0; line-height: 1; }
        .tag-input {
          font-size: 12px; background: none; border: none;
          border-bottom: 1px solid var(--pos-color-border-default);
          outline: none; font-family: inherit; width: 80px; padding: 0;
          color: var(--pos-color-text-primary);
        }
        .tag-input::placeholder { color: var(--pos-color-text-disabled); }
        .scroll { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--pos-color-text-secondary); margin-bottom: 10px; }
        .fields-container { margin-bottom: 16px; }
        .add-field-form {
          display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap;
          padding: 10px; background: var(--pos-color-background-secondary);
          border-radius: 6px; margin-top: 8px;
        }
        .add-field-input {
          flex: 1; min-width: 100px; font-size: 13px; background: none;
          border: none; border-bottom: 1px solid var(--pos-color-border-default);
          outline: none; font-family: inherit; padding: 2px 0;
          color: var(--pos-color-text-primary);
        }
        .add-field-input::placeholder { color: var(--pos-color-text-disabled); }
        .type-select {
          font-size: 12px; background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default); border-radius: 4px;
          padding: 3px 6px; font-family: inherit; cursor: pointer;
        }
        .add-btn, .cancel-btn {
          font-size: 12px; border-radius: 4px; padding: 4px 10px;
          cursor: pointer; font-family: inherit; border: 1px solid var(--pos-color-border-default);
        }
        .add-btn { background: var(--pos-color-action-primary); color: white; border-color: var(--pos-color-action-primary); }
        .cancel-btn { background: none; }
        .add-field-trigger {
          font-size: 13px; color: var(--pos-color-action-primary); cursor: pointer;
          background: none; border: none; font-family: inherit; padding: 4px 0;
          display: flex; align-items: center; gap: 4px;
        }
        .danger-zone { border-top: 1px solid var(--pos-color-border-default); padding-top: 16px; margin-top: 8px; }
        .delete-btn {
          font-size: 13px; color: #ef4444; cursor: pointer;
          background: none; border: 1px solid #ef4444; border-radius: 6px;
          padding: 6px 14px; font-family: inherit;
        }
        .delete-btn:hover { background: #fef2f2; }
      </style>

      <div class="detail-header">
        <div class="name-row">
          <button class="item-icon-btn" data-action="icon" title="Change icon">${this._esc(item.icon || '🔐')}</button>
          <input class="name-input" data-field="name" value="${this._esc(item.name)}" placeholder="Item name" />
          <button class="fav-btn" data-action="toggle-fav" title="${item.is_favorite ? 'Unfavorite' : 'Favorite'}">${item.is_favorite ? '⭐' : '☆'}</button>
        </div>
        <textarea class="desc-input" data-field="description" rows="1" placeholder="Description (optional)">${this._esc(item.description || '')}</textarea>
        <div class="tags-row">
          ${item.tags.map(t => `
            <span class="tag-badge">
              ${this._esc(t.name)}
              <button class="tag-remove" data-action="remove-tag" data-tag-id="${t.id}" title="Remove tag">×</button>
            </span>
          `).join('')}
          <input class="tag-input" data-action="tag-input" placeholder="+ tag" title="Press Enter to add" />
        </div>
      </div>

      <div class="scroll">
        <div class="section-title">Fields</div>
        <div class="fields-container" id="fields-container"></div>

        ${this._addingField ? `
          <div class="add-field-form">
            <input class="add-field-input" id="new-field-name" placeholder="Field name" />
            <input class="add-field-input" id="new-field-value" placeholder="Value" />
            <select class="type-select" id="new-field-type">
              ${FIELD_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
            <button class="add-btn" data-action="save-field">Add</button>
            <button class="cancel-btn" data-action="cancel-field">Cancel</button>
          </div>
        ` : `
          <button class="add-field-trigger" data-action="add-field">+ Add Field</button>
        `}

        <div class="danger-zone">
          <button class="delete-btn" data-action="delete-item">Delete Item</button>
        </div>
      </div>
    `;

    // Render field rows as custom elements (not innerHTML, to preserve state)
    const container = this.shadow.getElementById('fields-container');
    if (container && item.fields) {
      item.fields.forEach(field => {
        const row = document.createElement('pos-vault-field-row');
        row.field = field;
        container.appendChild(row);
      });
    }

    // Restore revealed values if any
    if (this._revealedValues) {
      this.shadow.querySelectorAll('pos-vault-field-row').forEach(row => {
        if (row.field && this._revealedValues[row.field.id]) {
          row.setRevealed(this._revealedValues[row.field.id]);
        }
      });
    }
  }

  _handleClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
      case 'toggle-fav': this._toggleFavorite(); break;
      case 'add-field': this._addingField = true; this.render(); setTimeout(() => this.shadow.getElementById('new-field-name')?.focus(), 50); break;
      case 'save-field': this._saveNewField(); break;
      case 'cancel-field': this._addingField = false; this.render(); break;
      case 'delete-item': this._deleteItem(); break;
      case 'remove-tag': this._removeTag(el.dataset.tagId); break;
    }
  }

  _handleInput(e) {
    const field = e.target.dataset.field;
    if (!field) return;
    // Debounce name/description saves
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveMetadata(), 800);
  }

  _handleKeydown(e) {
    if (e.target.dataset.action === 'tag-input' && e.key === 'Enter') {
      const name = e.target.value.trim();
      if (name) this._addTag(name);
      e.target.value = '';
    }
  }

  async _saveMetadata() {
    const { selectedItemId } = store.getState();
    if (!selectedItemId) return;
    const nameInput = this.shadow.querySelector('[data-field="name"]');
    const descInput = this.shadow.querySelector('[data-field="description"]');
    const updates = {};
    if (nameInput) updates.name = nameInput.value || 'Untitled';
    if (descInput) updates.description = descInput.value || null;
    this.dispatchEvent(new CustomEvent('item-update', {
      detail: { itemId: selectedItemId, updates },
      bubbles: true, composed: true,
    }));
  }

  async _toggleFavorite() {
    const item = store.getState().selectedItem;
    if (!item) return;
    this.dispatchEvent(new CustomEvent('item-update', {
      detail: { itemId: item.id, updates: { is_favorite: !item.is_favorite } },
      bubbles: true, composed: true,
    }));
  }

  async _saveNewField() {
    const name = this.shadow.getElementById('new-field-name')?.value?.trim();
    const value = this.shadow.getElementById('new-field-value')?.value;
    const type = this.shadow.getElementById('new-field-type')?.value || 'text';
    if (!name || value === undefined) return;
    this._addingField = false;
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('field-add', {
      detail: { itemId: selectedItemId, field: { field_name: name, field_value: value, field_type: type } },
      bubbles: true, composed: true,
    }));
  }

  async _addTag(name) {
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('tag-add', {
      detail: { itemId: selectedItemId, name },
      bubbles: true, composed: true,
    }));
  }

  async _removeTag(tagId) {
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('tag-remove', {
      detail: { itemId: selectedItemId, tagId },
      bubbles: true, composed: true,
    }));
  }

  async _deleteItem() {
    if (!await confirmDialog('Delete this vault item and all its fields?', { confirmLabel: 'Delete', danger: true })) return;
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('item-delete', {
      detail: { itemId: selectedItemId },
      bubbles: true, composed: true,
    }));
  }

  async _onReveal(e) {
    const { fieldId } = e.detail;
    const { selectedItemId } = store.getState();
    try {
      const result = await api.revealField(selectedItemId, fieldId);
      if (!this._revealedValues) this._revealedValues = {};
      this._revealedValues[fieldId] = result.value;
      // Find the row and set it
      this.shadow.querySelectorAll('pos-vault-field-row').forEach(row => {
        if (row.field?.id === fieldId) row.setRevealed(result.value);
      });
    } catch (err) {
      alert('Failed to reveal field');
    }
  }

  async _onCopy(e) {
    const { fieldId } = e.detail;
    const { selectedItemId } = store.getState();
    try {
      const result = await api.revealField(selectedItemId, fieldId);
      await navigator.clipboard.writeText(result.value);
      // Show feedback without revealing on screen
      this.shadow.querySelectorAll('pos-vault-field-row').forEach(row => {
        if (row.field?.id === fieldId) row.showCopied();
      });
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  }

  async _onFieldUpdate(e) {
    const { fieldId, updates } = e.detail;
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('field-update', {
      detail: { itemId: selectedItemId, fieldId, updates },
      bubbles: true, composed: true,
    }));
  }

  async _onFieldDelete(e) {
    if (!await confirmDialog('Delete this field?', { confirmLabel: 'Delete', danger: true })) return;
    const { fieldId } = e.detail;
    const { selectedItemId } = store.getState();
    this.dispatchEvent(new CustomEvent('field-delete', {
      detail: { itemId: selectedItemId, fieldId },
      bubbles: true, composed: true,
    }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosVaultItemDetail);
