// pos-sidebar — Base sidebar shell: title + scrollable nav area + footer slot
//
// Usage:
//   import './pos-sidebar.js';
//   import { SIDEBAR_NAV_STYLES } from './pos-sidebar.js';
//
//   <pos-sidebar title="My Module">
//     <!-- nav items go here (default slot, scrollable) -->
//     <div slot="footer">...</div>
//   </pos-sidebar>
//
// SIDEBAR_NAV_STYLES must be included in the child component's own shadow
// <style> block so that slotted nav items are styled correctly.

export const SIDEBAR_NAV_STYLES = `
  .section-label {
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--pos-color-text-secondary);
    padding: var(--pos-space-sm) var(--pos-space-sm) var(--pos-space-xs);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--pos-space-sm);
    padding: 6px var(--pos-space-sm);
    border-radius: var(--pos-radius-sm);
    cursor: pointer;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    user-select: none;
    transition: background 0.1s, color 0.1s;
  }
  .nav-item:hover {
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
  }
  .nav-item.active {
    background: color-mix(in srgb, var(--pos-color-action-primary) 10%, transparent);
    color: var(--pos-color-action-primary);
    font-weight: var(--pos-font-weight-medium);
  }
  .nav-item svg { flex-shrink: 0; }

  .nav-label { flex: 1; }

  .nav-count {
    font-size: var(--pos-font-size-xs);
    color: var(--pos-color-text-secondary);
    background: var(--pos-color-background-primary);
    border-radius: 99px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
  }
  .nav-item.active .nav-count {
    background: color-mix(in srgb, var(--pos-color-action-primary) 15%, transparent);
    color: var(--pos-color-action-primary);
  }

  .divider {
    height: 1px;
    background: var(--pos-color-border-default);
    margin: var(--pos-space-sm);
  }
`;

class PosSidebar extends HTMLElement {
  static get observedAttributes() { return ['title']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const title = this.getAttribute('title') || '';

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .title {
          padding: var(--pos-space-xs) var(--pos-space-md) var(--pos-space-sm);
          font-size: var(--pos-font-size-lg);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
          margin: 0;
          flex-shrink: 0;
        }

        .scroll {
          flex: 1;
          overflow-y: auto;
          padding: 0 var(--pos-space-xs) var(--pos-space-sm);
        }

        .footer {
          flex-shrink: 0;
          border-top: 1px solid var(--pos-color-border-default);
          padding: var(--pos-space-sm);
        }
      </style>

      ${title ? `<h2 class="title">${this._esc(title)}</h2>` : ''}
      <div class="scroll"><slot></slot></div>
      <div class="footer"><slot name="footer"></slot></div>
    `;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-sidebar', PosSidebar);
