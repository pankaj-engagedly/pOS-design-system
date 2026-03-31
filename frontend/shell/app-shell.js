import { on } from '../shared/services/event-bus.js';
import { initRouter, navigate } from '../shared/services/router.js';
import './pos-app-sidebar.js';
import './pos-app-header.js';
import { isAuthenticated, getUser, logout, tryRestoreSession } from '../shared/services/auth-store.js';

const moduleCache = new Map();

class PosAppShell extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.currentModule = null;
    this._authenticated = false;
  }

  async connectedCallback() {
    this._authenticated = false;
    this.render();

    // Try restoring session before initializing router
    const restored = await tryRestoreSession();
    this._authenticated = restored;
    this.render();

    this.bindEvents();
    initRouter();
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-rows: auto 1fr;
          grid-template-columns: auto 1fr;
          height: 100vh;
          font-family: var(--pos-font-family-default, system-ui, -apple-system, sans-serif);
          color: var(--pos-color-text-primary);
          background: var(--pos-color-background-primary);
        }

        /* Sidebar spans full height in col 1; header + main share col 2 */
        pos-app-sidebar { grid-row: 1 / -1; grid-column: 1; }
        pos-app-header  { grid-row: 1; grid-column: 2; }

        main {
          grid-row: 2;
          grid-column: 2;
          overflow: hidden;
          min-width: 0;
        }

        .not-found {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--pos-color-text-secondary);
        }

        .not-found h2 {
          margin: 0 0 var(--pos-space-sm);
          font-size: var(--pos-font-size-lg);
        }

        /* ── Mobile: single-column layout ── */
        @media (max-width: 768px) {
          :host {
            grid-template-columns: 1fr;
          }

          pos-app-sidebar {
            grid-row: auto;
            grid-column: 1;
          }

          pos-app-header {
            grid-row: 1;
            grid-column: 1;
          }

          main {
            grid-row: 2;
            grid-column: 1;
            padding-bottom: 60px;
          }
        }
      </style>

      ${this._authenticated ? '<pos-app-header id="header"></pos-app-header>' : ''}
      ${this._authenticated ? '<pos-app-sidebar id="sidebar"></pos-app-sidebar>' : ''}
      <main id="content"></main>
    `;

    // Pass user to header after it's mounted
    const header = this.shadow.getElementById('header');
    if (header) header.user = getUser();
  }

  bindEvents() {
    // Navigation from sidebar
    this.shadow.getElementById('sidebar')?.addEventListener('sidebar-navigate', (e) => {
      navigate(e.detail.path);
    });

    // Header events
    this.shadow.getElementById('header')?.addEventListener('header-logout', async () => {
      await logout();
      navigate('#/login');
    });
    this.shadow.getElementById('header')?.addEventListener('header-profile', () => {
      navigate('#/settings');
    });
    this.shadow.getElementById('header')?.addEventListener('header-password', () => {
      navigate('#/settings');
    });

    // Route changes
    on('route:changed', (detail) => {
      this.handleRouteChange(detail);
    });

    // Auth state changes
    on('auth:changed', (detail) => {
      this._authenticated = detail.authenticated;
      this.render();
      this.bindEvents();
    });
  }

  async handleRouteChange({ path, config, found }) {
    // Route guard: check auth for non-public routes
    if (config && !config.public && !isAuthenticated()) {
      navigate('#/login');
      return;
    }

    // Redirect authenticated users away from login/register
    if (config && config.public && isAuthenticated()) {
      navigate('#/overview');
      return;
    }

    // Update active nav link
    this.shadow.getElementById('sidebar')?.setActive(path);

    const content = this.shadow.getElementById('content');

    if (!found) {
      // Default route based on auth state
      if (!path || path === '/') {
        navigate(isAuthenticated() ? '#/overview' : '#/login');
        return;
      }
      content.innerHTML = `
        <div class="not-found">
          <h2>Page not found</h2>
          <p>The route "${path}" does not exist.</p>
        </div>
      `;
      return;
    }

    await this.loadModule(config, content);
  }

  async loadModule(config, container) {
    container.innerHTML = '';

    // Auth routes use a different page component name
    const tagName = config.page || `pos-${config.module}-app`;
    const moduleName = config.module;

    if (!customElements.get(tagName)) {
      if (!moduleCache.has(tagName)) {
        try {
          const pagePath = config.page
            ? `../modules/${moduleName}/pages/${tagName}.js`
            : `../modules/${moduleName}/pages/${tagName}.js`;
          const modulePromise = import(pagePath);
          moduleCache.set(tagName, modulePromise);
          await modulePromise;
        } catch (err) {
          console.warn(`Module "${moduleName}" not found, using placeholder.`);
          if (!customElements.get(tagName)) {
            this.registerPlaceholder(tagName, moduleName);
          }
        }
      } else {
        await moduleCache.get(tagName);
      }
    }

    const el = document.createElement(tagName);
    container.appendChild(el);
    this.currentModule = moduleName;
  }

  registerPlaceholder(tagName, moduleName) {
    const label = moduleName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    customElements.define(tagName, class extends HTMLElement {
      connectedCallback() {
        this.attachShadow({ mode: 'open' }).innerHTML = `
          <style>
            :host {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 60vh;
              color: var(--pos-color-text-secondary);
            }
            h2 { margin: 0 0 var(--pos-space-sm); font-size: 28px; }
            p { margin: 0; font-size: 16px; }
          </style>
          <h2>${label}</h2>
          <p>Coming soon</p>
        `;
      }
    });
  }

}

customElements.define('pos-app-shell', PosAppShell);
