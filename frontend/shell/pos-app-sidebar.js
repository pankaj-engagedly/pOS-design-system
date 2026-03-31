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
    // Highlight "More" tab if active path is a secondary route
    const moreTab = this.shadow.getElementById('more-tab');
    if (moreTab) {
      const primaryPaths = ['/overview', '/todos', '/notes', '/knowledge-base'];
      moreTab.classList.toggle('active', !primaryPaths.includes(path));
    }
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

        /* ── Mobile: fixed bottom tab bar ── */
        @media (max-width: 768px) {
          :host, :host([collapsed]) {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100% !important;
            height: 56px;
            z-index: 100;
            flex-direction: row;
            border-right: none;
            border-top: 1px solid var(--pos-color-border-default);
            overflow: visible;
          }

          .brand { display: none; }

          nav {
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
          }

          /* Hide all nav items except the 5 primary tabs */
          .nav-item-wrap { display: none; }
          .nav-item-wrap[data-mobile-tab] {
            display: flex;
            flex: 1;
            justify-content: center;
          }

          .nav-divider { display: none; }

          .nav-item {
            flex-direction: column;
            gap: 2px;
            padding: 6px 0;
            font-size: 10px;
            justify-content: center;
            align-items: center;
          }

          .nav-icon { width: 22px; }

          .nav-label {
            display: block !important;
            font-size: 10px;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 64px;
            white-space: nowrap;
          }

          /* Hide collapsed-mode overrides */
          :host([collapsed]) .nav-label { display: block !important; }

          .nav-tooltip { display: none !important; }

          /* ── "More" popup ── */
          .more-popup {
            display: none;
            position: absolute;
            bottom: 56px;
            right: 0;
            width: 200px;
            background: var(--pos-color-background-secondary);
            border: 1px solid var(--pos-color-border-default);
            border-radius: var(--pos-radius-md) var(--pos-radius-md) 0 0;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.12);
            padding: var(--pos-space-xs) 0;
            z-index: 200;
          }

          .more-popup.open { display: block; }

          .more-popup .nav-item {
            flex-direction: row;
            gap: var(--pos-space-sm);
            padding: 10px 16px;
            font-size: var(--pos-font-size-sm);
            justify-content: flex-start;
            align-items: center;
            border-radius: 0;
          }
          .more-popup .nav-item:hover {
            background: var(--pos-color-background-primary);
          }
          .more-popup .nav-label {
            font-size: var(--pos-font-size-sm);
            text-align: left;
          }

          .more-overlay {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 150;
          }
          .more-overlay.open { display: block; }
        }

        /* Hide mobile-only elements on desktop */
        @media (min-width: 769px) {
          .mobile-more-tab { display: none !important; }
          .more-popup { display: none !important; }
          .more-overlay { display: none !important; }
        }
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
          const mobileTabs = ['/overview', '/todos', '/notes', '/knowledge-base'];
          const isMobileTab = mobileTabs.includes(r.path);
          return `${divider}
          <div class="nav-item-wrap" ${isMobileTab ? 'data-mobile-tab' : ''}>
            <div class="nav-item ${this._activePath === r.path ? 'active' : ''}" data-path="${r.path}" tabindex="0" role="button">
              <span class="nav-icon">${icon(r.icon, 16)}</span>
              <span class="nav-label">${r.label}</span>
            </div>
            <span class="nav-tooltip">${r.label}</span>
          </div>`;
        }).join('')}
        <!-- Mobile "More" tab -->
        <div class="nav-item-wrap mobile-more-tab" data-mobile-tab>
          <div class="nav-item" id="more-tab" tabindex="0" role="button">
            <span class="nav-icon">${icon('more-horizontal', 16)}</span>
            <span class="nav-label">More</span>
          </div>
        </div>
      </nav>

      <!-- Mobile "More" popup overlay + menu -->
      <div class="more-overlay" id="more-overlay"></div>
      <div class="more-popup" id="more-popup">
        ${routes.filter(r => !['/overview', '/todos', '/notes', '/knowledge-base'].includes(r.path)).map(r => `
          <div class="nav-item ${this._activePath === r.path ? 'active' : ''}" data-path="${r.path}" tabindex="0" role="button">
            <span class="nav-icon">${icon(r.icon, 16)}</span>
            <span class="nav-label">${r.label}</span>
          </div>
        `).join('')}
      </div>
    `;

    this._applyCollapsed();
  }

  _bindEvents() {
    // Nav item clicks
    this.shadow.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');

      // "More" tab toggle
      if (item && item.id === 'more-tab') {
        this._toggleMorePopup();
        return;
      }

      if (item?.dataset.path) {
        // Close "More" popup if open
        this._closeMorePopup();
        this.dispatchEvent(new CustomEvent('sidebar-navigate', {
          bubbles: true, composed: true,
          detail: { path: item.dataset.path },
        }));
      }

      // "More" overlay dismiss
      if (e.target.closest('#more-overlay')) {
        this._closeMorePopup();
        return;
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

  _toggleMorePopup() {
    const popup = this.shadow.getElementById('more-popup');
    const overlay = this.shadow.getElementById('more-overlay');
    if (popup && overlay) {
      const isOpen = popup.classList.contains('open');
      popup.classList.toggle('open', !isOpen);
      overlay.classList.toggle('open', !isOpen);
    }
  }

  _closeMorePopup() {
    const popup = this.shadow.getElementById('more-popup');
    const overlay = this.shadow.getElementById('more-overlay');
    if (popup) popup.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
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
