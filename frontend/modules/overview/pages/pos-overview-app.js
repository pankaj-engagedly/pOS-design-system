// pos-overview-app — Dashboard / landing page showing highlights from all modules
// Content to be built out in a later phase

import '../../../shared/components/pos-page-header.js';
import { icon } from '../../../shared/utils/icons.js';

class PosOverviewApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--pos-color-background-primary);
          overflow: hidden;
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--pos-space-sm);
          color: var(--pos-color-text-secondary);
        }

        .placeholder-icon {
          font-size: 40px;
          opacity: 0.25;
        }

        p {
          margin: 0;
          font-size: var(--pos-font-size-sm);
        }
      </style>

      <pos-page-header>
        Welcome back!
        <span slot="subtitle">Here's what's happening with your life today</span>
      </pos-page-header>

      <div class="content">
        <span class="placeholder-icon">${icon('home', 48)}</span>
        <p>Dashboard coming soon — highlights from all modules will appear here.</p>
      </div>
    `;
  }
}

customElements.define('pos-overview-app', PosOverviewApp);
