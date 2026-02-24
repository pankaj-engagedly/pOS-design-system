import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .wrapper {
    display: flex;
    align-items: center;
    border: 1px solid var(--pos-color-border);
    border-radius: 6px;
    background-color: var(--pos-color-bg);
    transition: border-color 0.15s ease;
    overflow: hidden;
  }

  .wrapper:focus-within {
    border-color: var(--pos-color-focus);
    outline: 2px solid var(--pos-color-focus);
    outline-offset: 1px;
  }

  input {
    flex: 1;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 14px;
    color: var(--pos-color-fg);
    background: transparent;
    border: none;
    outline: none;
    min-width: 0;
  }

  input::placeholder {
    color: var(--pos-color-muted);
  }

  input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :host([disabled]) .wrapper {
    opacity: 0.45;
    background-color: var(--pos-color-border);
  }
`;

class UiInput extends PosBaseElement {
  static get observedAttributes() {
    return ['type', 'value', 'placeholder', 'disabled'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `<div class="wrapper"><input /></div>`;
    this._input = this.shadow.querySelector('input');
    this._syncAttributes();
  }

  attributeChangedCallback(name, _old, next) {
    if (!this._input) return;
    this._syncAttributes();
  }

  _syncAttributes() {
    const input = this._input;
    input.type        = this.getAttribute('type') || 'text';
    input.placeholder = this.getAttribute('placeholder') || '';
    input.disabled    = this.hasAttribute('disabled');

    // Sync value attribute only on initial set, not on every keystroke
    const attrVal = this.getAttribute('value');
    if (attrVal !== null && input.value !== attrVal) {
      input.value = attrVal;
    }
  }

  /**
   * value property — reads from / writes to the internal input.
   * Native input/change events already bubble out of Shadow DOM.
   */
  get value() {
    return this._input ? this._input.value : '';
  }

  set value(v) {
    if (this._input) this._input.value = v;
  }
}

define('ui-input', UiInput);
