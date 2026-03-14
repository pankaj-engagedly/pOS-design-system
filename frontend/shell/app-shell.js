import { on } from '../shared/services/event-bus.js';
import { initRouter, navigate, getAllRoutes, getRouteConfig } from '../shared/services/router.js';
import { isAuthenticated, getUser, logout, tryRestoreSession } from '../shared/services/auth-store.js';

const moduleCache = new Map();

class PosAppShell extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.currentModule = null;
    this._authenticated = false;
    this._sidebarCollapsed = false;
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
    const routes = getAllRoutes();
    const user = getUser();
    const isDark = document.documentElement.getAttribute('data-pos-theme') === 'dark';

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: var(--pos-font-family-default, system-ui, -apple-system, sans-serif);
          color: var(--pos-color-text-primary);
          background: var(--pos-color-background-primary);
        }

        /* --- Header --- */
        .header {
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

        .header.hidden { display: none; }

        .header-left {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          min-width: 0;
        }

        .header-left h1 {
          margin: 0;
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-bold);
          letter-spacing: -0.5px;
        }

        .collapse-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--pos-font-size-md);
          color: var(--pos-color-text-secondary);
          padding: var(--pos-space-xs);
          border-radius: var(--pos-radius-sm);
          display: flex;
          align-items: center;
        }
        .collapse-btn:hover {
          background: var(--pos-color-background-secondary);
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
          max-width: 480px;
          margin: 0 auto;
        }

        .search-input {
          width: 100%;
          padding: var(--pos-space-xs) var(--pos-space-md);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-primary);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          outline: none;
        }
        .search-input:focus {
          border-color: var(--pos-color-action-primary);
        }
        .search-input::placeholder {
          color: var(--pos-color-text-disabled);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          margin-left: auto;
        }

        .theme-toggle {
          background: none;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          padding: var(--pos-space-xs);
          cursor: pointer;
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          display: flex;
          align-items: center;
        }
        .theme-toggle:hover {
          background: var(--pos-color-background-secondary);
        }

        .user-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-medium);
          color: var(--pos-color-text-primary);
          white-space: nowrap;
        }

        .logout-btn {
          background: none;
          border: 1px solid var(--pos-color-border-default);
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          font-size: var(--pos-raw-font-size-xs);
          padding: var(--pos-space-xs) var(--pos-space-sm);
          border-radius: var(--pos-radius-sm);
          font-family: inherit;
        }
        .logout-btn:hover {
          color: var(--pos-color-text-primary);
          background: var(--pos-color-background-secondary);
        }

        /* --- Body (sidebar + content) --- */
        .body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .body.hidden-sidebar .sidebar { display: none; }

        .sidebar {
          width: 220px;
          min-width: 220px;
          background: var(--pos-color-background-secondary);
          border-right: 1px solid var(--pos-color-border-default);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          transition: width 0.15s ease, min-width 0.15s ease;
        }

        .sidebar.collapsed {
          width: 48px;
          min-width: 48px;
          overflow: hidden;
        }

        .sidebar.collapsed nav { padding: var(--pos-space-xs); }
        .sidebar.collapsed .nav-link { justify-content: center; padding: var(--pos-space-sm); }
        .sidebar.collapsed .nav-label { display: none; }

        nav {
          padding: var(--pos-space-sm);
          flex: 1;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-radius: var(--pos-radius-md);
          text-decoration: none;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-medium);
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          transition: background-color 0.15s ease, color 0.15s ease;
          font-family: inherit;
        }

        .nav-link:hover {
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
        }

        .nav-link.active {
          background: var(--pos-color-action-primary);
          color: var(--pos-color-background-primary);
        }

        .nav-icon {
          width: 18px;
          text-align: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .content {
          flex: 1;
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
      </style>

      <!-- Header -->
      <header class="header ${this._authenticated ? '' : 'hidden'}">
        <div class="header-left">
          <button class="collapse-btn" id="collapse-btn" title="Toggle sidebar">\u2630</button>
          <h1>pOS</h1>
        </div>
        <div class="header-center">
          <input class="search-input" type="text" placeholder="Search..." disabled />
        </div>
        <div class="header-right">
          <button class="theme-toggle" id="theme-toggle" title="Toggle theme">
            <span id="theme-icon">${isDark ? '\uD83C\uDF19' : '\u2600\uFE0F'}</span>
          </button>
          ${user ? `
            <span class="user-name">${this._escapeHtml(user.name || user.email)}</span>
            <button class="logout-btn" id="logout-btn">Logout</button>
          ` : ''}
        </div>
      </header>

      <!-- Body -->
      <div class="body ${this._authenticated ? '' : 'hidden-sidebar'}">
        <aside class="sidebar ${this._sidebarCollapsed ? 'collapsed' : ''}">
          <nav>
            ${routes.map(r => `
              <button class="nav-link" data-path="${r.path}">
                <span class="nav-icon">${this.getIcon(r.icon)}</span>
                <span class="nav-label">${r.label}</span>
              </button>
            `).join('')}
          </nav>
        </aside>
        <main class="content" id="content"></main>
      </div>
    `;
  }

  getIcon(name) {
    const icons = {
      'check-square': '\u2611',
      'file-text': '\uD83D\uDCDD',
      'book-open': '\uD83D\uDCDA',
      'lock': '\uD83D\uDD12',
      'rss': '\uD83D\uDCE1',
      'folder': '\uD83D\uDCC1',
      'image': '\uD83D\uDDBC',
      'settings': '\u2699',
    };
    return icons[name] || '\u2022';
  }

  bindEvents() {
    // Navigation clicks
    this.shadow.querySelector('nav')?.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      if (link) {
        navigate(link.dataset.path);
      }
    });

    // Sidebar collapse toggle
    this.shadow.getElementById('collapse-btn')?.addEventListener('click', () => {
      this._sidebarCollapsed = !this._sidebarCollapsed;
      this.shadow.querySelector('.sidebar')?.classList.toggle('collapsed', this._sidebarCollapsed);
    });

    // Theme toggle
    this.shadow.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Logout
    this.shadow.getElementById('logout-btn')?.addEventListener('click', async () => {
      await logout();
      navigate('#/login');
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

  toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-pos-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    root.setAttribute('data-pos-theme', next);

    const icon = this.shadow.getElementById('theme-icon');
    if (icon) icon.textContent = next === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }

  async handleRouteChange({ path, config, found }) {
    // Route guard: check auth for non-public routes
    if (config && !config.public && !isAuthenticated()) {
      navigate('#/login');
      return;
    }

    // Redirect authenticated users away from login/register
    if (config && config.public && isAuthenticated()) {
      navigate('#/todos');
      return;
    }

    // Update active nav link
    this.shadow.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.path === path);
    });

    const content = this.shadow.getElementById('content');

    if (!found) {
      // Default route based on auth state
      if (!path || path === '/') {
        navigate(isAuthenticated() ? '#/todos' : '#/login');
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

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define('pos-app-shell', PosAppShell);
