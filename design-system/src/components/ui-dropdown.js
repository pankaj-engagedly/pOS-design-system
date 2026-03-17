import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: inline-block;
    position: relative;
  }

  .trigger {
    cursor: pointer;
    display: inline-flex;
  }

  .panel {
    display: none;
    position: absolute;
    top: calc(100% + var(--pos-space-xs));
    right: 0;
    z-index: 200;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    box-shadow: var(--pos-shadow-md);
    min-width: 200px;
    overflow: hidden;
  }

  @keyframes _dropdown-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  :host([open]) .panel {
    display: block;
    animation: _dropdown-in 0.14s ease;
  }

  /* placement="bottom-start" aligns left instead of right */
  :host([placement="bottom-start"]) .panel {
    right: auto;
    left: 0;
  }
`;

class UiDropdown extends PosBaseElement {
  static get observedAttributes() {
    return ['open'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="trigger"><slot name="trigger"></slot></div>
      <div class="panel" role="menu"><slot></slot></div>
    `;

    this._outsideClick = (e) => {
      if (!e.composedPath().includes(this)) this.close();
    };
    this._keydown = (e) => {
      if (e.key === 'Escape') this.close();
    };

    this.shadow.querySelector('.trigger').addEventListener('click', () => this.toggle());
  }

  disconnectedCallback() {
    this._cleanup();
  }

  toggle() {
    this.hasAttribute('open') ? this.close() : this.open();
  }

  open() {
    this.setAttribute('open', '');
    // Defer so the triggering click doesn't immediately fire _outsideClick
    setTimeout(() => {
      document.addEventListener('click', this._outsideClick, true);
      document.addEventListener('keydown', this._keydown);
    }, 0);
    this.dispatchEvent(new CustomEvent('dropdown-open', { bubbles: true, composed: true }));
  }

  close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this._cleanup();
    this.dispatchEvent(new CustomEvent('dropdown-close', { bubbles: true, composed: true }));
  }

  _cleanup() {
    document.removeEventListener('click', this._outsideClick, true);
    document.removeEventListener('keydown', this._keydown);
  }
}

define('ui-dropdown', UiDropdown);
