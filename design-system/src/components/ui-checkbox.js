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

  .box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border: 2px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background-color: var(--pos-color-background-primary);
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  input:checked + .box {
    background-color: var(--pos-color-action-primary);
    border-color: var(--pos-color-action-primary);
  }

  input:focus-visible + .box {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }

  /* Checkmark */
  .box::after {
    content: '';
    display: none;
  }

  input:checked + .box::after {
    display: block;
    width: 5px;
    height: 9px;
    border: solid var(--pos-color-background-primary);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-top: -1px;
  }

  /* Indeterminate dash */
  :host([indeterminate]) .box {
    background-color: var(--pos-color-action-primary);
    border-color: var(--pos-color-action-primary);
  }

  :host([indeterminate]) .box::after {
    display: block;
    width: 8px;
    height: 0;
    border: solid var(--pos-color-background-primary);
    border-width: 0 0 2px 0;
    transform: none;
    margin-top: 0;
  }

  /* Disabled */
  :host([disabled]) label {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

class UiCheckbox extends PosBaseElement {
  static get observedAttributes() {
    return ['checked', 'disabled', 'indeterminate'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <label>
        <input type="checkbox" />
        <span class="box"></span>
        <slot></slot>
      </label>
    `;

    this._input = this.shadow.querySelector('input');
    this._syncState();

    this._input.addEventListener('change', () => {
      this._reflectChecked(this._input.checked);
      if (this.hasAttribute('indeterminate')) {
        this.removeAttribute('indeterminate');
      }
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  attributeChangedCallback() {
    if (this._input) this._syncState();
  }

  _syncState() {
    this._input.checked = this.hasAttribute('checked');
    this._input.disabled = this.hasAttribute('disabled');
  }

  _reflectChecked(val) {
    if (val) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
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

  get indeterminate() {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate(val) {
    if (val) {
      this.setAttribute('indeterminate', '');
    } else {
      this.removeAttribute('indeterminate');
    }
  }
}

define('ui-checkbox', UiCheckbox);
