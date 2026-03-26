// pos-sidebar — Base sidebar shell: title + scrollable nav area + footer slot
//
// Usage:
//   import './pos-sidebar.js';
//   import { SIDEBAR_NAV_SHEET } from './pos-sidebar.js';
//
//   <pos-sidebar title="My Module">
//     <!-- nav items go here (default slot, scrollable) -->
//     <div slot="footer">...</div>
//   </pos-sidebar>
//
// SIDEBAR_NAV_SHEET must be adopted in the child component's shadow root
// so that slotted nav items are styled correctly:
//   this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, mySheet];

// ─── Shell styles (private to pos-sidebar) ────────────────────────────────

const shellSheet = new CSSStyleSheet();
shellSheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .title {
    padding: var(--pos-space-md) var(--pos-space-md) var(--pos-space-sm);
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
`);

// ─── Nav styles (exported for module sidebars to adopt) ───────────────────

export const SIDEBAR_NAV_SHEET = new CSSStyleSheet();
SIDEBAR_NAV_SHEET.replaceSync(`
  .section-label {
    display: flex;
    align-items: center;
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--pos-color-text-secondary);
    padding: var(--pos-space-sm) var(--pos-space-sm) var(--pos-space-xs);
  }

  .nav-item {
    position: relative;
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

  /* ── Hover action overlay (rename/delete etc.) ── */

  .nav-item:hover .nav-count { visibility: hidden; }

  .nav-actions {
    display: none;
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    align-items: center;
    gap: 2px;
    padding-right: 2px;
    background: inherit;
  }
  .nav-item:hover .nav-actions { display: flex; }

  .nav-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    padding: 0;
    transition: background 0.1s, color 0.1s;
  }
  .nav-action-btn:hover { background: var(--pos-color-border-default); color: var(--pos-color-text-primary); }
  .nav-action-btn.delete:hover { color: var(--pos-color-priority-urgent); }
  .nav-action-btn svg { pointer-events: none; }

  /* ── Inline rename input ── */
  .rename-wrap {
    padding: 2px var(--pos-space-xs);
  }
  .rename-input {
    width: 100%;
    padding: 4px var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
`);

// ─── Component ────────────────────────────────────────────────────────────

class PosSidebar extends HTMLElement {
  static get observedAttributes() { return ['title']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [shellSheet];
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const title = this.getAttribute('title') || '';
    this.shadow.innerHTML = `
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
