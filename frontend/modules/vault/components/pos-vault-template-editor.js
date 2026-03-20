// pos-vault-template-editor — Modal for managing category field templates
// Table-like layout: inline editing, always-visible add row at bottom
// Dispatches: template-create, template-update, template-delete, template-reorder, editor-close

import { icon } from '../../../shared/utils/icons.js';

const FIELD_TYPES = ['text', 'secret', 'url', 'email', 'phone', 'notes'];

const TYPE_ICONS = {
  text: 'file-text',
  secret: 'key',
  url: 'globe',
  email: 'mail',
  phone: 'phone',
  notes: 'file-text',
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.35);
    z-index: 200;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.15s;
  }
  :host([open]) {
    visibility: visible;
    opacity: 1;
  }

  .panel {
    background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-lg, 10px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }

  .panel-header {
    display: flex;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--pos-color-border-default);
    gap: var(--pos-space-sm);
  }
  .panel-title {
    flex: 1;
    font-size: var(--pos-font-size-md);
    font-weight: var(--pos-font-weight-semibold);
    color: var(--pos-color-text-primary);
    margin: 0;
  }
  .close-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    border: none; border-radius: var(--pos-radius-sm);
    background: transparent; color: var(--pos-color-text-muted);
    cursor: pointer; padding: 0;
  }
  .close-btn:hover { background: var(--pos-color-background-secondary); color: var(--pos-color-text-primary); }
  .close-btn svg { pointer-events: none; }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hint {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
    padding: 8px 12px;
    background: var(--pos-color-background-secondary);
    border-radius: var(--pos-radius-sm);
    border-left: 3px solid var(--pos-color-action-primary);
    line-height: 1.5;
  }

  /* ── Table ──────────────────────────────── */
  .tpl-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md, 8px);
    overflow: clip;
  }

  .section-divider {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--pos-color-text-muted);
    font-weight: var(--pos-font-weight-medium);
    padding: 6px 12px;
    background: var(--pos-color-background-secondary);
    border-bottom: 1px solid var(--pos-color-border-default);
  }

  .tpl-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    border-bottom: 1px solid var(--pos-color-border-default);
    min-height: 38px;
    background: var(--pos-color-background-primary);
    transition: background 0.1s;
  }
  .tpl-row:last-child { border-bottom: none; }
  .tpl-row:hover { background: var(--pos-color-background-secondary); }

  .tpl-row .reorder-grip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 0 6px 0 10px;
    color: var(--pos-color-text-muted);
    cursor: grab;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tpl-row:hover .reorder-grip { opacity: 1; }

  .tpl-row .move-btn {
    display: flex; align-items: center; justify-content: center;
    width: 18px; height: 14px;
    border: none; background: transparent;
    color: var(--pos-color-text-muted);
    cursor: pointer; padding: 0;
    border-radius: 2px;
  }
  .tpl-row .move-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-border-default); }
  .tpl-row .move-btn.disabled { opacity: 0.25; pointer-events: none; }
  .tpl-row .move-btn svg { pointer-events: none; }

  .tpl-row .type-icon {
    display: flex; align-items: center;
    padding: 0 8px 0 4px;
    color: var(--pos-color-text-muted);
    flex-shrink: 0;
  }

  .tpl-row .field-name {
    flex: 1;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
    padding: 6px 4px;
    border-radius: var(--pos-radius-sm);
  }
  .tpl-row .field-name:hover { background: color-mix(in srgb, var(--pos-color-action-primary) 8%, transparent); }

  .tpl-row .field-name-input {
    flex: 1;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    padding: 4px 6px;
    outline: none;
    font-family: inherit;
    background: var(--pos-color-background-primary);
    min-width: 0;
    box-sizing: border-box;
  }

  .tpl-row .type-badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 99px;
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    cursor: pointer;
  }
  .tpl-row .type-badge:hover { background: var(--pos-color-border-default); }

  .tpl-row .type-select {
    font-size: 11px;
    padding: 2px 4px;
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    font-family: inherit;
    flex-shrink: 0;
    cursor: pointer;
  }

  .tpl-row .section-badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 99px;
    background: transparent;
    border: 1px solid var(--pos-color-border-default);
    color: var(--pos-color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    margin: 0 4px;
    cursor: pointer;
  }
  .tpl-row .section-badge:hover { border-color: var(--pos-color-text-muted); }

  .tpl-row .section-input {
    font-size: 11px;
    padding: 2px 6px;
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    font-family: inherit;
    width: 80px;
    flex-shrink: 0;
    margin: 0 4px;
    box-sizing: border-box;
  }

  .tpl-row .row-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 0 8px 0 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tpl-row:hover .row-actions { opacity: 1; }
  .tpl-row .action-btn {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    border: none; border-radius: var(--pos-radius-sm);
    background: transparent; color: var(--pos-color-text-muted);
    cursor: pointer; padding: 0;
  }
  .tpl-row .action-btn:hover { background: var(--pos-color-border-default); color: var(--pos-color-text-primary); }
  .tpl-row .action-btn.delete:hover { color: var(--pos-color-priority-urgent, #dc2626); }
  .tpl-row .action-btn svg { pointer-events: none; }

  /* ── Add row ────────────────────────────── */
  .add-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    min-height: 38px;
    background: var(--pos-color-background-secondary);
    border-top: 1px solid var(--pos-color-border-default);
  }
  .add-row .add-icon {
    display: flex; align-items: center;
    padding: 0 8px 0 12px;
    color: var(--pos-color-action-primary);
    flex-shrink: 0;
  }
  .add-row input, .add-row select {
    padding: 6px 8px;
    border: none;
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: transparent;
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
  .add-row input::placeholder { color: var(--pos-color-text-muted); }
  .add-row .add-name { flex: 1; min-width: 0; }
  .add-row select {
    font-size: 11px;
    color: var(--pos-color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    padding: 4px 2px;
  }
  .add-row .add-section {
    width: 80px;
    flex-shrink: 0;
    font-size: 11px;
  }
  .add-row .add-btn {
    display: flex; align-items: center; justify-content: center;
    padding: 4px 10px;
    margin: 0 8px 0 4px;
    border: none; border-radius: var(--pos-radius-sm);
    background: var(--pos-color-action-primary);
    color: #fff;
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.1s;
  }
  .add-row .add-btn.ready { opacity: 1; }
  .add-row .add-btn:hover { opacity: 0.88; }

  /* ── Empty state ────────────────────────── */
  .empty-msg {
    text-align: center;
    color: var(--pos-color-text-muted);
    font-size: var(--pos-font-size-sm);
    padding: 20px 12px;
  }
`);

class PosVaultTemplateEditor extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._category = null;
    this._templates = [];
    this._editingNameId = null;
    this._editingTypeId = null;
    this._editingSectionId = null;
    this._lastSection = 'General';
    this._eventsBound = false;
  }

  open(category, templates) {
    this._category = category;
    this._templates = templates || [];
    this._editingNameId = null;
    this._editingTypeId = null;
    this._editingSectionId = null;
    this._render();
    this._bindEvents();
    this.setAttribute('open', '');
    setTimeout(() => this.shadow.querySelector('.add-name')?.focus(), 50);
  }

  close() {
    this.removeAttribute('open');
    this._category = null;
    this._templates = [];
    this._eventsBound = false;
  }

  updateTemplates(templates) {
    this._templates = templates || [];
    this._editingNameId = null;
    this._editingTypeId = null;
    this._editingSectionId = null;
    this._renderBody();
    setTimeout(() => {
      const nameInput = this.shadow.querySelector('.add-name');
      if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    }, 0);
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Backdrop close
    this.addEventListener('click', (e) => {
      if (e.composedPath()[0] === this) {
        this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
      }
    });

    const s = this.shadow;

    s.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const tplId = btn.dataset.tplId;

      if (action === 'close') {
        this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
        return;
      }

      if (action === 'edit-name') {
        this._editingNameId = tplId;
        this._renderBody();
        const input = s.querySelector('.field-name-input');
        input?.focus();
        input?.select();
        return;
      }

      if (action === 'edit-type') {
        this._editingTypeId = tplId;
        this._renderBody();
        s.querySelector('.type-select')?.focus();
        return;
      }

      if (action === 'edit-section') {
        this._editingSectionId = tplId;
        this._renderBody();
        const input = s.querySelector('.section-input');
        input?.focus();
        input?.select();
        return;
      }

      if (action === 'delete-tpl') {
        this.dispatchEvent(new CustomEvent('template-delete', {
          bubbles: true, composed: true,
          detail: { templateId: tplId },
        }));
        return;
      }

      if (action === 'move-up') {
        this._moveTemplate(tplId, -1);
        return;
      }

      if (action === 'move-down') {
        this._moveTemplate(tplId, 1);
        return;
      }

      if (action === 'submit-add') {
        this._submitAdd();
        return;
      }
    });

    // Inline edit saves
    s.addEventListener('blur', (e) => {
      if (e.target.classList.contains('field-name-input')) {
        const tplId = e.target.dataset.tplId;
        const name = e.target.value.trim();
        this._editingNameId = null;
        if (name) {
          const tpl = this._templates.find(t => t.id === tplId);
          if (tpl && name !== tpl.field_name) {
            this.dispatchEvent(new CustomEvent('template-update', {
              bubbles: true, composed: true,
              detail: { templateId: tplId, updates: { field_name: name } },
            }));
            return; // will re-render via updateTemplates
          }
        }
        this._renderBody();
      }

      if (e.target.classList.contains('section-input')) {
        const tplId = e.target.dataset.tplId;
        const section = e.target.value.trim();
        this._editingSectionId = null;
        if (section) {
          const tpl = this._templates.find(t => t.id === tplId);
          if (tpl && section !== tpl.section) {
            this._lastSection = section;
            this.dispatchEvent(new CustomEvent('template-update', {
              bubbles: true, composed: true,
              detail: { templateId: tplId, updates: { section } },
            }));
            return;
          }
        }
        this._renderBody();
      }
    }, true);

    s.addEventListener('change', (e) => {
      if (e.target.classList.contains('type-select')) {
        const tplId = e.target.dataset.tplId;
        const newType = e.target.value;
        this._editingTypeId = null;
        const tpl = this._templates.find(t => t.id === tplId);
        if (tpl && newType !== tpl.field_type) {
          this.dispatchEvent(new CustomEvent('template-update', {
            bubbles: true, composed: true,
            detail: { templateId: tplId, updates: { field_type: newType } },
          }));
          return;
        }
        this._renderBody();
      }
    });

    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.target.classList.contains('field-name-input') ||
            e.target.classList.contains('section-input')) {
          e.preventDefault();
          e.target.blur();
        }
        if (e.target.classList.contains('add-name') ||
            e.target.classList.contains('add-section')) {
          e.preventDefault();
          this._submitAdd();
        }
      }
      if (e.key === 'Escape') {
        if (e.target.classList.contains('field-name-input') ||
            e.target.classList.contains('section-input') ||
            e.target.classList.contains('type-select')) {
          this._editingNameId = null;
          this._editingTypeId = null;
          this._editingSectionId = null;
          this._renderBody();
        } else {
          this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
        }
      }
    });

    // Live-validate add button
    s.addEventListener('input', (e) => {
      if (e.target.classList.contains('add-name')) {
        const btn = s.querySelector('.add-btn');
        if (btn) btn.classList.toggle('ready', !!e.target.value.trim());
      }
    });
  }

  _submitAdd() {
    const nameEl = this.shadow.querySelector('.add-name');
    const typeEl = this.shadow.querySelector('.add-type');
    const sectionEl = this.shadow.querySelector('.add-section');
    const name = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    const section = sectionEl?.value.trim() || this._lastSection;
    this._lastSection = section;

    this.dispatchEvent(new CustomEvent('template-create', {
      bubbles: true, composed: true,
      detail: {
        field_name: name,
        field_type: typeEl?.value || 'text',
        section,
      },
    }));
  }

  _moveTemplate(tplId, direction) {
    const idx = this._templates.findIndex(t => t.id === tplId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this._templates.length) return;
    const reordered = [...this._templates];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    this._templates = reordered;
    this._renderBody();
    this.dispatchEvent(new CustomEvent('template-reorder', {
      bubbles: true, composed: true,
      detail: { orderedIds: reordered.map(t => t.id) },
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────────

  _render() {
    if (!this._category) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Field Templates \u2014 ${this._esc(this._category.name)}</h3>
          <button class="close-btn" data-action="close">${icon('x', 16)}</button>
        </div>
        <div class="panel-body" id="panel-body"></div>
      </div>
    `;
    this._renderBody();
  }

  /** Unique section names from current templates */
  _existingSections() {
    const set = new Set();
    for (const t of this._templates) if (t.section) set.add(t.section);
    return [...set];
  }

  _sectionDatalistHTML(id) {
    return `<datalist id="${id}">${this._existingSections().map(s =>
      `<option value="${this._escAttr(s)}">`).join('')}</datalist>`;
  }

  _renderBody() {
    const body = this.shadow.getElementById('panel-body');
    if (!body) return;

    const templates = this._templates;

    // Group by section for dividers
    const groups = [];
    let currentSection = null;
    templates.forEach((t, idx) => {
      if (t.section !== currentSection) {
        groups.push({ type: 'section', name: t.section });
        currentSection = t.section;
      }
      groups.push({ type: 'field', template: t, idx, total: templates.length });
    });

    let tableHTML = '';
    if (templates.length === 0) {
      tableHTML = `<div class="empty-msg">No fields yet \u2014 add your first one below.</div>`;
    } else {
      tableHTML = groups.map(g => {
        if (g.type === 'section') {
          return `<div class="section-divider">${this._esc(g.name)}</div>`;
        }
        return this._templateRowHTML(g.template, g.idx, g.total);
      }).join('');
    }

    // Add row always visible
    const addRowHTML = `
      <div class="add-row">
        <span class="add-icon">${icon('plus', 14)}</span>
        <input class="add-name" placeholder="Field name\u2026" />
        <select class="add-type">
          ${FIELD_TYPES.map(ft => `<option value="${ft}">${ft}</option>`).join('')}
        </select>
        <input class="add-section" placeholder="Section" value="${this._escAttr(this._lastSection)}" list="dl-add-section" />
        ${this._sectionDatalistHTML('dl-add-section')}
        <button class="add-btn" data-action="submit-add">Add</button>
      </div>
    `;

    body.innerHTML = `
      <div class="hint">
        These fields appear in every <strong>${this._esc(this._category.name)}</strong> item.
        Click any field name, type, or section to edit inline.
      </div>
      <div class="tpl-table">
        ${tableHTML}
        ${addRowHTML}
      </div>
    `;
  }

  _templateRowHTML(t, idx, total) {
    const isEditingName = this._editingNameId === t.id;
    const isEditingType = this._editingTypeId === t.id;
    const isEditingSection = this._editingSectionId === t.id;
    const iconName = TYPE_ICONS[t.field_type] || 'file-text';

    const nameHTML = isEditingName
      ? `<input class="field-name-input" data-tpl-id="${t.id}" value="${this._escAttr(t.field_name)}" />`
      : `<span class="field-name" data-action="edit-name" data-tpl-id="${t.id}">${this._esc(t.field_name)}</span>`;

    const typeHTML = isEditingType
      ? `<select class="type-select" data-tpl-id="${t.id}">
          ${FIELD_TYPES.map(ft => `<option value="${ft}" ${ft === t.field_type ? 'selected' : ''}>${ft}</option>`).join('')}
        </select>`
      : `<span class="type-badge" data-action="edit-type" data-tpl-id="${t.id}">${t.field_type}</span>`;

    const sectionHTML = isEditingSection
      ? `<input class="section-input" data-tpl-id="${t.id}" value="${this._escAttr(t.section)}" list="dl-edit-section" />
         ${this._sectionDatalistHTML('dl-edit-section')}`
      : `<span class="section-badge" data-action="edit-section" data-tpl-id="${t.id}">${this._esc(t.section)}</span>`;

    return `
      <div class="tpl-row">
        <div class="reorder-grip">
          <button class="move-btn ${idx === 0 ? 'disabled' : ''}" data-action="move-up" data-tpl-id="${t.id}">${icon('chevron-up', 12)}</button>
          <button class="move-btn ${idx === total - 1 ? 'disabled' : ''}" data-action="move-down" data-tpl-id="${t.id}">${icon('chevron-down', 12)}</button>
        </div>
        <span class="type-icon">${icon(iconName, 14)}</span>
        ${nameHTML}
        ${typeHTML}
        ${sectionHTML}
        <div class="row-actions">
          <button class="action-btn delete" data-action="delete-tpl" data-tpl-id="${t.id}" title="Delete">${icon('trash', 13)}</button>
        </div>
      </div>
    `;
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

customElements.define('pos-vault-template-editor', PosVaultTemplateEditor);
