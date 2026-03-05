import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-flex;
  }

  .spinner {
    border-radius: 50%;
    border: 2px solid var(--pos-color-border-default);
    border-top-color: var(--pos-color-action-primary);
    animation: spin 0.6s linear infinite;
  }

  /* Sizes */
  .spinner[data-size="sm"] {
    width: 16px;
    height: 16px;
  }
  .spinner[data-size="md"],
  .spinner:not([data-size]) {
    width: 24px;
    height: 24px;
  }
  .spinner[data-size="lg"] {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

class UiSpinner extends PosBaseElement {
  static get observedAttributes() {
    return ['size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const size = this.getAttribute('size') || 'md';
    this.shadow.innerHTML = `<div class="spinner" data-size="${size}" role="status" aria-label="Loading"></div>`;
  }
}

define('ui-spinner', UiSpinner);
