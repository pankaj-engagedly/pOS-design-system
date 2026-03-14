import { register } from '../../../shared/services/auth-store.js';
import { navigate } from '../../../shared/services/router.js';

class PosAuthRegister extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
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

        .register-card {
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

        input.invalid {
          border-color: #dc2626;
        }

        .field-error {
          margin-top: 4px;
          font-size: 12px;
          color: #dc2626;
          display: none;
        }

        .field-error.visible {
          display: block;
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
      </style>

      <div class="register-card">
        <h1>Create account</h1>
        <p class="subtitle">Get started with pOS</p>

        <div class="error" id="error"></div>

        <form id="register-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" required autocomplete="name" />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autocomplete="email" />
            <div class="field-error" id="email-error">Please enter a valid email address</div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password" />
            <div class="field-error" id="password-error">Password must be at least 8 characters</div>
          </div>

          <div class="form-group">
            <label for="confirm-password">Confirm password</label>
            <input type="password" id="confirm-password" name="confirm-password" required autocomplete="new-password" />
            <div class="field-error" id="confirm-error">Passwords do not match</div>
          </div>

          <button type="submit" id="submit-btn">Create account</button>
        </form>

        <div class="footer">
          Already have an account? <a id="login-link">Log in</a>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.shadow.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    this.shadow.getElementById('login-link').addEventListener('click', () => {
      navigate('#/login');
    });
  }

  validate() {
    let valid = true;
    const password = this.shadow.getElementById('password');
    const confirm = this.shadow.getElementById('confirm-password');
    const passwordError = this.shadow.getElementById('password-error');
    const confirmError = this.shadow.getElementById('confirm-error');

    // Reset
    passwordError.classList.remove('visible');
    confirmError.classList.remove('visible');
    password.classList.remove('invalid');
    confirm.classList.remove('invalid');

    if (password.value.length < 8) {
      passwordError.classList.add('visible');
      password.classList.add('invalid');
      valid = false;
    }

    if (password.value !== confirm.value) {
      confirmError.classList.add('visible');
      confirm.classList.add('invalid');
      valid = false;
    }

    return valid;
  }

  async handleRegister() {
    if (!this.validate()) return;

    const name = this.shadow.getElementById('name').value;
    const email = this.shadow.getElementById('email').value;
    const password = this.shadow.getElementById('password').value;
    const errorEl = this.shadow.getElementById('error');
    const submitBtn = this.shadow.getElementById('submit-btn');

    errorEl.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      await register(name, email, password);
      navigate('#/todos');
    } catch (err) {
      errorEl.textContent = err.message || 'Registration failed';
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  }
}

customElements.define('pos-auth-register', PosAuthRegister);
