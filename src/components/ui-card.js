import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .card {
    background-color: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    box-shadow: var(--pos-shadow-sm);
    overflow: hidden;
  }

  .header {
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-bottom: 1px solid var(--pos-color-border-default);
  }

  .header:empty {
    display: none;
  }

  .body {
    padding: var(--pos-space-md);
  }

  :host([padding="none"]) .body { padding: 0; }
  :host([padding="sm"]) .body { padding: var(--pos-space-sm); }
  :host([padding="lg"]) .body { padding: var(--pos-space-lg); }

  .footer {
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-top: 1px solid var(--pos-color-border-default);
  }

  .footer:empty {
    display: none;
  }
`;

class UiCard extends PosBaseElement {
  static get observedAttributes() {
    return ['padding'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="card">
        <div class="header"><slot name="header"></slot></div>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </div>
    `;
  }
}

define('ui-card', UiCard);
