import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

// Deterministic color from name — consistent across renders
const PALETTE = [
  '#5C6BC0', '#42A5F5', '#26A69A', '#66BB6A',
  '#FFA726', '#EF5350', '#AB47BC', '#EC407A',
];

function colorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const CSS = `
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    user-select: none;
  }

  :host,
  :host([size="md"]) { width: 32px; height: 32px; font-size: var(--pos-raw-font-size-xs); }
  :host([size="sm"]) { width: 24px; height: 24px; font-size: 10px; }
  :host([size="lg"]) { width: 48px; height: 48px; font-size: var(--pos-font-size-sm); }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .initials {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #fff;
    font-weight: var(--pos-font-weight-semibold);
    letter-spacing: 0.02em;
  }
`;

class UiAvatar extends PosBaseElement {
  static get observedAttributes() {
    return ['src', 'name', 'size'];
  }

  connectedCallback() {
    this.adoptStyles(CSS);
    this._render();
  }

  attributeChangedCallback() {
    if (this.shadow.childElementCount) this._render();
  }

  _render() {
    const src = this.getAttribute('src');
    const name = this.getAttribute('name') || '?';

    if (src) {
      this.shadow.innerHTML = `<img src="${src}" alt="${name}" />`;
    } else {
      const bg = colorFromName(name);
      this.shadow.innerHTML = `
        <div class="initials" style="background-color:${bg}">${initials(name)}</div>
      `;
    }
  }
}

define('ui-avatar', UiAvatar);
