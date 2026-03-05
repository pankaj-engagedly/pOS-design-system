import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  hr {
    border: none;
    margin: 0;
  }

  /* Horizontal (default) */
  :host(:not([orientation="vertical"])) hr {
    border-top: 1px solid var(--pos-color-border-default);
    margin: var(--pos-space-sm) 0;
  }

  /* Vertical */
  :host([orientation="vertical"]) {
    display: inline-block;
    align-self: stretch;
  }
  :host([orientation="vertical"]) hr {
    width: 1px;
    height: 100%;
    background-color: var(--pos-color-border-default);
    margin: 0 var(--pos-space-sm);
  }
`;

class UiDivider extends PosBaseElement {
  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `<hr />`;
  }
}

define('ui-divider', UiDivider);
