import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-flex;
  }

  span {
    display: inline-flex;
    align-items: center;
    border-radius: var(--pos-radius-full);
    font-family: var(--pos-font-family-default);
    font-weight: var(--pos-font-weight-medium);
    white-space: nowrap;
  }

  /* Sizes */
  span[data-size="sm"] {
    padding: 2px var(--pos-space-xs);
    font-size: var(--pos-raw-font-size-xs);
  }
  span[data-size="md"],
  span:not([data-size]) {
    padding: 2px var(--pos-space-sm);
    font-size: var(--pos-font-size-sm);
  }
  span[data-size="lg"] {
    padding: var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-font-size-sm);
  }

  /* Neutral (default) */
  span[data-variant="neutral"],
  span:not([data-variant]) {
    background-color: var(--pos-color-background-secondary);
    color: var(--pos-color-text-secondary);
  }

  /* Primary */
  span[data-variant="primary"] {
    background-color: var(--pos-color-action-primary);
    color: var(--pos-color-background-primary);
  }

  /* Success */
  span[data-variant="success"] {
    background-color: var(--pos-raw-color-neutral-700);
    color: var(--pos-color-background-primary);
  }

  /* Warning */
  span[data-variant="warning"] {
    background-color: var(--pos-color-accent-orange);
    color: var(--pos-color-text-primary);
  }

  /* Danger */
  span[data-variant="danger"] {
    background-color: var(--pos-raw-color-neutral-800);
    color: var(--pos-color-background-primary);
  }

  /* Purple */
  span[data-variant="purple"] {
    background-color: var(--pos-color-accent-purple);
    color: var(--pos-color-background-primary);
  }
`;

class UiBadge extends PosBaseElement {
  static get observedAttributes() {
    return ['variant', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const variant = this.getAttribute('variant') || 'neutral';
    const size = this.getAttribute('size') || 'md';

    if (!this.shadow.querySelector('span')) {
      this.shadow.innerHTML = `<span><slot></slot></span>`;
    }

    const span = this.shadow.querySelector('span');
    span.setAttribute('data-variant', variant);
    span.setAttribute('data-size', size);
  }
}

define('ui-badge', UiBadge);
