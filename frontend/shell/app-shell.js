import { on } from '../shared/services/event-bus.js';
import { initRouter, navigate, getAllRoutes, getCurrentRoute } from '../shared/services/router.js';

const moduleCache = new Map();

class PosAppShell extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.currentModule = null;
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
    initRouter();
  }

  render() {
    const routes = getAllRoutes();

    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          height: 100vh;
          font-family: var(--pos-font-family, system-ui, -apple-system, sans-serif);
          color: var(--pos-color-text-primary, #1a1a2e);
          background: var(--pos-color-bg-primary, #ffffff);
        }

        .sidebar {
          width: 240px;
          min-width: 240px;
          background: var(--pos-color-bg-secondary, #f8f9fa);
          border-right: 1px solid var(--pos-color-border-default, #e2e8f0);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .sidebar-header {
          padding: 20px 16px;
          border-bottom: 1px solid var(--pos-color-border-default, #e2e8f0);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .theme-toggle {
          background: none;
          border: 1px solid var(--pos-color-border-default, #e2e8f0);
          border-radius: 6px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--pos-color-text-primary, #1a1a2e);
        }

        .theme-toggle:hover {
          background: var(--pos-color-bg-hover, #e2e8f0);
        }

        nav {
          padding: 8px;
          flex: 1;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--pos-color-text-secondary, #64748b);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          transition: background 0.15s, color 0.15s;
        }

        .nav-link:hover {
          background: var(--pos-color-bg-hover, #e2e8f0);
          color: var(--pos-color-text-primary, #1a1a2e);
        }

        .nav-link.active {
          background: var(--pos-color-bg-active, #dbeafe);
          color: var(--pos-color-text-accent, #2563eb);
        }

        .nav-icon {
          width: 18px;
          text-align: center;
          font-size: 16px;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .not-found {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--pos-color-text-secondary, #64748b);
        }

        .not-found h2 {
          margin: 0 0 8px;
          font-size: 24px;
        }
      </style>

      <aside class="sidebar">
        <div class="sidebar-header">
          <h1>pOS</h1>
          <button class="theme-toggle" id="theme-toggle" title="Toggle theme">
            <span id="theme-icon">☀️</span>
          </button>
        </div>
        <nav>
          ${routes.map(r => `
            <button class="nav-link" data-path="${r.path}">
              <span class="nav-icon">${this.getIcon(r.icon)}</span>
              ${r.label}
            </button>
          `).join('')}
        </nav>
      </aside>

      <main class="content" id="content">
      </main>
    `;
  }

  getIcon(name) {
    const icons = {
      'check-square': '☑',
      'file-text': '📝',
      'book-open': '📚',
      'lock': '🔒',
      'rss': '📡',
      'folder': '📁',
      'image': '🖼',
      'settings': '⚙',
    };
    return icons[name] || '•';
  }

  bindEvents() {
    // Navigation clicks
    this.shadow.querySelector('nav').addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      if (link) {
        navigate(link.dataset.path);
      }
    });

    // Theme toggle
    this.shadow.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Route changes
    on('route:changed', (detail) => {
      this.handleRouteChange(detail);
    });
  }

  toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-pos-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    root.setAttribute('data-pos-theme', next);

    const icon = this.shadow.getElementById('theme-icon');
    icon.textContent = next === 'light' ? '☀️' : '🌙';
  }

  async handleRouteChange({ path, config, found }) {
    // Update active nav link
    this.shadow.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.path === path);
    });

    const content = this.shadow.getElementById('content');

    if (!found) {
      content.innerHTML = `
        <div class="not-found">
          <h2>Page not found</h2>
          <p>The route "${path}" does not exist.</p>
        </div>
      `;
      return;
    }

    await this.loadModule(config.module, content);
  }

  async loadModule(moduleName, container) {
    // Remove previous module
    container.innerHTML = '';

    const tagName = `pos-${moduleName}-app`;

    // Check if already defined
    if (!customElements.get(tagName)) {
      // Check cache or load
      if (!moduleCache.has(moduleName)) {
        try {
          const modulePromise = import(`../modules/${moduleName}/pages/${tagName}.js`);
          moduleCache.set(moduleName, modulePromise);
          await modulePromise;
        } catch (err) {
          console.warn(`Module "${moduleName}" not found, using placeholder.`);
          // Register a placeholder if the module file doesn't exist
          if (!customElements.get(tagName)) {
            this.registerPlaceholder(tagName, moduleName);
          }
        }
      } else {
        await moduleCache.get(moduleName);
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
              color: var(--pos-color-text-secondary, #64748b);
            }
            h2 { margin: 0 0 8px; font-size: 28px; }
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
