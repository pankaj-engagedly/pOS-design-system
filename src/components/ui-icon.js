import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const COLOR_MAP = {
  'action': '--pos-color-action-primary',
  'secondary': '--pos-color-text-secondary',
  'disabled': '--pos-color-text-disabled',
  'accent-purple': '--pos-color-accent-purple',
  'accent-orange': '--pos-color-accent-orange',
};

const CSS = `
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
  }

  :host([data-color]) {
    color: var(--_icon-color);
  }

  /* Sizes */
  :host([size="sm"]) {
    width: 16px;
    height: 16px;
    font-size: 16px;
  }
  :host(:not([size])),
  :host([size="md"]) {
    width: 20px;
    height: 20px;
    font-size: 20px;
  }
  :host([size="lg"]) {
    width: 24px;
    height: 24px;
    font-size: 24px;
  }

  ::slotted(*) {
    font-size: inherit;
    line-height: 1;
  }
`;

class UiIcon extends PosBaseElement {
  static get observedAttributes() {
    return ['size', 'color'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `<slot></slot>`;
    this._applyColor();
  }

  attributeChangedCallback() {
    this._applyColor();
  }

  _applyColor() {
    const color = this.getAttribute('color');
    if (color && COLOR_MAP[color]) {
      this.setAttribute('data-color', '');
      this.style.setProperty('--_icon-color', `var(${COLOR_MAP[color]})`);
    } else {
      this.removeAttribute('data-color');
      this.style.removeProperty('--_icon-color');
    }
  }
}

define('ui-icon', UiIcon);
