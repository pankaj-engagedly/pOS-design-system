import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .wrapper {
    display: flex;
    align-items: center;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    background-color: var(--pos-color-background-primary);
    transition: border-color 0.15s ease;
    overflow: hidden;
  }

  .wrapper:focus-within {
    border-color: var(--pos-color-action-primary);
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 1px;
  }

  input {
    flex: 1;
    font-family: var(--pos-font-family-default);
    color: var(--pos-color-text-primary);
    background: transparent;
    border: none;
    outline: none;
    min-width: 0;
  }

  /* Sizes */
  :host([size="sm"]) input {
    padding: var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-raw-font-size-xs);
  }
  input {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-sm);
  }
  :host([size="lg"]) input {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-md);
  }

  input::placeholder {
    color: var(--pos-color-text-disabled);
  }

  input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :host([disabled]) .wrapper {
    opacity: 0.45;
    background-color: var(--pos-color-background-secondary);
  }
`;

class UiInput extends PosBaseElement {
  static get observedAttributes() {
    return ['type', 'value', 'placeholder', 'disabled', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `<div class="wrapper"><input /></div>`;
    this._input = this.shadow.querySelector('input');
    this._syncAttributes();

    this._input.addEventListener('change', () => {
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  attributeChangedCallback() {
    if (!this._input) return;
    this._syncAttributes();
  }

  _syncAttributes() {
    const input = this._input;
    input.type        = this.getAttribute('type') || 'text';
    input.placeholder = this.getAttribute('placeholder') || '';
    input.disabled    = this.hasAttribute('disabled');

    const attrVal = this.getAttribute('value');
    if (attrVal !== null && input.value !== attrVal) {
      input.value = attrVal;
    }
  }

  get value() {
    return this._input ? this._input.value : '';
  }

  set value(v) {
    if (this._input) this._input.value = v;
  }
}

define('ui-input', UiInput);
