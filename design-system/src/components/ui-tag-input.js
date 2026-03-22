import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const ICON_PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const CSS = `
  :host {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .label {
    font-size: 11px;
    color: var(--pos-color-text-tertiary, #aaa);
    margin-right: 2px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--pos-color-action-primary-subtle, color-mix(in srgb, var(--pos-color-action-primary, #4361ee) 10%, transparent));
    color: var(--pos-color-action-primary, #4361ee);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
  }

  .badge-remove {
    cursor: pointer;
    opacity: 0.6;
    border: none;
    background: none;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    color: inherit;
    display: inline-flex;
    align-items: center;
  }
  .badge-remove:hover { opacity: 1; }

  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: 1px dashed var(--pos-color-border-default, #ddd);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    background: transparent;
    color: var(--pos-color-text-secondary, #777);
    cursor: pointer;
    font-family: inherit;
  }
  .add-btn:hover {
    border-color: var(--pos-color-action-primary, #4361ee);
    color: var(--pos-color-action-primary, #4361ee);
  }

  .input-wrap {
    position: relative;
    min-width: 120px;
    flex: 1;
  }

  .input {
    border: 1px solid var(--pos-color-action-primary, #4361ee);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    background: var(--pos-color-background-primary, #fff);
    color: var(--pos-color-text-primary, #1a1a2e);
    font-family: inherit;
  }

  .suggestions {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--pos-color-background-primary, #fff);
    border: 1px solid var(--pos-color-border-default, #e5e5e5);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    max-height: 150px;
    overflow-y: auto;
    z-index: 100;
    margin-bottom: 2px;
    display: none;
  }
  .suggestions.visible { display: block; }

  .suggestion {
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .suggestion:hover, .suggestion.highlighted { background: var(--pos-color-background-secondary, #f5f5f5); }
  .new-badge {
    font-size: 10px;
    color: var(--pos-color-action-primary, #4361ee);
    font-style: italic;
  }
`;

class UiTagInput extends PosBaseElement {
  constructor() {
    super();
    this.adoptStyles(CSS);
    this._tags = [];       // [{ id, name }]
    this._allTags = [];    // all available tags for suggestions
    this._adding = false;
    this._query = '';
    this._highlightIndex = -1;
    this._lastSuggestions = [];
  }

  /** @param {Array<{id: string, name: string}>} val */
  set tags(val) {
    this._tags = val || [];
    this._render();
  }

  get tags() { return this._tags; }

  /** @param {Array<{id?: string, name: string}>} val — all available tags for search */
  set allTags(val) {
    this._allTags = val || [];
  }

  get allTags() { return this._allTags; }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const label = this.getAttribute('label');

    this.shadow.innerHTML = `
      ${label ? `<span class="label">${this._esc(label)}</span>` : ''}
      ${this._tags.map(t => `
        <span class="badge" data-tag-id="${t.id}">
          ${this._esc(t.name)}
          <button class="badge-remove" data-action="remove" data-tag-id="${t.id}" title="Remove">${ICON_X}</button>
        </span>
      `).join('')}
      ${this._adding
        ? `<div class="input-wrap">
            <input class="input" id="tag-input" placeholder="Search or create tag\u2026" value="${this._escAttr(this._query)}" />
            <div class="suggestions" id="suggestions"></div>
          </div>`
        : `<button class="add-btn" data-action="add">${ICON_PLUS} Add</button>`
      }
    `;

    if (this._adding) {
      setTimeout(() => {
        const input = this.shadow.getElementById('tag-input');
        input?.focus();
        if (this._query) this._renderSuggestions();
      }, 0);
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Remove tag
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('tag-remove', {
          bubbles: true, composed: true,
          detail: { tagId: removeBtn.dataset.tagId },
        }));
        return;
      }

      // Add button
      if (e.target.closest('[data-action="add"]')) {
        this._adding = true;
        this._query = '';
        this._render();
        return;
      }

      // Suggestion click
      const suggestion = e.target.closest('.suggestion');
      if (suggestion) {
        const name = suggestion.dataset.name;
        if (name) {
          this._selectTag(name);
        }
        return;
      }
    });

    this.shadow.addEventListener('input', (e) => {
      if (e.target.id === 'tag-input') {
        this._query = e.target.value;
        this._renderSuggestions();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.id !== 'tag-input') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this._lastSuggestions.length > 0) {
          this._highlightIndex = Math.min(this._highlightIndex + 1, this._lastSuggestions.length - 1);
          this._updateHighlight();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this._lastSuggestions.length > 0) {
          this._highlightIndex = Math.max(this._highlightIndex - 1, 0);
          this._updateHighlight();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this._highlightIndex >= 0 && this._highlightIndex < this._lastSuggestions.length) {
          this._selectTag(this._lastSuggestions[this._highlightIndex].name);
        } else {
          const name = e.target.value.trim();
          if (name) this._selectTag(name);
        }
        return;
      }

      if (e.key === 'Escape') {
        this._adding = false;
        this._query = '';
        this._highlightIndex = -1;
        this._render();
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.id === 'tag-input') {
        // Delay to allow suggestion click to fire
        setTimeout(() => {
          if (this._adding) {
            this._adding = false;
            this._query = '';
            this._render();
          }
        }, 150);
      }
    });
  }

  _updateHighlight() {
    const items = this.shadow.querySelectorAll('.suggestion');
    items.forEach((el, i) => {
      el.classList.toggle('highlighted', i === this._highlightIndex);
      if (i === this._highlightIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  _selectTag(name) {
    this._adding = false;
    this._query = '';
    this._highlightIndex = -1;
    this._lastSuggestions = [];
    this._render();
    this.dispatchEvent(new CustomEvent('tag-add', {
      bubbles: true, composed: true,
      detail: { name },
    }));
  }

  _renderSuggestions() {
    const container = this.shadow.getElementById('suggestions');
    if (!container) return;

    const q = this._query.toLowerCase().trim();
    if (!q) {
      container.classList.remove('visible');
      this._lastSuggestions = [];
      this._highlightIndex = -1;
      return;
    }

    const existingNames = new Set(this._tags.map(t => t.name.toLowerCase()));
    const matches = this._allTags
      .filter(t => t.name.toLowerCase().includes(q) && !existingNames.has(t.name.toLowerCase()))
      .slice(0, 8)
      .map(t => ({ name: t.name, isNew: false }));

    const exactMatch = this._allTags.some(t => t.name.toLowerCase() === q) || existingNames.has(q);
    if (!exactMatch && q.length > 0) {
      matches.push({ name: this._query.trim(), isNew: true });
    }

    if (!matches.length) {
      container.classList.remove('visible');
      this._lastSuggestions = [];
      this._highlightIndex = -1;
      return;
    }

    this._lastSuggestions = matches;
    this._highlightIndex = -1;

    container.innerHTML = matches.map((s, i) => `
      <div class="suggestion" data-name="${this._escAttr(s.name)}">
        ${this._esc(s.name)}
        ${s.isNew ? '<span class="new-badge">new</span>' : ''}
      </div>
    `).join('');
    container.classList.add('visible');
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

define('ui-tag-input', UiTagInput);
