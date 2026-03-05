import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .wrapper {
    display: flex;
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    background-color: var(--pos-color-background-primary);
    transition: border-color 0.15s ease;
    overflow: hidden;
  }

  .wrapper:focus-within {
    border-color: var(--pos-color-action-primary);
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 1px;
  }

  textarea {
    flex: 1;
    font-family: var(--pos-font-family-default);
    color: var(--pos-color-text-primary);
    background: transparent;
    border: none;
    outline: none;
    min-width: 0;
  }

  /* Sizes */
  :host([size="sm"]) textarea {
    padding: var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-raw-font-size-xs);
  }
  textarea {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-sm);
  }
  :host([size="lg"]) textarea {
    padding: var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-md);
  }

  textarea::placeholder {
    color: var(--pos-color-text-disabled);
  }

  textarea:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :host([disabled]) .wrapper {
    opacity: 0.45;
    background-color: var(--pos-color-background-secondary);
  }

  /* Resize control */
  :host(:not([resize])) textarea,
  :host([resize="vertical"]) textarea {
    resize: vertical;
  }
  :host([resize="none"]) textarea {
    resize: none;
  }
  :host([resize="horizontal"]) textarea {
    resize: horizontal;
  }
  :host([resize="both"]) textarea {
    resize: both;
  }
`;

class UiTextarea extends PosBaseElement {
  static get observedAttributes() {
    return ['placeholder', 'disabled', 'rows', 'resize', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `<div class="wrapper"><textarea></textarea></div>`;
    this._textarea = this.shadow.querySelector('textarea');
    this._syncAttributes();

    this._textarea.addEventListener('change', () => {
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  attributeChangedCallback() {
    if (!this._textarea) return;
    this._syncAttributes();
  }

  _syncAttributes() {
    const ta = this._textarea;
    ta.placeholder = this.getAttribute('placeholder') || '';
    ta.disabled = this.hasAttribute('disabled');
    ta.rows = this.getAttribute('rows') || 3;
  }

  get value() {
    return this._textarea ? this._textarea.value : '';
  }

  set value(v) {
    if (this._textarea) this._textarea.value = v;
  }
}

define('ui-textarea', UiTextarea);
