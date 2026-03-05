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

  .track {
    position: relative;
    flex-shrink: 0;
    border-radius: var(--pos-radius-full);
    background-color: var(--pos-color-border-default);
    transition: background-color 0.2s ease;
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    border-radius: 50%;
    background-color: var(--pos-color-background-primary);
    box-shadow: var(--pos-shadow-sm);
    transition: transform 0.2s ease;
  }

  /* Sizes */
  :host(:not([size])) .track,
  :host([size="md"]) .track {
    width: 36px;
    height: 20px;
  }
  :host(:not([size])) .thumb,
  :host([size="md"]) .thumb {
    width: 16px;
    height: 16px;
  }
  :host(:not([size])) input:checked ~ .track .thumb,
  :host([size="md"]) input:checked ~ .track .thumb {
    transform: translateX(16px);
  }

  :host([size="sm"]) .track {
    width: 28px;
    height: 16px;
  }
  :host([size="sm"]) .thumb {
    width: 12px;
    height: 12px;
  }
  :host([size="sm"]) input:checked ~ .track .thumb {
    transform: translateX(12px);
  }

  :host([size="lg"]) .track {
    width: 44px;
    height: 24px;
  }
  :host([size="lg"]) .thumb {
    width: 20px;
    height: 20px;
  }
  :host([size="lg"]) input:checked ~ .track .thumb {
    transform: translateX(20px);
  }

  /* Checked state */
  input:checked ~ .track {
    background-color: var(--pos-color-action-primary);
  }

  /* Focus */
  input:focus-visible ~ .track {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }

  /* Disabled */
  :host([disabled]) label {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

class UiToggle extends PosBaseElement {
  static get observedAttributes() {
    return ['checked', 'disabled', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <label>
        <input type="checkbox" role="switch" />
        <span class="track"><span class="thumb"></span></span>
        <slot></slot>
      </label>
    `;

    this._input = this.shadow.querySelector('input');
    this._syncState();

    this._input.addEventListener('change', () => {
      this._reflectChecked(this._input.checked);
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
}

define('ui-toggle', UiToggle);
