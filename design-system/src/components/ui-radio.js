import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-flex;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-sm);
    cursor: pointer;
    font-family: var(--pos-font-family-default);
    font-size: var(--pos-font-size-sm);
    line-height: var(--pos-line-height-normal);
    color: var(--pos-color-text-primary);
  }

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border: 2px solid var(--pos-color-border-default);
    border-radius: 50%;
    background-color: var(--pos-color-background-primary);
    transition: border-color 0.15s ease;
  }

  input:checked + .circle {
    border-color: var(--pos-color-action-primary);
  }

  .circle::after {
    content: '';
    display: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--pos-color-action-primary);
  }

  input:checked + .circle::after {
    display: block;
  }

  input:focus-visible + .circle {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }

  /* Disabled */
  :host([disabled]) label {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

class UiRadio extends PosBaseElement {
  static get observedAttributes() {
    return ['name', 'value', 'checked', 'disabled'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <label>
        <input type="radio" />
        <span class="circle"></span>
        <slot></slot>
      </label>
    `;

    this._input = this.shadow.querySelector('input');
    this._syncState();

    this._input.addEventListener('change', () => {
      if (this._input.checked) {
        // Deselect sibling radios with the same name
        const name = this.getAttribute('name');
        if (name) {
          document.querySelectorAll(`ui-radio[name="${name}"]`).forEach(r => {
            if (r !== this && r.hasAttribute('checked')) {
              r.removeAttribute('checked');
            }
          });
        }
        this.setAttribute('checked', '');
      }
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  attributeChangedCallback() {
    if (this._input) this._syncState();
  }

  _syncState() {
    this._input.name = this.getAttribute('name') || '';
    this._input.value = this.getAttribute('value') || '';
    this._input.checked = this.hasAttribute('checked');
    this._input.disabled = this.hasAttribute('disabled');
  }

  get checked() {
    return this._input ? this._input.checked : this.hasAttribute('checked');
  }

  set checked(val) {
    if (val) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(v) {
    this.setAttribute('value', v);
  }
}

define('ui-radio', UiRadio);
