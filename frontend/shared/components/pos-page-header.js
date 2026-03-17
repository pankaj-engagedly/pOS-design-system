// pos-page-header — standard content-area page title block
// Attributes: icon (emoji), title, subtitle
// Usage: <pos-page-header icon="☑" title="Todos" subtitle="Stay on top of your tasks"></pos-page-header>

class PosPageHeader extends HTMLElement {
  static get observedAttributes() {
    return ['icon', 'title', 'subtitle'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const icon     = this.getAttribute('icon') || '';
    const title    = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          padding: var(--pos-space-lg) var(--pos-space-xl) var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          flex-shrink: 0;
        }

        .header {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
        }

        .icon {
          font-size: 24px;
          line-height: 1;
        }

        .title {
          font-size: var(--pos-font-size-xl);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
          line-height: 1.2;
          margin: 0;
        }

        .subtitle {
          margin: var(--pos-space-xs) 0 0;
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-secondary);
        }
      </style>

      <div class="header">
        ${icon ? `<span class="icon">${icon}</span>` : ''}
        <h1 class="title">${title}</h1>
      </div>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    `;
  }
}

customElements.define('pos-page-header', PosPageHeader);
