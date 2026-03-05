import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-flex;
    position: relative;
  }

  .trigger {
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    z-index: var(--pos-z-overlay);
    padding: var(--pos-space-xs) var(--pos-space-sm);
    background-color: var(--pos-color-text-primary);
    color: var(--pos-color-background-primary);
    font-family: var(--pos-font-family-default);
    font-size: var(--pos-font-size-sm);
    line-height: var(--pos-line-height-tight);
    border-radius: var(--pos-radius-sm);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  :host(:hover) .tooltip,
  :host(:focus-within) .tooltip {
    opacity: 1;
  }

  /* Positions */
  .tooltip[data-position="top"] {
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  .tooltip[data-position="bottom"] {
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  .tooltip[data-position="left"] {
    right: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  .tooltip[data-position="right"] {
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
`;

let tooltipId = 0;

class UiTooltip extends PosBaseElement {
  static get observedAttributes() {
    return ['text', 'position'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this._id = `tooltip-${++tooltipId}`;
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) this.render();
  }

  render() {
    const text = this.getAttribute('text') || '';
    const position = this.getAttribute('position') || 'top';

    this.shadow.innerHTML = `
      <div class="trigger" aria-describedby="${this._id}">
        <slot></slot>
      </div>
      <div class="tooltip" id="${this._id}" role="tooltip" data-position="${position}">${text}</div>
    `;
  }
}

define('ui-tooltip', UiTooltip);
