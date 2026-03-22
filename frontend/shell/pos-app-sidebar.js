import { getAllRoutes } from '../shared/services/router.js';
import { icon } from '../shared/utils/icons.js';

class PosAppSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._collapsed = true; // collapsed by default
    this._activePath = null;
  }

  connectedCallback() {
    // Honour an explicit 'collapsed' attribute if set, otherwise stay collapsed
    if (this.hasAttribute('collapsed')) {
      this._collapsed = true;
    }
    this._render();
    this._bindEvents();
  }

  // Public API — called by app-shell header collapse button
  toggle() {
    this._collapsed = !this._collapsed;
    this._applyCollapsed();
  }

  setActive(path) {
    this._activePath = path;
    this.shadow.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === path);
    });
  }

  _render() {
    const routes = getAllRoutes();
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 220px;
          background: var(--pos-color-background-secondary);
          border-right: 1px solid var(--pos-color-border-default);
          overflow: visible;
          transition: width 0.18s ease;
          flex-shrink: 0;
          position: relative;
          z-index: 20;
        }

        :host([collapsed]) { width: 48px; }

        /* ── Brand block ── */
        .brand {
          position: relative;          /* anchor for the absolute toggle btn */
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm);
          height: 48px;                /* match app header height */
          border-bottom: 1px solid var(--pos-color-border-default);
          overflow: visible;           /* let the button overflow the right edge */
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .brand-icon {
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: var(--pos-radius-sm);
          background: var(--pos-color-action-primary);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: var(--pos-font-weight-bold);
          letter-spacing: -0.5px;
          user-select: none;
        }

        .brand-text {
          overflow: hidden;
          min-width: 0;
        }

        .brand-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-bold);
          color: var(--pos-color-text-primary);
          white-space: nowrap;
          line-height: 1.2;
        }

        .brand-tagline {
          font-size: 10px;
          color: var(--pos-color-text-secondary);
          white-space: nowrap;
          font-style: italic;
        }

        :host([collapsed]) .brand-text { display: none; }

        /* ── Toggle button — floats on the right border, aligned with brand ── */
        .toggle-btn {
          position: absolute;
          right: -12px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: 50%;
          background: var(--pos-color-background-secondary);
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          line-height: 0;
          padding: 0;
          transition: background 0.12s, color 0.12s, box-shadow 0.12s;
        }
        .toggle-btn:hover {
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
        .toggle-btn svg {
          pointer-events: none;
          display: block;
        }

        /* ── Nav list ── */
        nav {
          display: flex;
          flex-direction: column;
          padding: var(--pos-space-sm) var(--pos-space-xs) var(--pos-space-xs);
          flex: 1;
          overflow: visible;
        }

        /* ── Each item wrapper — handles tooltip ── */
        .nav-item-wrap {
          position: relative;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: 7px 10px;
          border-radius: var(--pos-radius-sm);
          cursor: pointer;
          color: var(--pos-color-text-secondary);
          font-size: var(--pos-font-size-sm);
          white-space: nowrap;
          overflow: hidden;
          transition: background 0.1s, color 0.1s;
          user-select: none;
        }
        .nav-item:hover {
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
        }
        .nav-item.active {
          background: color-mix(in srgb, var(--pos-color-action-primary) 12%, transparent);
          color: var(--pos-color-action-primary);
          font-weight: var(--pos-font-weight-medium);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 20px;
          line-height: 0;
        }
        .nav-icon svg {
          pointer-events: none;
          display: block;
        }

        .nav-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 0.15s ease, width 0.15s ease;
        }

        /* Label hidden when collapsed */
        :host([collapsed]) .nav-label { display: none; }

        /* ── Divider between groups ── */
        .nav-divider {
          height: 1px;
          background: var(--pos-color-border-default);
          margin: var(--pos-space-xs) 10px;
        }

        /* ── Hover tooltip (collapsed only) ── */
        .nav-tooltip {
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: var(--pos-color-text-primary);
          color: var(--pos-color-background-primary);
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-medium);
          padding: 4px 10px;
          border-radius: var(--pos-radius-sm);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.12s ease;
          z-index: 100;
          /* Arrow */
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .nav-tooltip::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-right-color: var(--pos-color-text-primary);
        }

        /* Only show tooltip in collapsed mode on hover */
        :host([collapsed]) .nav-item-wrap:hover .nav-tooltip { opacity: 1; }
        /* Never show tooltip in expanded mode */
        :host(:not([collapsed])) .nav-tooltip { display: none; }
      </style>

      <div class="brand">
        <div class="brand-icon">pOS</div>
        <div class="brand-text">
          <div class="brand-name">Personal OS</div>
          <div class="brand-tagline">your life, organized</div>
        </div>
        <button class="toggle-btn" id="toggle" title="${this._collapsed ? 'Expand sidebar' : 'Collapse sidebar'}">
          ${this._collapsed ? icon('chevron-right', 16) : icon('chevron-left', 16)}
        </button>
      </div>

      <nav>
        ${routes.map((r, i) => {
          const prevGroup = i > 0 ? routes[i - 1].group : null;
          const divider = prevGroup && r.group && r.group !== prevGroup ? '<div class="nav-divider"></div>' : '';
          return `${divider}
          <div class="nav-item-wrap">
            <div class="nav-item ${this._activePath === r.path ? 'active' : ''}" data-path="${r.path}" tabindex="0" role="button">
              <span class="nav-icon">${icon(r.icon, 16)}</span>
              <span class="nav-label">${r.label}</span>
            </div>
            <span class="nav-tooltip">${r.label}</span>
          </div>`;
        }).join('')}
      </nav>
    `;

    this._applyCollapsed();
  }

  _bindEvents() {
    // Nav item clicks
    this.shadow.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item?.dataset.path) {
        this.dispatchEvent(new CustomEvent('sidebar-navigate', {
          bubbles: true, composed: true,
          detail: { path: item.dataset.path },
        }));
      }

      // Toggle button
      if (e.target.closest('#toggle')) {
        this.toggle();
        // Sync title
        const btn = this.shadow.getElementById('toggle');
        if (btn) btn.title = this._collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      }
    });

    // Keyboard nav
    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.nav-item');
        if (item?.dataset.path) {
          e.preventDefault();
          this.dispatchEvent(new CustomEvent('sidebar-navigate', {
            bubbles: true, composed: true,
            detail: { path: item.dataset.path },
          }));
        }
      }
    });
  }

  _applyCollapsed() {
    this.toggleAttribute('collapsed', this._collapsed);
    const btn = this.shadow.getElementById('toggle');
    if (btn) {
      btn.innerHTML = this._collapsed ? icon('chevron-right', 16) : icon('chevron-left', 16);
      btn.title = this._collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
  }
}

customElements.define('pos-app-sidebar', PosAppSidebar);
