import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-block;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--pos-space-xs);
    font-family: var(--pos-font-family-default);
    font-weight: var(--pos-font-weight-medium);
    line-height: var(--pos-line-height-tight);
    border-radius: var(--pos-radius-md);
    border: 1px solid transparent;
    cursor: pointer;
    outline: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;
  }

  /* Sizes */
  button[data-size="sm"] {
    padding: var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-raw-font-size-xs);
  }
  button[data-size="md"],
  button:not([data-size]) {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-sm);
  }
  button[data-size="lg"] {
    padding: var(--pos-space-sm) var(--pos-space-lg);
    font-size: var(--pos-font-size-md);
  }

  /* Solid variant (default) */
  button[data-variant="solid"],
  button:not([data-variant]) {
    background-color: var(--pos-color-action-primary);
    color: var(--pos-color-background-primary);
    border-color: var(--pos-color-action-primary);
  }
  button[data-variant="solid"]:hover,
  button:not([data-variant]):hover {
    background-color: var(--pos-color-action-primary-hover);
    border-color: var(--pos-color-action-primary-hover);
  }

  /* Outline variant */
  button[data-variant="outline"] {
    background-color: transparent;
    color: var(--pos-color-action-primary);
    border-color: var(--pos-color-action-primary);
  }
  button[data-variant="outline"]:hover {
    background-color: var(--pos-color-action-primary);
    color: var(--pos-color-background-primary);
  }

  /* Ghost variant */
  button[data-variant="ghost"] {
    background-color: transparent;
    color: var(--pos-color-text-primary);
    border-color: transparent;
  }
  button[data-variant="ghost"]:hover {
    background-color: var(--pos-color-border-default);
  }

  /* Danger variant */
  button[data-variant="danger"] {
    background-color: var(--pos-raw-color-neutral-800);
    color: var(--pos-color-background-primary);
    border-color: var(--pos-raw-color-neutral-800);
  }
  button[data-variant="danger"]:hover {
    opacity: 0.85;
  }

  /* Disabled */
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:disabled:hover {
    opacity: 0.45;
  }

  /* Focus ring */
  button:focus-visible {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }
`;

class UiButton extends PosBaseElement {
  static get observedAttributes() {
    return ['variant', 'disabled', 'size'];
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
    const size = this.getAttribute('size') || 'md';
    const disabled = this.hasAttribute('disabled');

    if (!this.shadow.querySelector('button')) {
      this.shadow.innerHTML = `<button><slot></slot></button>`;
    }

    const btn = this.shadow.querySelector('button');
    btn.setAttribute('data-variant', variant);
    btn.setAttribute('data-size', size);
    btn.disabled = disabled;
  }
}

define('ui-button', UiButton);
