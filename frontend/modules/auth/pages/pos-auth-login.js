import { login, verifyTotp } from '../../../shared/services/auth-store.js';
import { navigate } from '../../../shared/services/router.js';

class PosAuthLogin extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._mfaToken = null; // set when MFA is required
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          font-family: var(--pos-font-family, system-ui, -apple-system, sans-serif);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 40px;
          background: var(--pos-color-bg-secondary, #f8f9fa);
          border: 1px solid var(--pos-color-border-default, #e2e8f0);
          border-radius: 12px;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 700;
          color: var(--pos-color-text-primary, #1a1a2e);
        }

        .subtitle {
          margin: 0 0 32px;
          color: var(--pos-color-text-secondary, #64748b);
          font-size: 14px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
          color: var(--pos-color-text-primary, #1a1a2e);
        }

        input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--pos-color-border-default, #e2e8f0);
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          background: var(--pos-color-bg-primary, #ffffff);
          color: var(--pos-color-text-primary, #1a1a2e);
          box-sizing: border-box;
        }

        input:focus {
          outline: none;
          border-color: var(--pos-color-border-focus, #2563eb);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        input.totp-input {
          font-size: 24px;
          text-align: center;
          letter-spacing: 8px;
          font-weight: 600;
        }

        .error {
          margin: 0 0 16px;
          padding: 10px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
          display: none;
        }

        .error.visible {
          display: block;
        }

        button[type="submit"] {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: var(--pos-color-bg-accent, #2563eb);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        button[type="submit"]:hover {
          opacity: 0.9;
        }

        button[type="submit"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .footer {
          margin-top: 24px;
          text-align: center;
          font-size: 14px;
          color: var(--pos-color-text-secondary, #64748b);
        }

        .footer a {
          color: var(--pos-color-text-accent, #2563eb);
          text-decoration: none;
          cursor: pointer;
        }

        .footer a:hover {
          text-decoration: underline;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--pos-color-text-secondary, #64748b);
          cursor: pointer;
        }
        .back-link:hover { color: var(--pos-color-text-primary, #1a1a2e); }

        .hidden { display: none; }
      </style>

      <div class="login-card">
        <!-- Step 1: Email + Password -->
        <div id="step-login" class="${this._mfaToken ? 'hidden' : ''}">
          <h1>Welcome back</h1>
          <p class="subtitle">Sign in to your pOS account</p>

          <div class="error" id="error"></div>

          <form id="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required autocomplete="email" />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required autocomplete="current-password" />
            </div>

            <button type="submit" id="submit-btn">Sign in</button>
          </form>

          <div class="footer">
            Don't have an account? <a id="register-link">Register</a>
          </div>
        </div>

        <!-- Step 2: TOTP Verification -->
        <div id="step-mfa" class="${this._mfaToken ? '' : 'hidden'}">
          <a class="back-link" id="back-link">&larr; Back</a>
          <h1>Verification</h1>
          <p class="subtitle">Enter the 6-digit code from your authenticator app</p>

          <div class="error" id="mfa-error"></div>

          <form id="mfa-form">
            <div class="form-group">
              <input type="text" id="totp-code" class="totp-input" maxlength="6"
                     pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code"
                     placeholder="000000" required />
            </div>

            <button type="submit" id="mfa-submit-btn">Verify</button>
          </form>

          <div class="footer">
            Lost your authenticator? Use a backup code
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.shadow.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    this.shadow.getElementById('register-link').addEventListener('click', () => {
      navigate('#/register');
    });

    this.shadow.getElementById('mfa-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleMfa();
    });

    this.shadow.getElementById('back-link').addEventListener('click', () => {
      this._mfaToken = null;
      this.render();
      this.bindEvents();
    });

    // Auto-submit when 6 digits are entered
    this.shadow.getElementById('totp-code')?.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val.length === 6) {
        this.handleMfa();
      }
    });
  }

  async handleLogin() {
    const email = this.shadow.getElementById('email').value;
    const password = this.shadow.getElementById('password').value;
    const errorEl = this.shadow.getElementById('error');
    const submitBtn = this.shadow.getElementById('submit-btn');

    errorEl.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const result = await login(email, password);
      if (result?.requires_mfa) {
        // Show TOTP step
        this._mfaToken = result.mfa_token;
        this.render();
        this.bindEvents();
        setTimeout(() => this.shadow.getElementById('totp-code')?.focus(), 50);
      } else {
        navigate('#/todos');
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid email or password';
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  }

  async handleMfa() {
    const code = this.shadow.getElementById('totp-code').value.trim();
    if (code.length !== 6) return;

    const errorEl = this.shadow.getElementById('mfa-error');
    const submitBtn = this.shadow.getElementById('mfa-submit-btn');

    errorEl.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
      await verifyTotp(this._mfaToken, code);
      navigate('#/todos');
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid code';
      errorEl.classList.add('visible');
      this.shadow.getElementById('totp-code').value = '';
      this.shadow.getElementById('totp-code').focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify';
    }
  }
}

customElements.define('pos-auth-login', PosAuthLogin);
