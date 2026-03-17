// pos-page-header — Slot-based content-area page title block
//
// Slots:
//   (default) — title text / element
//   icon      — leading emoji or icon (optional)
//   meta      — trailing count or badge next to the title (optional)
//   subtitle  — line below the title row (optional)
//
// Attributes:
//   separator — adds border-bottom (use for full-page headers above content)
//
// Usage:
//   <pos-page-header>
//     Welcome back!
//     <span slot="subtitle">Here's what's happening today</span>
//   </pos-page-header>
//
//   <pos-page-header separator>
//     <span slot="icon">☑</span>
//     Todos
//     <span slot="meta">12 tasks</span>
//   </pos-page-header>

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
    padding: var(--pos-space-md) var(--pos-space-lg) var(--pos-space-sm);
    flex-shrink: 0;
  }

  :host([separator]) {
    border-bottom: 1px solid var(--pos-color-border-default);
    padding-bottom: var(--pos-space-md);
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: var(--pos-space-sm);
  }

  h2 {
    margin: 0;
    font-size: var(--pos-font-size-2xl);
    font-weight: var(--pos-font-weight-bold);
    color: var(--pos-color-text-primary);
    line-height: 1.2;
  }

  ::slotted([slot="icon"]) {
    font-size: var(--pos-raw-font-size-xl);
    line-height: 1;
    align-self: center;
  }

  ::slotted([slot="meta"]) {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
  }

  ::slotted([slot="subtitle"]) {
    display: block;
    margin: var(--pos-space-xs) 0 0;
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-secondary);
  }
`);

class PosPageHeader extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    // Structure is static — separator is handled by :host([separator]) in the sheet
    this.shadow.innerHTML = `
      <div class="row">
        <slot name="icon"></slot>
        <h2><slot></slot></h2>
        <slot name="meta"></slot>
      </div>
      <slot name="subtitle"></slot>
    `;
  }
}

// No attributeChangedCallback needed — :host([separator]) in the sheet reacts automatically

customElements.define('pos-page-header', PosPageHeader);
