// pos-module-layout — standard two-panel layout for all module pages
// Left: slot[name="panel"] — nav/list panel (secondary bg, border-right)
// Right: slot (default)   — main content area (primary bg)
// Attribute: panel-width  — left panel width in px (default: 260)

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
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

  .panel-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--pos-radius-sm);
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    position: fixed;
    top: 54px;
    left: 8px;
    z-index: 38;
  }
  .panel-toggle:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-text-primary);
  }
  .panel-toggle svg { pointer-events: none; }

  .scrim {
    display: none;
  }

  @media (max-width: 768px) {
    :host {
      grid-template-columns: 1fr;
    }

    .panel {
      position: fixed;
      top: 48px;
      left: 0;
      bottom: 56px;
      width: 280px;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      z-index: 40;
      background: var(--pos-color-background-secondary);
      box-shadow: 4px 0 24px rgba(0,0,0,0.1);
      border-right: none;
    }

    :host([panel-open]) .panel {
      transform: translateX(0);
    }

    .panel-toggle {
      display: flex;
    }

    .scrim {
      display: none;
      position: fixed;
      top: 48px;
      left: 0;
      right: 0;
      bottom: 56px;
      background: rgba(0,0,0,0.3);
      z-index: 39;
    }

    :host([panel-open]) .scrim {
      display: block;
    }
  }
`);

class PosModuleLayout extends HTMLElement {
  static get observedAttributes() { return ['panel-width']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._boundEvents = false;
  }

  connectedCallback() {
    this.shadow.innerHTML = `
      <button class="panel-toggle" id="panel-toggle" aria-label="Toggle sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div class="scrim" id="scrim"></div>
      <div class="panel"><slot name="panel"></slot></div>
      <div class="content"><slot></slot></div>
    `;
    this._syncWidth();
    this._bindMobileEvents();
  }

  disconnectedCallback() {
    this._boundEvents = false;
  }

  attributeChangedCallback() {
    this._syncWidth();
  }

  _syncWidth() {
    const w = this.getAttribute('panel-width');
    if (w) this.style.setProperty('--_panel-width', `${w}px`);
    else this.style.removeProperty('--_panel-width');
  }

  _bindMobileEvents() {
    if (this._boundEvents) return;
    this._boundEvents = true;

    // Toggle button
    this.shadow.getElementById('panel-toggle')?.addEventListener('click', () => {
      if (this.hasAttribute('panel-open')) {
        this.removeAttribute('panel-open');
      } else {
        this.setAttribute('panel-open', '');
      }
    });

    // Scrim click to close
    this.shadow.getElementById('scrim')?.addEventListener('click', () => {
      this.removeAttribute('panel-open');
    });

    // Auto-close panel on sidebar navigation events (mobile only)
    const autoCloseEvents = ['sidebar-navigate', 'list-select', 'smart-view-select'];
    autoCloseEvents.forEach(evt => {
      this.addEventListener(evt, () => {
        if (window.innerWidth <= 768) {
          this.removeAttribute('panel-open');
        }
      });
    });
  }
}

customElements.define('pos-module-layout', PosModuleLayout);
