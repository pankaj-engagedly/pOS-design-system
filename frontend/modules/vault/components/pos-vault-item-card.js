// pos-vault-item-card — Detailed vault item card with all fields + inline editing
// Receives full item data (with sections/fields) via .item property
// Dispatches: item-favourite, item-delete, item-update (name),
//             field-inline-save, field-add-standalone, field-delete-standalone

import { icon } from '../../../shared/utils/icons.js';
import * as api from '../services/vault-api.js';

const FIELD_TYPES = ['text', 'secret', 'url', 'email', 'phone', 'notes'];

const cardSheet = new CSSStyleSheet();
cardSheet.replaceSync(`
  :host { display: block; }

  .card {
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-lg, 10px);
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .card:hover {
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  /* ── Header ───────────────────────────────── */
  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px 6px;
  }
  .lock-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-muted);
    flex-shrink: 0;
  }
  .header-info { flex: 1; min-width: 0; }
  .item-name {
    font-size: var(--pos-font-size-md);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    cursor: pointer;
    line-height: 1.3;
  }
  .item-name:hover { color: var(--pos-color-action-primary); }
  .name-input {
    font-size: var(--pos-font-size-md);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    padding: 2px 6px;
    outline: none;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
    background: var(--pos-color-background-primary);
  }
  .category-badge {
    display: inline-block;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 99px;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-muted);
    margin-top: 3px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .card:hover .header-actions { opacity: 1; }
  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    border: none; border-radius: var(--pos-radius-sm);
    background: transparent; color: var(--pos-color-text-muted);
    cursor: pointer; padding: 0;
  }
  .icon-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
  .icon-btn.active { color: var(--pos-color-action-primary); }
  .icon-btn.delete:hover { color: var(--pos-color-priority-urgent, #dc2626); }
  .icon-btn svg { pointer-events: none; }

  /* ── Fields ───────────────────────────────── */
  .card-fields {
    padding: 2px 20px 12px;
  }

  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--pos-color-text-muted);
    font-weight: var(--pos-font-weight-medium);
    padding: 8px 0 4px;
    border-bottom: 1px solid var(--pos-color-border-default);
  }

  .field-row {
    display: flex;
    align-items: center;
    padding: 7px 0;
    gap: 12px;
    min-height: 20px;
  }

  .field-label {
    width: 180px;
    flex-shrink: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--pos-color-text-muted);
    font-weight: var(--pos-font-weight-medium);
  }
  .field-value {
    flex: 1;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    word-break: break-all;
    cursor: pointer;
    min-height: 18px;
    padding: 2px 4px;
    border-radius: var(--pos-radius-sm);
  }
  .field-value:hover { background: var(--pos-color-background-secondary); }
  .field-value.empty {
    color: var(--pos-color-text-muted);
    font-style: italic;
  }
  .field-value.masked {
    letter-spacing: 2px;
    color: var(--pos-color-text-secondary);
  }

  .field-edit-input {
    flex: 1;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    padding: 4px 8px;
    outline: none;
    font-family: inherit;
    background: var(--pos-color-background-primary);
    min-width: 0;
    box-sizing: border-box;
  }

  .field-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    min-width: 56px;
    justify-content: flex-end;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .field-row:hover .field-actions { opacity: 1; }
  .action-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    border: none; border-radius: var(--pos-radius-sm);
    background: transparent; color: var(--pos-color-text-muted);
    cursor: pointer; padding: 0;
  }
  .action-btn:hover {
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
  }
  .action-btn.del:hover { color: var(--pos-color-priority-urgent, #dc2626); }
  .action-btn svg { pointer-events: none; }
  .copied-label {
    font-size: 11px;
    color: var(--pos-color-action-primary);
    font-weight: var(--pos-font-weight-medium);
  }

  /* ── Add field ────────────────────────────── */
  .add-field-btn {
    display: flex; align-items: center; gap: 6px;
    background: none;
    border: 1px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm); font-family: inherit;
    padding: 7px 12px;
    cursor: pointer; width: 100%;
    margin-top: 8px;
    transition: border-color 0.1s, color 0.1s;
  }
  .add-field-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .add-field-btn svg { pointer-events: none; }

  .add-field-form {
    margin-top: 8px;
    padding: 12px;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-secondary);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .add-field-row {
    display: flex;
    gap: 8px;
  }
  .add-field-row input, .add-field-row select {
    padding: 6px 8px;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
  .add-field-row input:focus, .add-field-row select:focus {
    border-color: var(--pos-color-action-primary);
  }
  .add-field-row input { flex: 1; min-width: 0; }
  .add-field-row select { width: 100px; flex-shrink: 0; }
  .add-field-actions {
    display: flex; gap: 6px;
  }
  .add-field-actions button {
    padding: 5px 14px;
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); font-family: inherit;
    cursor: pointer; border: none;
  }
  .save-field-btn { background: var(--pos-color-action-primary); color: #fff; }
  .save-field-btn:hover { opacity: 0.88; }
  .cancel-field-btn {
    background: transparent;
    border: 1px solid var(--pos-color-border-default) !important;
    color: var(--pos-color-text-secondary);
  }
  .cancel-field-btn:hover { background: var(--pos-color-background-primary); }
`);

