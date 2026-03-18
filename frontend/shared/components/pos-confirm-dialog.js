// pos-confirm-dialog — lightweight in-app confirmation dialog
//
// Usage (module-level import, singleton pattern):
//   import { confirmDialog } from '../../shared/components/pos-confirm-dialog.js';
//   if (!await confirmDialog('Delete this folder?')) return;
//
// Optional: pass options for a custom confirm button label / danger styling:
//   await confirmDialog('Remove item?', { confirmLabel: 'Remove', danger: true })

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    align-items: center;
    justify-content: center;
  }
  :host([open]) { display: flex; }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.25);
  }

  .dialog {
    position: relative;
    background: var(--pos-color-background-primary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    padding: var(--pos-space-lg);
    min-width: 280px;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--pos-space-md);
  }

  .message {
    font-size: var(--pos-font-size-sm);
    color: var(--pos-color-text-primary);
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: var(--pos-space-sm);
    justify-content: flex-end;
  }

  button {
    padding: 6px 14px;
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.1s;
  }
  button:hover { opacity: 0.85; }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--pos-color-border-default);
    color: var(--pos-color-text-secondary);
  }
  .btn-cancel:hover {
    background: var(--pos-color-background-secondary);
    color: var(--pos-color-text-primary);
    opacity: 1;
  }

  .btn-confirm {
    background: var(--pos-color-action-primary);
    border: 1px solid transparent;
    color: #fff;
  }
  .btn-confirm.danger {
    background: var(--pos-color-priority-urgent, #ef4444);
  }
`);

class PosConfirmDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._resolve = null;
  }

  connectedCallback() {
    this._render('', 'Confirm', false);
    this._bindEvents();
  }

  // Returns a Promise<boolean>
  ask(message, { confirmLabel = 'Confirm', danger = false } = {}) {
    this._render(message, confirmLabel, danger);
    this.setAttribute('open', '');
    return new Promise(resolve => { this._resolve = resolve; });
  }

  _resolve_with(value) {
    this.removeAttribute('open');
    if (this._resolve) {
      this._resolve(value);
      this._resolve = null;
    }
  }

  _render(message, confirmLabel, danger) {
    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <div class="message">${this._esc(message)}</div>
        <div class="actions">
          <button class="btn-cancel" id="cancel">Cancel</button>
          <button class="btn-confirm${danger ? ' danger' : ''}" id="confirm">${this._esc(confirmLabel)}</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#confirm')) { this._resolve_with(true); return; }
      if (e.target.closest('#cancel') || e.target.closest('.backdrop')) {
        this._resolve_with(false);
      }
    });

    // Keyboard: Enter = confirm, Escape = cancel
    this.shadow.addEventListener('keydown', (e) => {
      if (!this.hasAttribute('open')) return;
      if (e.key === 'Escape') { e.stopPropagation(); this._resolve_with(false); }
      if (e.key === 'Enter')  { e.stopPropagation(); this._resolve_with(true); }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-confirm-dialog', PosConfirmDialog);

// ── Singleton helper ────────────────────────────────────────────────────────

let _instance = null;

function _getInstance() {
  if (!_instance) {
    _instance = document.createElement('pos-confirm-dialog');
    document.body.appendChild(_instance);
  }
  return _instance;
}

/**
 * Show an in-app confirmation dialog. Returns Promise<boolean>.
 * @param {string} message
 * @param {{ confirmLabel?: string, danger?: boolean }} [options]
 */
export function confirmDialog(message, options) {
  return _getInstance().ask(message, options);
}
