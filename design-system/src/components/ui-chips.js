import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

// ui-chips — Horizontal filter/toggle chip bar
//
// Properties:
//   .items  = [{ key: string, label: string }, ...]
//   .active = string  (key of the active chip)
//
// Attributes:
//   active — initial active chip key
//
// Events:
//   chip-select → { detail: { key: string } }
//
// Usage:
//   <ui-chips active="all"></ui-chips>
//   el.items = [{ key: 'all', label: 'All' }, { key: 'today', label: 'Today' }];

const CSS = `
  :host {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    flex-wrap: wrap;
  }

  .chip {
    -webkit-appearance: none;
    appearance: none;
    padding: var(--pos-space-xs) var(--pos-space-sm);
    border-radius: var(--pos-radius-full);
    border: 1px solid var(--pos-color-border-default);
    background: transparent;
    font-size: var(--pos-font-size-xs);
    font-family: var(--pos-font-family-default);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    line-height: var(--pos-line-height-normal);
    user-select: none;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .chip:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }

  .chip.active {
    background: var(--pos-color-action-primary);
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-background-primary);
    font-weight: var(--pos-font-weight-medium);
  }

  .chip:focus-visible {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }
`;

class UiChips extends PosBaseElement {
  static get observedAttributes() { return ['active']; }

  constructor() {
    super();
    this._items = [];
    this._active = null;
  }

  set items(val) {
    this._items = val || [];
    this._render();
  }

  set active(val) {
    this._active = val;
    this._updateActive();
  }

  get active() { return this._active; }

  connectedCallback() {
    this.adoptStyles(CSS);
    if (this.hasAttribute('active')) this._active = this.getAttribute('active');
    this._bindEvents();
    this._render();
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'active' && this.isConnected) {
      this._active = val;
      this._updateActive();
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      this._active = chip.dataset.key;
      this._updateActive();
      this.dispatchEvent(new CustomEvent('chip-select', {
        bubbles: true, composed: true,
        detail: { key: this._active },
      }));
    });
  }

  // Fast path: toggle active class without re-rendering
  _updateActive() {
    this.shadow.querySelectorAll('.chip').forEach(el => {
      el.classList.toggle('active', el.dataset.key === this._active);
    });
  }

  _render() {
    this.shadow.innerHTML = this._items.map(item => `
      <button class="chip ${this._active === item.key ? 'active' : ''}"
              data-key="${item.key}">${item.label}</button>
    `).join('');
  }
}

define('ui-chips', UiChips);
