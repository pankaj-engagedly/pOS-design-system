// pos-settings-app — Profile, password, and MFA settings
import { getUser } from '../../../shared/services/auth-store.js';
import { apiFetch } from '../../../shared/services/api-client.js';
import { icon } from '../../../shared/utils/icons.js';

class PosSettingsApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._user = null;
    this._totpSetup = null;
    this._backupCodes = null;
    this._message = null;
    this._eventsBound = false;
  }

  connectedCallback() {
    this._user = getUser();
    this._render();
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
  }

  _render() {
    const u = this._user;
    if (!u) { this.shadow.innerHTML = ''; return; }

    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; overflow-y: auto; background: var(--pos-color-background-primary); }
        .container { max-width: 640px; margin: 0 auto; padding: var(--pos-space-lg) var(--pos-space-md); }
        h1 { font-size: 22px; font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-primary); margin: 0 0 var(--pos-space-lg); }
        .section { margin-bottom: var(--pos-space-xl); }
        .section-title {
          display: flex; align-items: center; gap: var(--pos-space-sm);
          font-size: var(--pos-font-size-sm); font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary); margin: 0 0 var(--pos-space-sm);
          padding-bottom: var(--pos-space-xs); border-bottom: 1px solid var(--pos-color-border-default);
        }
        .form-row { display: flex; align-items: center; gap: var(--pos-space-sm); margin-bottom: var(--pos-space-sm); }
        .form-label { width: 120px; font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); flex-shrink: 0; }
        .form-input {
          flex: 1; padding: 8px 10px; font-size: var(--pos-font-size-xs); font-family: inherit;
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
          outline: none; box-sizing: border-box;
        }
        .form-input:focus { border-color: var(--pos-color-action-primary); }
        .form-value { flex: 1; font-size: var(--pos-font-size-xs); color: var(--pos-color-text-primary); }
        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; font-size: var(--pos-font-size-xs); font-family: inherit;
          font-weight: var(--pos-font-weight-medium);
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
          cursor: pointer; transition: all 0.15s;
        }
        .btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .btn-primary { background: var(--pos-color-action-primary); color: white; border-color: var(--pos-color-action-primary); }
        .btn-primary:hover { opacity: 0.9; color: white; }
        .btn-danger { color: var(--pos-color-priority-urgent); }
        .btn-danger:hover { border-color: var(--pos-color-priority-urgent); }
        .btn-row { display: flex; gap: var(--pos-space-sm); margin-top: var(--pos-space-sm); }
        .msg {
          padding: 8px 12px; border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs); margin-bottom: var(--pos-space-sm);
        }
        .msg-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .msg-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .mfa-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
        }
        .mfa-on { background: #dcfce7; color: #16a34a; }
        .mfa-off { background: #fef3c7; color: #d97706; }
        .secret-display {
          font-family: monospace; font-size: 14px; letter-spacing: 2px;
          padding: 8px 12px; background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          user-select: all; margin: var(--pos-space-xs) 0;
        }
        .backup-codes {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
          font-family: monospace; font-size: 13px;
          padding: var(--pos-space-sm); background: var(--pos-color-background-secondary);
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          margin: var(--pos-space-xs) 0;
        }
        .backup-codes span { padding: 4px 8px; }
        .mfa-step { margin: var(--pos-space-sm) 0; }
        .mfa-step-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--pos-color-action-primary); color: white;
          font-size: 11px; font-weight: 600; margin-right: 6px;
        }
        .mfa-step-text { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-primary); }
        .totp-input {
          width: 160px; padding: 8px 10px; font-size: 18px; text-align: center;
          letter-spacing: 6px; font-weight: 600; font-family: monospace;
          border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
          outline: none; background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
        }
        .totp-input:focus { border-color: var(--pos-color-action-primary); }
        .hint { font-size: 11px; color: var(--pos-color-text-disabled); margin-top: 2px; }
        .disable-form { display: none; margin-top: var(--pos-space-sm); }
        .disable-form.visible { display: block; }
      </style>

      <div class="container">
        <h1>Settings</h1>

        ${this._message ? `<div class="msg msg-${this._message.type}">${this._esc(this._message.text)}</div>` : ''}

        <!-- Profile -->
        <div class="section">
          <div class="section-title">${icon('user', 16)} Profile</div>
          <div class="form-row">
            <span class="form-label">Name</span>
            <input class="form-input" id="profile-name" value="${this._escAttr(u.name)}" />
          </div>
          <div class="form-row">
            <span class="form-label">Email</span>
            <span class="form-value">${this._esc(u.email)}</span>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="save-profile">Save Profile</button>
          </div>
        </div>

        <!-- Change Password -->
        <div class="section">
          <div class="section-title">${icon('lock', 16)} Change Password</div>
          <div class="form-row">
            <span class="form-label">Current</span>
            <input class="form-input" id="current-password" type="password" placeholder="Current password" />
          </div>
          <div class="form-row">
            <span class="form-label">New</span>
            <input class="form-input" id="new-password" type="password" placeholder="New password (min 8 chars)" />
          </div>
          <div class="form-row">
            <span class="form-label">Confirm</span>
            <input class="form-input" id="confirm-password" type="password" placeholder="Confirm new password" />
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="change-password">Change Password</button>
          </div>
        </div>

        <!-- MFA -->
        <div class="section">
          <div class="section-title">
            ${icon('shield', 16)} Two-Factor Authentication
            <span class="mfa-badge ${u.totp_enabled ? 'mfa-on' : 'mfa-off'}">
              ${u.totp_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          ${u.totp_enabled ? this._renderMfaEnabled() : this._renderMfaDisabled()}
        </div>
      </div>
    `;
  }

  _renderMfaDisabled() {
    if (this._backupCodes) {
      return `
        <p class="mfa-step-text">MFA is now enabled! Save these backup codes somewhere safe — they won't be shown again.</p>
        <div class="backup-codes">
          ${this._backupCodes.map(c => `<span>${c}</span>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="mfa-done">Done</button>
        </div>
      `;
    }

    if (this._totpSetup) {
      return `
        <div class="mfa-step">
          <span class="mfa-step-num">1</span>
          <span class="mfa-step-text">Open your authenticator app and add this account manually with the secret below:</span>
        </div>
        <div class="secret-display">${this._totpSetup.secret}</div>
        <p class="hint">Account: ${this._esc(this._user.email)} &middot; Issuer: pOS</p>

        <div class="mfa-step">
          <span class="mfa-step-num">2</span>
          <span class="mfa-step-text">Enter the 6-digit code from your app and your password to confirm:</span>
        </div>
        <div class="form-row">
          <span class="form-label">Code</span>
          <input class="totp-input" id="confirm-totp-code" maxlength="6" inputmode="numeric" placeholder="000000" />
        </div>
        <div class="form-row">
          <span class="form-label">Password</span>
          <input class="form-input" id="confirm-totp-password" type="password" placeholder="Your password" />
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="confirm-totp">Enable MFA</button>
          <button class="btn" id="cancel-totp">Cancel</button>
        </div>
      `;
    }

    return `
      <p class="mfa-step-text">Add an extra layer of security with a time-based one-time password (TOTP) from an authenticator app like Google Authenticator or Authy.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="setup-totp">${icon('shield', 14)} Set Up MFA</button>
      </div>
    `;
  }

  _renderMfaEnabled() {
    return `
      <p class="mfa-step-text">Your account is protected with two-factor authentication.</p>
      <div class="btn-row">
        <button class="btn btn-danger" id="disable-totp">Disable MFA</button>
      </div>
      <div class="disable-form" id="disable-form">
        <div class="form-row">
          <span class="form-label">Password</span>
          <input class="form-input" id="disable-totp-password" type="password" placeholder="Confirm your password" />
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" id="confirm-disable-totp">Confirm Disable</button>
          <button class="btn" id="cancel-disable-totp">Cancel</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.id;
      if (id === 'save-profile') return this._saveProfile();
      if (id === 'change-password') return this._changePassword();
      if (id === 'setup-totp') return this._setupTotp();
      if (id === 'confirm-totp') return this._confirmTotp();
      if (id === 'cancel-totp') { this._totpSetup = null; this._render(); }
      if (id === 'mfa-done') { this._backupCodes = null; this._user = { ...this._user, totp_enabled: true }; this._render(); }
      if (id === 'disable-totp') {
        const form = this.shadow.getElementById('disable-form');
        if (form) form.classList.add('visible');
      }
      if (id === 'cancel-disable-totp') {
        const form = this.shadow.getElementById('disable-form');
        if (form) form.classList.remove('visible');
      }
      if (id === 'confirm-disable-totp') return this._disableTotp();
    });
  }

  async _saveProfile() {
    const name = this.shadow.getElementById('profile-name')?.value.trim();
    if (!name) return this._showMsg('error', 'Name is required');
    try {
      const updated = await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      this._user = { ...this._user, name: updated.name };
      this._showMsg('success', 'Profile updated');
    } catch (err) { this._showMsg('error', err.message); }
  }

  async _changePassword() {
    const current = this.shadow.getElementById('current-password')?.value;
    const newPw = this.shadow.getElementById('new-password')?.value;
    const confirm = this.shadow.getElementById('confirm-password')?.value;
    if (!current || !newPw) return this._showMsg('error', 'All fields are required');
    if (newPw.length < 8) return this._showMsg('error', 'Password must be at least 8 characters');
    if (newPw !== confirm) return this._showMsg('error', 'Passwords do not match');
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST', body: JSON.stringify({ current_password: current, new_password: newPw }),
      });
      this.shadow.getElementById('current-password').value = '';
      this.shadow.getElementById('new-password').value = '';
      this.shadow.getElementById('confirm-password').value = '';
      this._showMsg('success', 'Password changed successfully');
    } catch (err) { this._showMsg('error', err.message); }
  }

  async _setupTotp() {
    try {
      const data = await apiFetch('/api/auth/setup-totp', { method: 'POST' });
      this._totpSetup = data;
      this._message = null;
      this._render();
    } catch (err) { this._showMsg('error', err.message); }
  }

  async _confirmTotp() {
    const code = this.shadow.getElementById('confirm-totp-code')?.value.trim();
    const password = this.shadow.getElementById('confirm-totp-password')?.value;
    if (!code || code.length !== 6) return this._showMsg('error', 'Enter a 6-digit code');
    if (!password) return this._showMsg('error', 'Password is required');
    try {
      const data = await apiFetch('/api/auth/confirm-totp', {
        method: 'POST', body: JSON.stringify({ totp_code: code, password }),
      });
      this._totpSetup = null;
      this._backupCodes = data.backup_codes;
      this._message = null;
      this._render();
    } catch (err) { this._showMsg('error', err.message); }
  }

  async _disableTotp() {
    const password = this.shadow.getElementById('disable-totp-password')?.value;
    if (!password) return this._showMsg('error', 'Password is required');
    try {
      await apiFetch('/api/auth/disable-totp', { method: 'POST', body: JSON.stringify({ password }) });
      this._user = { ...this._user, totp_enabled: false };
      this._showMsg('success', 'MFA disabled');
    } catch (err) { this._showMsg('error', err.message); }
  }

  _showMsg(type, text) {
    this._message = { type, text };
    this._render();
    if (type === 'success') setTimeout(() => { if (this._message?.type === 'success') { this._message = null; this._render(); } }, 5000);
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
  _escAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
}

customElements.define('pos-settings-app', PosSettingsApp);
