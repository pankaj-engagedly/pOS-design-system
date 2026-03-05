import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  dialog {
    border: none;
    border-radius: var(--pos-radius-lg);
    box-shadow: var(--pos-shadow-lg);
    background-color: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    padding: 0;
    max-width: min(90vw, 560px);
    width: 100%;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--pos-space-md);
    border-bottom: 1px solid var(--pos-color-border-default);
  }

  .header:empty,
  .header:not(:has(::slotted(*)):has(.close-btn)) {
    display: none;
  }

  .body {
    padding: var(--pos-space-md);
  }

  .footer {
    padding: var(--pos-space-sm) var(--pos-space-md);
    border-top: 1px solid var(--pos-color-border-default);
  }

  .footer:empty {
    display: none;
  }

  .close-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    border-radius: var(--pos-radius-sm);
  }

  :host([closable]) .close-btn {
    display: inline-flex;
  }

  .close-btn:hover {
    color: var(--pos-color-text-primary);
    background-color: var(--pos-color-background-secondary);
  }

  :host([closable]) .header {
    display: flex;
  }
`;

class UiDialog extends PosBaseElement {
  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <dialog>
        <div class="header">
          <slot name="header"></slot>
          <button class="close-btn" aria-label="Close">\u00d7</button>
        </div>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </dialog>
    `;

    this._dialog = this.shadow.querySelector('dialog');

    this.shadow.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });

    this._dialog.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    });
  }

  open() {
    this._dialog?.showModal();
  }

  close() {
    this._dialog?.close();
  }
}

define('ui-dialog', UiDialog);
