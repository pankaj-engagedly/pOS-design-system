// pos-app-header — app-level header bar
// Emits: header-collapse, header-logout, header-profile, header-password
// Composed of: collapse btn, logo, ui-search-input, ui-theme-toggle, pos-user-menu

import './pos-user-menu.js';

class PosAppHeader extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._user = null;
  }

  set user(val) {
    this._user = val;
    this._render();
    // Keep user-menu in sync without full re-render if it already exists
    const menu = this.shadow.querySelector('pos-user-menu');
    if (menu) menu.user = val;
  }

  connectedCallback() {
    this._render();
    // All listeners on shadow root — survive _render() calls
    this.shadow.addEventListener('theme-change', (e) => {
      document.documentElement.setAttribute('data-pos-theme', e.detail.theme);
    });
    // Translate user-menu actions → header-* events for app-shell
    this.shadow.addEventListener('user-logout',   () => this._emit('header-logout'));
    this.shadow.addEventListener('user-profile',  () => this._emit('header-profile'));
    this.shadow.addEventListener('user-password', () => this._emit('header-password'));
  }

  _render() {
    const theme = document.documentElement.getAttribute('data-pos-theme') || 'light';

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          height: 48px;
          min-height: 48px;
          padding: 0 var(--pos-space-md);
          background: var(--pos-color-background-primary);
          border-bottom: 1px solid var(--pos-color-border-default);
          gap: var(--pos-space-md);
          z-index: 10;
        }

        .left {
          display: flex;
          align-items: center;
        }

        .center {
          flex: 1;
          display: flex;
          justify-content: center;
          max-width: 480px;
          margin: 0 auto;
        }

        ui-search-input { width: 100%; }

        .right {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          margin-left: auto;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          font-size: var(--pos-font-size-md);
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .icon-btn:hover {
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
        }
        .icon-btn:focus-visible {
          outline: 2px solid var(--pos-color-action-primary);
          outline-offset: 2px;
        }
      </style>

      <div class="left"></div>

      <div class="center">
        <ui-search-input placeholder="Search..." disabled></ui-search-input>
      </div>

      <div class="right">
        <ui-theme-toggle theme="${theme}"></ui-theme-toggle>
        <pos-user-menu></pos-user-menu>
      </div>
    `;

    // Set user on the newly created menu
    const menu = this.shadow.querySelector('pos-user-menu');
    if (menu && this._user) menu.user = this._user;
  }

  _emit(name) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }
}

customElements.define('pos-app-header', PosAppHeader);
