import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0;
    background-color: var(--pos-color-background-primary);
    border-right: 1px solid var(--pos-color-border-default);
    overflow: hidden;
  }

  .header {
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-bottom: 1px solid var(--pos-color-border-default);
  }

  .header:empty {
    display: none;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--pos-space-sm);
  }

  .footer {
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-top: 1px solid var(--pos-color-border-default);
  }

  .footer:empty {
    display: none;
  }
`;

class UiSidePanel extends PosBaseElement {
  static get observedAttributes() {
    return ['width'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="header"><slot name="header"></slot></div>
      <div class="content"><slot></slot></div>
      <div class="footer"><slot name="footer"></slot></div>
    `;
    this._syncWidth();
  }

  attributeChangedCallback() {
    this._syncWidth();
  }

  _syncWidth() {
    const w = this.getAttribute('width');
    if (w) {
      this.style.setProperty('--_panel-width', `${w}px`);
    } else {
      this.style.removeProperty('--_panel-width');
    }
  }
}

define('ui-side-panel', UiSidePanel);
