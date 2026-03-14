import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .nav-row {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-radius: var(--pos-radius-md);
    cursor: pointer;
    transition: background-color 0.1s ease;
    font-family: var(--pos-font-family-default);
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    user-select: none;
  }

  .nav-row:hover {
    background-color: var(--pos-color-background-secondary);
  }

  :host([selected]) .nav-row {
    background-color: color-mix(in srgb, var(--pos-color-action-primary) 12%, transparent);
    color: var(--pos-color-action-primary);
    font-weight: var(--pos-font-weight-semibold);
  }

  .icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .icon:empty {
    display: none;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-size: var(--pos-raw-font-size-xs);
    color: var(--pos-color-text-secondary);
    min-width: var(--pos-space-md);
    text-align: right;
    flex-shrink: 0;
  }

  :host([selected]) .count {
    color: var(--pos-color-action-primary);
  }

  :host(:not([count])) .count {
    display: none;
  }
`;

class UiNavItem extends PosBaseElement {
  static get observedAttributes() {
    return ['selected', 'count'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="nav-row">
        <span class="icon"><slot name="icon"></slot></span>
        <span class="label"><slot></slot></span>
        <span class="count"></span>
      </div>
    `;

    this._countEl = this.shadow.querySelector('.count');
    this._syncCount();

    this.shadow.querySelector('.nav-row').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('nav-select', {
        bubbles: true,
        composed: true,
        detail: { item: this },
      }));
    });
  }

  attributeChangedCallback() {
    if (this._countEl) this._syncCount();
  }

  _syncCount() {
    const count = this.getAttribute('count');
    this._countEl.textContent = count || '';
  }
}

define('ui-nav-item', UiNavItem);
