import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

// Inline SVG — no emoji inconsistency across platforms
const SEARCH_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="7" cy="7" r="4.5"/>
  <line x1="10.5" y1="10.5" x2="14.5" y2="14.5"/>
</svg>`;

const CSS = `
  :host { display: block; }

  .wrapper {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: 0 var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    background-color: var(--pos-color-background-secondary);
    transition: border-color 0.15s ease, background-color 0.15s ease;
    overflow: hidden;
  }

  .wrapper:focus-within {
    border-color: var(--pos-color-action-primary);
    background-color: var(--pos-color-background-primary);
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 1px;
  }

  .icon {
    display: flex;
    align-items: center;
    color: var(--pos-color-text-disabled);
    flex-shrink: 0;
    pointer-events: none;
  }

  .wrapper:focus-within .icon {
    color: var(--pos-color-action-primary);
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--pos-font-family-default);
    color: var(--pos-color-text-primary);
    min-width: 0;
    padding: var(--pos-space-sm) 0;
    font-size: var(--pos-font-size-sm);
  }

  :host([size="sm"]) input {
    padding: var(--pos-space-xs) 0;
    font-size: var(--pos-raw-font-size-xs);
  }

  input::placeholder { color: var(--pos-color-text-disabled); }

  :host([disabled]) .wrapper {
    opacity: 0.45;
    pointer-events: none;
  }
`;

class UiSearchInput extends PosBaseElement {
  static get observedAttributes() {
    return ['placeholder', 'value', 'disabled', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="wrapper">
        <span class="icon">${SEARCH_ICON}</span>
        <input type="search" autocomplete="off" spellcheck="false" />
      </div>
    `;
    this._input = this.shadow.querySelector('input');
    this._syncAttributes();

    this._input.addEventListener('input', () => {
      this.dispatchEvent(new CustomEvent('search-input', {
        bubbles: true, composed: true,
        detail: { value: this._input.value },
      }));
    });

    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.dispatchEvent(new CustomEvent('search-submit', {
          bubbles: true, composed: true,
          detail: { value: this._input.value },
        }));
      }
      if (e.key === 'Escape') {
        this._input.value = '';
        this._input.blur();
      }
    });
  }

  attributeChangedCallback() {
    if (this._input) this._syncAttributes();
  }

  _syncAttributes() {
    this._input.placeholder = this.getAttribute('placeholder') || '';
    this._input.disabled = this.hasAttribute('disabled');
    const val = this.getAttribute('value');
    if (val !== null && this._input.value !== val) this._input.value = val;
  }

  get value() { return this._input?.value ?? ''; }
  set value(v) { if (this._input) this._input.value = v; }
  clear() { if (this._input) this._input.value = ''; }
  focus() { this._input?.focus(); }
}

define('ui-search-input', UiSearchInput);
