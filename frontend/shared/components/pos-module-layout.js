// pos-module-layout — standard two-panel layout for all module pages
// Left: slot[name="panel"] — nav/list panel (secondary bg, border-right)
// Right: slot (default)   — main content area (primary bg)
// Attribute: panel-width  — left panel width in px (default: 260)

class PosModuleLayout extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['panel-width'];
  }

  connectedCallback() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-columns: var(--_panel-width, 260px) 1fr;
          height: 100%;
          overflow: hidden;
        }

        .panel {
          border-right: 1px solid var(--pos-color-border-default);
          background: var(--pos-color-background-secondary);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .content {
          overflow: hidden;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: var(--pos-color-background-primary);
        }
      </style>
      <div class="panel"><slot name="panel"></slot></div>
      <div class="content"><slot></slot></div>
    `;
    this._syncWidth();
  }

  attributeChangedCallback() {
    this._syncWidth();
  }

  _syncWidth() {
    const w = this.getAttribute('panel-width');
    if (w) this.style.setProperty('--_panel-width', `${w}px`);
    else this.style.removeProperty('--_panel-width');
  }
}

customElements.define('pos-module-layout', PosModuleLayout);
