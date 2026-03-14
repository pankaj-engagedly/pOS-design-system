import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: flex;
    height: 100%;
  }

  .sidebar {
    flex-shrink: 0;
    width: var(--_sidebar-width, 240px);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
  }
`;

class UiAppLayout extends PosBaseElement {
  static get observedAttributes() {
    return ['sidebar-width'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="sidebar"><slot name="sidebar"></slot></div>
      <div class="main"><slot></slot></div>
    `;
    this._syncWidth();
  }

  attributeChangedCallback() {
    this._syncWidth();
  }

  _syncWidth() {
    const w = this.getAttribute('sidebar-width');
    if (w) {
      this.style.setProperty('--_sidebar-width', `${w}px`);
    } else {
      this.style.removeProperty('--_sidebar-width');
    }
  }
}

define('ui-app-layout', UiAppLayout);