class PosVaultItemCard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [cardSheet];
    this._item = null;
    this._categoryName = '';
    this._editingName = false;
    this._editingFieldId = null;
    this._addingField = false;
    this._revealedValues = {};
    this._copiedFieldId = null;
    this._eventsBound = false;
  }

  set item(val) {
    this._item = val;
    this._editingName = false;
    this._editingFieldId = null;
    this._addingField = false;
    this._revealedValues = {};
    this._copiedFieldId = null;
    this._render();
  }

  set categoryName(val) {
    this._categoryName = val || '';
  }

  refreshItem(item) {
    this._item = item;
    this._editingFieldId = null;
    this._addingField = false;
    // Keep _revealedValues across refresh
    this._render();
  }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  // ── Data helpers ────────────────────────────────────────────────────────

  _getGroupedSections() {
    let idx = 0;
    return (this._item?.sections || []).map(s => ({
      name: s.name,
      fields: s.fields.map(f => ({
        ...f,
        sectionName: s.name,
        key: f.id ? `v_${f.id}` : (f.template_id ? `t_${f.template_id}` : `i_${idx++}`),
      })),
    }));
  }

  _getAllFields() {
    return this._getGroupedSections().flatMap(s => s.fields);
  }

  _findField(key) {
    return this._getAllFields().find(f => f.key === key);
  }

  // ── Events ──────────────────────────────────────────────────────────────

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    const s = this.shadow;

    s.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !this._item) return;
      const action = btn.dataset.action;

      if (action === 'favourite') {
        this.dispatchEvent(new CustomEvent('item-favourite', {
          bubbles: true, composed: true,
          detail: { itemId: this._item.id, is_favorite: !this._item.is_favorite },
        }));
        return;
      }

      if (action === 'delete') {
        this.dispatchEvent(new CustomEvent('item-delete', {
          bubbles: true, composed: true,
          detail: { itemId: this._item.id },
        }));
        return;
      }

      if (action === 'edit-name') {
        this._editingName = true;
        this._renderHeader();
        const input = s.querySelector('.name-input');
        input?.focus();
        input?.select();
        return;
      }

      if (action === 'edit-field') {
        const key = btn.dataset.fieldKey;
        if (key) {
          this._editingFieldId = key;
          this._renderFields();
          const input = s.querySelector('.field-edit-input');
          input?.focus();
          input?.select();
        }
        return;
      }

      if (action === 'reveal') {
        const valueId = btn.dataset.valueId;
        if (!valueId) return;
        if (this._revealedValues[valueId]) {
          delete this._revealedValues[valueId];
          this._renderFields();
        } else {
          api.revealFieldValue(this._item.id, valueId).then(result => {
            this._revealedValues[valueId] = result.value;
            this._renderFields();
          }).catch(err => console.error('Failed to reveal:', err));
        }
        return;
      }

      if (action === 'copy') {
        const key = btn.dataset.fieldKey;
        if (key) this._handleCopy(key);
        return;
      }

      if (action === 'del-field') {
        const valueId = btn.dataset.valueId;
        if (valueId) {
          this.dispatchEvent(new CustomEvent('field-delete-standalone', {
            bubbles: true, composed: true,
            detail: { itemId: this._item.id, valueId },
          }));
        }
        return;
      }

      if (action === 'add-field') {
        this._addingField = true;
        this._renderFields();
        s.querySelector('.new-field-name')?.focus();
        return;
      }

      if (action === 'save-new-field') {
        this._saveNewField();
        return;
      }

      if (action === 'cancel-new-field') {
        this._addingField = false;
        this._renderFields();
        return;
      }
    });

    // Blur → save inline edits
    s.addEventListener('blur', (e) => {
      if (e.target.classList.contains('name-input')) {
        this._saveName(e.target.value);
      }
      if (e.target.classList.contains('field-edit-input')) {
        const key = e.target.dataset.editKey;
        this._saveFieldValue(key, e.target.value);
      }
    }, true);

    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.target.classList.contains('name-input') || e.target.classList.contains('field-edit-input')) {
          e.preventDefault();
          e.target.blur();
        }
        if (e.target.classList.contains('new-field-value')) {
          e.preventDefault();
          this._saveNewField();
        }
      }
      if (e.key === 'Escape') {
        if (e.target.classList.contains('name-input')) {
          this._editingName = false;
          this._renderHeader();
        }
        if (e.target.classList.contains('field-edit-input')) {
          this._editingFieldId = null;
          this._renderFields();
        }
        if (e.target.closest('.add-field-form')) {
          this._addingField = false;
          this._renderFields();
        }
      }
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  _saveName(newName) {
    const name = newName.trim();
    this._editingName = false;
    if (!name || name === this._item.name) {
      this._renderHeader();
      return;
    }
    this.dispatchEvent(new CustomEvent('item-update', {
      bubbles: true, composed: true,
      detail: { itemId: this._item.id, updates: { name } },
    }));
  }

  _saveFieldValue(key, newValue) {
    this._editingFieldId = null;
    const field = this._findField(key);
    if (!field) { this._renderFields(); return; }

    // Skip if unchanged (non-secret)
    if (field.field_type !== 'secret' && newValue === (field.field_value || '')) {
      this._renderFields();
      return;
    }
    // Skip blank secret if already has value (keep current)
    if (field.field_type === 'secret' && !newValue && field.has_value) {
      this._renderFields();
      return;
    }

    this.dispatchEvent(new CustomEvent('field-inline-save', {
      bubbles: true, composed: true,
      detail: {
        itemId: this._item.id,
        valueId: field.id || null,
        templateId: field.template_id || null,
        value: newValue,
        fieldName: field.field_name,
        fieldType: field.field_type,
      },
    }));
  }

  _saveNewField() {
    const nameInput = this.shadow.querySelector('.new-field-name');
    const fieldName = nameInput?.value.trim();
    if (!fieldName) { nameInput?.focus(); return; }

    const fieldType = this.shadow.querySelector('.new-field-type')?.value || 'text';
    const value = this.shadow.querySelector('.new-field-value')?.value || '';

    this._addingField = false;

    this.dispatchEvent(new CustomEvent('field-add-standalone', {
      bubbles: true, composed: true,
      detail: { itemId: this._item.id, fieldName, fieldType, value },
    }));
  }

  async _handleCopy(fieldKey) {
    const field = this._findField(fieldKey);
    if (!field || !field.has_value) return;

    let value;
    if (field.field_type === 'secret') {
      if (field.id && this._revealedValues[field.id]) {
        value = this._revealedValues[field.id];
      } else if (field.id) {
        try {
          const result = await api.revealFieldValue(this._item.id, field.id);
          value = result.value;
          this._revealedValues[field.id] = value;
          this._renderFields();
        } catch { return; }
      }
    } else {
      value = field.field_value;
    }

    if (value) {
      await navigator.clipboard.writeText(value).catch(() => {});
      this._copiedFieldId = fieldKey;
      this._renderFields();
      setTimeout(() => {
        this._copiedFieldId = null;
        this._renderFields();
      }, 1500);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  _render() {
    if (!this._item) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <div class="card">
        <div class="card-header" id="card-header"></div>
        <div class="card-fields" id="card-fields"></div>
      </div>
    `;
    this._renderHeader();
    this._renderFields();
  }

  _renderHeader() {
    const el = this.shadow.getElementById('card-header');
    if (!el) return;
    const it = this._item;

    if (this._editingName) {
      el.innerHTML = `
        <div class="lock-icon">${icon('lock', 18)}</div>
        <div class="header-info">
          <input class="name-input" value="${this._escAttr(it.name)}" />
          ${this._categoryName ? `<div class="category-badge">${this._esc(this._categoryName)}</div>` : ''}
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="lock-icon">${icon('lock', 18)}</div>
        <div class="header-info">
          <div class="item-name" data-action="edit-name">${this._esc(it.name)}</div>
          ${this._categoryName ? `<div class="category-badge">${this._esc(this._categoryName)}</div>` : ''}
        </div>
        <div class="header-actions">
          <button class="icon-btn ${it.is_favorite ? 'active' : ''}" data-action="favourite"
            title="${it.is_favorite ? 'Unfavourite' : 'Favourite'}">
            ${icon('star', 14)}
          </button>
          <button class="icon-btn delete" data-action="delete" title="Delete">
            ${icon('trash', 14)}
          </button>
        </div>
      `;
    }
  }

  _renderFields() {
    const el = this.shadow.getElementById('card-fields');
    if (!el) return;

    const sections = this._getGroupedSections();
    const hasMultipleSections = sections.length > 1;
    let html = '';

    for (const section of sections) {
      if (hasMultipleSections) {
        html += `<div class="section-label">${this._esc(section.name)}</div>`;
      }
      for (const field of section.fields) {
        html += this._fieldRowHTML(field);
      }
    }

    if (this._addingField) {
      html += `
        <div class="add-field-form">
          <div class="add-field-row">
            <input class="new-field-name" placeholder="Field name" />
            <select class="new-field-type">
              ${FIELD_TYPES.map(t => `<option>${t}</option>`).join('')}
            </select>
          </div>
          <div class="add-field-row">
            <input class="new-field-value" placeholder="Value\u2026" />
          </div>
          <div class="add-field-actions">
            <button class="save-field-btn" data-action="save-new-field">Save</button>
            <button class="cancel-field-btn" data-action="cancel-new-field">Cancel</button>
          </div>
        </div>
      `;
    } else {
      html += `<button class="add-field-btn" data-action="add-field">${icon('plus', 13)} Add field</button>`;
    }

    el.innerHTML = html;
  }

  _fieldRowHTML(field) {
    const isSecret = field.field_type === 'secret';
    const isEditing = this._editingFieldId === field.key;
    const isCopied = this._copiedFieldId === field.key;
    const revealed = field.id ? this._revealedValues[field.id] : null;
    const isStandalone = !field.template_id;

    let valueHTML;
    if (isEditing) {
      const editVal = isSecret ? '' : (revealed || field.field_value || '');
      const ph = isSecret && field.has_value ? 'Leave blank to keep current' : 'Enter value\u2026';
      valueHTML = `<input class="field-edit-input" data-edit-key="${field.key}"
        ${isSecret ? 'type="password"' : ''}
        value="${this._escAttr(editVal)}"
        placeholder="${this._escAttr(ph)}" />`;
    } else if (!field.has_value) {
      valueHTML = `<span class="field-value empty" data-action="edit-field" data-field-key="${field.key}">Click to set</span>`;
    } else if (isSecret && !revealed) {
      valueHTML = `<span class="field-value masked" data-action="edit-field" data-field-key="${field.key}">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>`;
    } else {
      const displayVal = revealed || field.field_value || '';
      valueHTML = `<span class="field-value" data-action="edit-field" data-field-key="${field.key}">${this._esc(displayVal)}</span>`;
    }

    const actions = [];
    if (!isEditing && field.has_value) {
      if (isSecret) {
        actions.push(`<button class="action-btn" data-action="reveal" data-value-id="${field.id}"
          title="${revealed ? 'Hide' : 'Reveal'}">${icon(revealed ? 'eye-off' : 'eye', 14)}</button>`);
      }
      if (isCopied) {
        actions.push(`<span class="copied-label">Copied!</span>`);
      } else {
        actions.push(`<button class="action-btn" data-action="copy" data-field-key="${field.key}"
          title="Copy">${icon('copy', 14)}</button>`);
      }
    }
    if (!isEditing && isStandalone && field.id) {
      actions.push(`<button class="action-btn del" data-action="del-field" data-value-id="${field.id}"
        title="Remove field">${icon('x', 12)}</button>`);
    }

    return `
      <div class="field-row">
        <span class="field-label">${this._esc(field.field_name)}</span>
        ${valueHTML}
        <div class="field-actions">${actions.join('')}</div>
      </div>
    `;
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  _escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

customElements.define('pos-vault-item-card', PosVaultItemCard);
