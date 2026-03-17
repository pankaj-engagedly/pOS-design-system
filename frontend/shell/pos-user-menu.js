// pos-user-menu — avatar trigger + dropdown with user info and actions
// Emits: user-logout, user-profile, user-password (all bubbles + composed)

const ICONS = {
  profile: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M13 14c0-2.76-2.24-5-5-5s-5 2.24-5 5"/>
    <circle cx="8" cy="5" r="3"/>
  </svg>`,
  password: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="3" y="7.5" width="10" height="6.5" rx="1.5"/>
    <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5"/>
  </svg>`,
  logout: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 13H3.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H6"/>
    <polyline points="10 11 13.5 8 10 5"/>
    <line x1="7" y1="8" x2="13.5" y2="8"/>
  </svg>`,
};

class PosUserMenu extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._user = null;
  }

  set user(val) {
    this._user = val;
    this._render();
  }

  connectedCallback() {
    this._render();
    // Bound once on shadow root — survives _render() calls
    this.shadow.addEventListener('click', (e) => this._handleClick(e));
  }

  _render() {
    const user = this._user;
    if (!user) {
      this.shadow.innerHTML = '';
      return;
    }

    const name  = this._esc(user.name || user.email);
    const email = this._esc(user.email || '');
    const src   = user.avatar ? ` src="${this._esc(user.avatar)}"` : '';

    this.shadow.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; }

        ui-avatar {
          cursor: pointer;
          border-radius: 50%;
          transition: box-shadow 0.15s ease;
        }
        ui-avatar:hover,
        ui-dropdown[open] ui-avatar {
          box-shadow: 0 0 0 2px var(--pos-color-action-primary);
        }

        /* ---- menu panel contents ---- */
        .menu { padding: var(--pos-space-xs) 0; }

        .user-info {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          padding: var(--pos-space-sm) var(--pos-space-md);
          border-bottom: 1px solid var(--pos-color-border-default);
          margin-bottom: var(--pos-space-xs);
        }

        .user-info-text { min-width: 0; }

        .user-name {
          display: block;
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          display: block;
          font-size: var(--pos-raw-font-size-xs);
          color: var(--pos-color-text-secondary);
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: var(--pos-space-sm);
          width: 100%;
          padding: var(--pos-space-sm) var(--pos-space-md);
          border: none;
          background: none;
          font-family: var(--pos-font-family-default);
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          cursor: pointer;
          text-align: left;
          transition: background-color 0.1s ease;
        }

        .menu-item:hover { background: var(--pos-color-background-secondary); }

        .menu-item .icon {
          display: flex;
          align-items: center;
          color: var(--pos-color-text-secondary);
          flex-shrink: 0;
        }

        .menu-divider {
          height: 1px;
          background: var(--pos-color-border-default);
          margin: var(--pos-space-xs) 0;
        }

        .menu-item.danger { color: var(--pos-color-priority-urgent); }
        .menu-item.danger .icon { color: var(--pos-color-priority-urgent); }
        .menu-item.danger:hover {
          background: color-mix(in srgb, var(--pos-color-priority-urgent) 8%, transparent);
        }
      </style>

      <ui-dropdown>
        <ui-avatar slot="trigger" size="md" name="${name}"${src}></ui-avatar>

        <div class="menu">
          <div class="user-info">
            <ui-avatar size="sm" name="${name}"${src}></ui-avatar>
            <div class="user-info-text">
              <span class="user-name">${name}</span>
              ${email ? `<span class="user-email">${email}</span>` : ''}
            </div>
          </div>

          <button class="menu-item" data-action="profile">
            <span class="icon">${ICONS.profile}</span>
            Edit Profile
          </button>
          <button class="menu-item" data-action="password">
            <span class="icon">${ICONS.password}</span>
            Change Password
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item danger" data-action="logout">
            <span class="icon">${ICONS.logout}</span>
            Logout
          </button>
        </div>
      </ui-dropdown>
    `;
  }

  _handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    // Close dropdown before firing the action event
    this.shadow.querySelector('ui-dropdown')?.close();

    this.dispatchEvent(new CustomEvent(`user-${btn.dataset.action}`, {
      bubbles: true,
      composed: true,
    }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-user-menu', PosUserMenu);
