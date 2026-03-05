import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const CSS = `
  :host {
    display: block;
  }

  .track {
    width: 100%;
    border-radius: var(--pos-radius-full);
    background-color: var(--pos-color-background-secondary);
    overflow: hidden;
  }

  /* Sizes */
  :host(:not([size])) .track,
  :host([size="md"]) .track {
    height: 8px;
  }
  :host([size="sm"]) .track {
    height: 4px;
  }
  :host([size="lg"]) .track {
    height: 12px;
  }

  .fill {
    height: 100%;
    border-radius: var(--pos-radius-full);
    background-color: var(--pos-color-action-primary);
    transition: width 0.3s ease;
  }

  /* Indeterminate animation */
  :host([data-indeterminate]) .fill {
    width: 30% !important;
    animation: slide 1.5s ease-in-out infinite;
  }

  @keyframes slide {
    0%   { transform: translateX(-100%); }
    50%  { transform: translateX(230%); }
    100% { transform: translateX(-100%); }
  }
`;

class UiProgress extends PosBaseElement {
  static get observedAttributes() {
    return ['value', 'max', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this.shadow.innerHTML = `
      <div class="track">
        <div class="fill"></div>
      </div>
    `;
    this._fill = this.shadow.querySelector('.fill');
    this._update();
  }

  attributeChangedCallback() {
    if (this._fill) this._update();
  }

  _update() {
    const hasValue = this.hasAttribute('value');
    const max = parseFloat(this.getAttribute('max')) || 100;
    const value = parseFloat(this.getAttribute('value')) || 0;

    if (!hasValue) {
      // Indeterminate
      this.setAttribute('data-indeterminate', '');
      this._fill.style.width = '';
      this.setAttribute('role', 'progressbar');
      this.removeAttribute('aria-valuenow');
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(max));
    } else {
      // Determinate
      this.removeAttribute('data-indeterminate');
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      this._fill.style.width = `${pct}%`;
      this.setAttribute('role', 'progressbar');
      this.setAttribute('aria-valuenow', String(value));
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(max));
    }
  }
}

define('ui-progress', UiProgress);
