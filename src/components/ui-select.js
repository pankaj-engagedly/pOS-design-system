import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .wrapper {
    display: flex;
    align-items: center;
    position: relative;
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

  select {
    flex: 1;
    font-family: var(--pos-font-family-default);
    color: var(--pos-color-text-primary);
    background: transparent;
    border: none;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    min-width: 0;
    cursor: pointer;
  }

  /* Sizes */
  :host([size="sm"]) select {
    padding: var(--pos-space-xs) var(--pos-space-lg) var(--pos-space-xs) var(--pos-space-sm);
    font-size: var(--pos-raw-font-size-xs);
  }
  select {
    padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-sm);
  }
  :host([size="lg"]) select {
    padding: var(--pos-space-sm) var(--pos-space-lg) var(--pos-space-sm) var(--pos-space-md);
    font-size: var(--pos-font-size-md);
  }

  /* Chevron */
  .chevron {
    position: absolute;
    right: var(--pos-space-sm);
    pointer-events: none;
    color: var(--pos-color-text-secondary);
    font-size: 12px;
    line-height: 1;
  }

  select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :host([disabled]) .wrapper {
    opacity: 0.45;
    background-color: var(--pos-color-background-secondary);
  }
`;

class UiSelect extends PosBaseElement {
  static get observedAttributes() {
    return ['placeholder', 'disabled', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="wrapper">
        <select></select>
        <span class="chevron">\u25BE</span>
      </div>
    `;

    this._select = this.shadow.querySelector('select');
    this._syncOptions();
    this._syncAttributes();

    // Watch for light DOM changes (options added/removed)
    this._observer = new MutationObserver(() => this._syncOptions());
    this._observer.observe(this, { childList: true });

    this._select.addEventListener('change', () => {
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  disconnectedCallback() {
    this._observer?.disconnect();
  }

  attributeChangedCallback() {
    if (!this._select) return;
    this._syncAttributes();
    this._syncOptions();
  }

  _syncAttributes() {
    this._select.disabled = this.hasAttribute('disabled');
  }

  _syncOptions() {
    const placeholder = this.getAttribute('placeholder');
    const options = this.querySelectorAll('option');

    this._select.innerHTML = '';

    if (placeholder) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      opt.disabled = true;
      opt.selected = true;
      opt.hidden = true;
      this._select.appendChild(opt);
    }

    options.forEach(o => {
      const clone = o.cloneNode(true);
      this._select.appendChild(clone);
    });
  }

  get value() {
    return this._select ? this._select.value : '';
  }

  set value(v) {
    if (this._select) this._select.value = v;
  }
}

define('ui-select', UiSelect);
