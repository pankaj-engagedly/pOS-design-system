import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host { display: inline-flex; }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--pos-space-xs);
    padding: var(--pos-space-xs) var(--pos-space-sm);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-family: var(--pos-font-family-default);
    font-size: var(--pos-raw-font-size-xs);
    font-weight: var(--pos-font-weight-medium);
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  button:hover {
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
    border-color: var(--pos-color-border-strong);
  }

  button:focus-visible {
    outline: 2px solid var(--pos-color-action-primary);
    outline-offset: 2px;
  }

  .icon { line-height: 1; font-size: 13px; }
`;

const THEMES = {
  light: { icon: '☀️', label: 'Light' },
  dark:  { icon: '🌙', label: 'Dark'  },
};

class UiThemeToggle extends PosBaseElement {
  static get observedAttributes() {
    return ['theme'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <button>
        <span class="icon"></span>
        <span class="label"></span>
      </button>
    `;
    this._icon  = this.shadow.querySelector('.icon');
    this._label = this.shadow.querySelector('.label');
    this._syncTheme();

    this.shadow.querySelector('button').addEventListener('click', () => {
      const current = this.getAttribute('theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      this.setAttribute('theme', next);
      this.dispatchEvent(new CustomEvent('theme-change', {
        bubbles: true, composed: true,
        detail: { theme: next },
      }));
    });
  }

  attributeChangedCallback() {
    if (this._icon) this._syncTheme();
  }

  _syncTheme() {
    const t = THEMES[this.getAttribute('theme') || 'light'];
    this._icon.textContent  = t.icon;
    this._label.textContent = t.label;
  }
}

define('ui-theme-toggle', UiThemeToggle);
