import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-block;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    outline: none;
    transition: background-color 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;
  }

  /* Variants */
  button[data-variant="solid"],
  button:not([data-variant]) {
    background-color: var(--pos-color-accent);
    color: var(--pos-color-bg);
    border-color: var(--pos-color-accent);
  }
  button[data-variant="solid"]:hover,
  button:not([data-variant]):hover {
    background-color: var(--pos-color-accent-hover);
    border-color: var(--pos-color-accent-hover);
  }

  button[data-variant="outline"] {
    background-color: transparent;
    color: var(--pos-color-accent);
    border-color: var(--pos-color-accent);
  }
  button[data-variant="outline"]:hover {
    background-color: var(--pos-color-accent);
    color: var(--pos-color-bg);
  }

  button[data-variant="ghost"] {
    background-color: transparent;
    color: var(--pos-color-fg);
    border-color: transparent;
  }
  button[data-variant="ghost"]:hover {
    background-color: var(--pos-color-border);
  }

  button[data-variant="danger"] {
    background-color: var(--pos-color-danger);
    color: var(--pos-color-bg);
    border-color: var(--pos-color-danger);
  }
  button[data-variant="danger"]:hover {
    opacity: 0.85;
  }

  /* Disabled */
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Focus ring */
  button:focus-visible {
    outline: 2px solid var(--pos-color-focus);
    outline-offset: 2px;
  }
`;

class UiButton extends PosBaseElement {
  static get observedAttributes() {
    return ['variant', 'disabled'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const variant = this.getAttribute('variant') || 'solid';
    const disabled = this.hasAttribute('disabled');

    // Only set innerHTML once — update attributes on subsequent renders
    if (!this.shadow.querySelector('button')) {
      this.shadow.innerHTML = `<button><slot></slot></button>`;
    }

    const btn = this.shadow.querySelector('button');
    btn.setAttribute('data-variant', variant);
    btn.disabled = disabled;
  }
}

define('ui-button', UiButton);
