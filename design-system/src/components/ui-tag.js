import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-flex;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    border-radius: var(--pos-radius-sm);
    font-family: var(--pos-font-family-default);
    font-weight: var(--pos-font-weight-medium);
    white-space: nowrap;
  }

  /* Sizes */
  .tag[data-size="sm"] {
    padding: 2px var(--pos-space-xs);
    font-size: var(--pos-raw-font-size-xs);
  }
  .tag[data-size="md"],
  .tag:not([data-size]) {
    padding: var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-font-size-sm);
  }

  /* Neutral (default) */
  .tag[data-variant="neutral"],
  .tag:not([data-variant]) {
    background-color: var(--pos-color-background-secondary);
    color: var(--pos-color-text-secondary);
  }

  /* Primary */
  .tag[data-variant="primary"] {
    background-color: var(--pos-color-action-primary);
    color: var(--pos-color-background-primary);
  }

  /* Purple */
  .tag[data-variant="purple"] {
    background-color: var(--pos-color-accent-purple);
    color: var(--pos-color-background-primary);
  }

  /* Orange */
  .tag[data-variant="orange"] {
    background-color: var(--pos-color-accent-orange);
    color: var(--pos-color-text-primary);
  }

  /* Close button */
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    font-size: 14px;
    line-height: 1;
    border-radius: var(--pos-radius-sm);
  }

  .close:hover {
    opacity: 1;
  }
`;

class UiTag extends PosBaseElement {
  static get observedAttributes() {
    return ['variant', 'size', 'removable'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.render();
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('.close')) {
        this.dispatchEvent(new CustomEvent('remove', { bubbles: true, composed: true }));
      }
    });
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const variant = this.getAttribute('variant') || 'neutral';
    const size = this.getAttribute('size') || 'md';
    const removable = this.hasAttribute('removable');

    this.shadow.innerHTML = `
      <span class="tag" data-variant="${variant}" data-size="${size}">
        <slot></slot>${removable ? '<button class="close" aria-label="Remove">\u00d7</button>' : ''}
      </span>
    `;
  }
}

define('ui-tag', UiTag);
