import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

/**
 * Shared card behaviour stylesheet — import and adopt in any component
 * that renders card-like elements. Provides consistent border, radius,
 * hover shadow, active/selected state, and transition.
 *
 * Usage (in a module component):
 *   import { CARD_STYLES } from '../../design-system/src/components/ui-card.js';
 *   // then in CSS or adoptedStyleSheets:
 *   this.shadow.adoptedStyleSheets = [CARD_STYLES, ...];
 *
 * Apply to your card element: <div class="pos-card">
 * Add .interactive for hover effects, .active for selected state.
 */
export const CARD_STYLES = new CSSStyleSheet();
CARD_STYLES.replaceSync(`
  .pos-card {
    background: var(--pos-color-background-primary, #fff);
    border: 1px solid var(--pos-color-border-default, #e2e2e8);
    border-radius: var(--pos-radius-md, 8px);
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .pos-card.interactive {
    cursor: pointer;
  }
  .pos-card.interactive:hover {
    box-shadow: 0 3px 12px rgba(0,0,0,0.08);
  }

  .pos-card.active {
    border-color: var(--pos-color-action-primary, #4361ee);
    border-width: 2px;
  }
`);

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
