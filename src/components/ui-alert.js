import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-radius: var(--pos-radius-md);
    border-left: 4px solid;
    font-family: var(--pos-font-family-default);
    font-size: var(--pos-font-size-sm);
    line-height: var(--pos-line-height-normal);
    color: var(--pos-color-text-primary);
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .header {
    font-weight: var(--pos-font-weight-bold);
    margin-bottom: var(--pos-space-xs);
  }

  .header:empty {
    display: none;
  }

  /* Variants */
  .alert[data-variant="info"],
  .alert:not([data-variant]) {
    border-left-color: var(--pos-color-action-primary);
    background-color: color-mix(in srgb, var(--pos-color-action-primary) 8%, var(--pos-color-background-primary));
  }

  .alert[data-variant="success"] {
    border-left-color: var(--pos-color-accent-purple);
    background-color: color-mix(in srgb, var(--pos-color-accent-purple) 8%, var(--pos-color-background-primary));
  }

  .alert[data-variant="warning"] {
    border-left-color: var(--pos-color-accent-orange);
    background-color: color-mix(in srgb, var(--pos-color-accent-orange) 8%, var(--pos-color-background-primary));
  }

  .alert[data-variant="danger"] {
    border-left-color: var(--pos-color-border-strong);
    background-color: color-mix(in srgb, var(--pos-color-border-strong) 8%, var(--pos-color-background-primary));
  }

  /* Close button */
  .close-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    border-radius: var(--pos-radius-sm);
  }

  :host([dismissible]) .close-btn {
    display: inline-flex;
  }

  .close-btn:hover {
    color: var(--pos-color-text-primary);
    background-color: var(--pos-color-background-secondary);
  }
`;

class UiAlert extends PosBaseElement {
  static get observedAttributes() {
    return ['variant', 'dismissible'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.render();

    this.shadow.querySelector('.close-btn').addEventListener('click', () => {
      this.style.display = 'none';
      this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }));
    });
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const variant = this.getAttribute('variant') || 'info';

    this.shadow.innerHTML = `
      <div class="alert" data-variant="${variant}">
        <div class="content">
          <div class="header"><slot name="header"></slot></div>
          <slot></slot>
        </div>
        <button class="close-btn" aria-label="Dismiss">\u00d7</button>
      </div>
    `;
  }
}

define('ui-alert', UiAlert);
