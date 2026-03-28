// pos-portfolio-import-dialog — unified import for CAS PDF and stock tradebook CSV/Excel

import { icon } from '../../../shared/utils/icons.js';
import { importCAS, importStocks } from '../services/portfolio-api.js';

const BROKERS = [
  { value: '', label: 'Auto-detect' },
  { value: 'Zerodha', label: 'Zerodha — Tradebook' },
  { value: 'Sharekhan', label: 'Sharekhan — Trade Listing' },
  { value: 'Sharekhan_TxnReport', label: 'Sharekhan — Transaction Report' },
  { value: 'Kotak', label: 'Kotak Securities' },
  { value: 'Motilal', label: 'Motilal Oswal' },
];

class PosPortfolioImportDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._open = false;
    this._loading = false;
    this._error = null;
    this._result = null;
    this._file = null;
    this._portfolios = [];
    this._selectedPortfolioId = null;
    this._importMode = 'cas'; // 'cas' or 'stocks'
    this._eventsBound = false;
  }

  set open(val) { this._open = val; if (val) { this._result = null; this._error = null; this._file = null; } this._render(); }
  set portfolios(val) { this._portfolios = val || []; }
  set selectedPortfolioId(val) { this._selectedPortfolioId = val; }

  connectedCallback() {
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
    this._render();
  }

  _render() {
    if (!this._open) { this.shadow.innerHTML = ''; return; }

    const isCas = this._importMode === 'cas';
    const acceptTypes = isCas ? '.pdf' : '.csv,.xlsx,.xls,.txt';
    const title = isCas ? 'Import CAS PDF' : 'Import Stock Tradebook';

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3);
          z-index: 10000; display: flex; align-items: center; justify-content: center;
        }
        .dialog { background: white; border-radius: 12px; width: 480px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .dialog-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--pos-color-border-default, #e2e2e8);
        }
        .dialog-header h3 { margin: 0; font-size: 15px; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--pos-color-text-tertiary); padding: 4px; }
        .dialog-body { padding: 20px; }

        .mode-tabs {
          display: flex; gap: 0; margin-bottom: 16px; border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 8px; overflow: hidden;
        }
        .mode-tab {
          flex: 1; padding: 8px 12px; text-align: center; font-size: 13px; font-family: inherit;
          cursor: pointer; border: none; background: var(--pos-color-background-secondary, #f8f8fa);
          color: var(--pos-color-text-secondary); transition: all 0.15s;
        }
        .mode-tab.active {
          background: var(--pos-color-action-primary, #4361ee); color: white; font-weight: 500;
        }
        .mode-tab:not(:last-child) { border-right: 1px solid var(--pos-color-border-default, #e2e2e8); }

        .drop-zone {
          border: 2px dashed var(--pos-color-border-default, #e2e2e8);
          border-radius: 8px; padding: 32px; text-align: center;
          cursor: pointer; transition: border-color 0.2s;
          margin-bottom: 14px;
        }
        .drop-zone:hover, .drop-zone.dragover { border-color: var(--pos-color-action-primary, #4361ee); }
        .drop-zone .icon { color: var(--pos-color-text-tertiary); margin-bottom: 8px; }
        .drop-zone p { margin: 0; font-size: 13px; color: var(--pos-color-text-secondary); }
        .drop-zone .hint { font-size: 11px; color: var(--pos-color-text-tertiary); margin-top: 6px; }
        .file-selected { font-size: 13px; color: var(--pos-color-text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--pos-color-text-secondary); }
        .field input, .field select {
          width: 100%; padding: 8px 10px; border: 1px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box;
        }
        .dialog-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 12px 20px; border-top: 1px solid var(--pos-color-border-default, #e2e2e8);
        }
        .btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
        .btn-cancel { background: transparent; border-color: var(--pos-color-border-default); color: var(--pos-color-text-secondary); }
        .btn-primary { background: var(--pos-color-action-primary, #4361ee); color: white; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { color: #ef4444; font-size: 12px; margin-bottom: 8px; }
        .result { background: #dcfce7; border-radius: 8px; padding: 16px; margin-bottom: 8px; }
        .result h4 { margin: 0 0 8px; color: #166534; font-size: 14px; }
        .result p { margin: 2px 0; font-size: 13px; color: #166534; }
        input[type="file"] { display: none; }
      </style>
      <div class="overlay">
        <div class="dialog">
          <div class="dialog-header">
            <h3>${title}</h3>
            <button class="close-btn" data-action="close">${icon('x', 18)}</button>
          </div>
          <div class="dialog-body">
            <div class="mode-tabs">
              <button class="mode-tab ${isCas ? 'active' : ''}" data-mode="cas">Mutual Funds (CAS)</button>
              <button class="mode-tab ${!isCas ? 'active' : ''}" data-mode="stocks">Stocks (CSV/Excel)</button>
            </div>
            ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ''}
            ${this._result ? this._renderResult() : (isCas ? this._renderCasForm() : this._renderStockForm())}
          </div>
          <div class="dialog-footer">
            ${this._result ? `
              <button class="btn btn-primary" data-action="close">Done</button>
            ` : `
              <button class="btn btn-cancel" data-action="close">Cancel</button>
              <button class="btn btn-primary" data-action="import" ${this._loading || !this._file ? 'disabled' : ''}>
                ${this._loading ? 'Importing...' : 'Import'}
              </button>
            `}
          </div>
        </div>
      </div>
      <input type="file" accept="${acceptTypes}" data-file-input>
    `;
  }

  _renderCasForm() {
    return `
      ${this._renderFileZone('Drop CAS PDF here or click to browse', '.pdf')}
      <div class="field">
        <label>Portfolio</label>
        <select name="portfolio_id">
          ${this._portfolios.map(p => `
            <option value="${p.id}" ${p.id === this._selectedPortfolioId ? 'selected' : ''}>${this._esc(p.name)} (${this._esc(p.holder_name)})</option>
          `).join('')}
        </select>
      </div>
      <div class="field">
        <label>PDF Password</label>
        <input type="password" name="password" placeholder="Usually PAN + DOB (e.g., ABCDE1234F01011990)">
      </div>
    `;
  }

  _renderStockForm() {
    return `
      ${this._renderFileZone('Drop tradebook CSV/Excel here or click to browse', '.csv, .xlsx')}
      <div class="field">
        <label>Portfolio</label>
        <select name="portfolio_id">
          ${this._portfolios.map(p => `
            <option value="${p.id}" ${p.id === this._selectedPortfolioId ? 'selected' : ''}>${this._esc(p.name)} (${this._esc(p.holder_name)})</option>
          `).join('')}
        </select>
      </div>
      <div class="field">
        <label>Broker</label>
        <select name="broker">
          ${BROKERS.map(b => `<option value="${b.value}">${b.label}</option>`).join('')}
        </select>
      </div>
    `;
  }

  _renderFileZone(text, hint) {
    if (this._file) {
      return `
        <div class="file-selected">
          ${icon('file', 16)} ${this._esc(this._file.name)}
          <button class="close-btn" data-action="clear-file" style="margin-left: auto;">${icon('x', 14)}</button>
        </div>
      `;
    }
    return `
      <div class="drop-zone" data-action="pick-file">
        <div class="icon">${icon('upload', 32)}</div>
        <p>${text}</p>
        <p class="hint">Accepted: ${hint}</p>
      </div>
    `;
  }

  _renderResult() {
    const r = this._result;
    const label = this._importMode === 'cas' ? 'Schemes' : 'Stocks';
    return `
      <div class="result">
        <h4>Import Successful</h4>
        <p>Source: ${r.source_type}</p>
        <p>${label} found: ${r.schemes_found}</p>
        <p>Transactions imported: ${r.transactions_imported}</p>
        <p>Duplicates skipped: ${r.duplicates_skipped}</p>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const mode = e.target.closest('[data-mode]')?.dataset.mode;

      if (mode && mode !== this._importMode) {
        this._importMode = mode;
        this._file = null;
        this._error = null;
        this._result = null;
        this._render();
        return;
      }

      if (action === 'close') {
        const hadResult = !!this._result;
        this._open = false; this._error = null; this._result = null; this._file = null;
        this._render();
        if (hadResult) {
          this.dispatchEvent(new CustomEvent('import-complete', { bubbles: true, composed: true }));
        }
      }
      if (action === 'pick-file') this.shadow.querySelector('[data-file-input]')?.click();
      if (action === 'clear-file') { this._file = null; this._render(); }
      if (action === 'import') await this._import();
    });

    this.shadow.addEventListener('change', (e) => {
      if (e.target.matches('[data-file-input]') && e.target.files?.length) {
        this._file = e.target.files[0];
        this._render();
      }
    });

    this.shadow.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.shadow.querySelector('.drop-zone')?.classList.add('dragover');
    });

    this.shadow.addEventListener('dragleave', () => {
      this.shadow.querySelector('.drop-zone')?.classList.remove('dragover');
    });

    this.shadow.addEventListener('drop', (e) => {
      e.preventDefault();
      this.shadow.querySelector('.drop-zone')?.classList.remove('dragover');
      if (e.dataTransfer?.files?.length) {
        this._file = e.dataTransfer.files[0];
        this._render();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this._open = false; this._render(); }
    });
  }

  async _import() {
    if (!this._file) return;
    const portfolioId = this.shadow.querySelector('select[name="portfolio_id"]')?.value;

    if (!portfolioId) { this._error = 'Please select a portfolio'; this._render(); return; }

    this._loading = true;
    this._error = null;
    this._render();

    try {
      if (this._importMode === 'cas') {
        const password = this.shadow.querySelector('input[name="password"]')?.value;
        if (!password) { this._loading = false; this._error = 'Password is required'; this._render(); return; }
        this._result = await importCAS(portfolioId, this._file, password);
      } else {
        const broker = this.shadow.querySelector('select[name="broker"]')?.value || null;
        this._result = await importStocks(portfolioId, this._file, broker);
      }
      this._loading = false;
      this._render();
      this.dispatchEvent(new CustomEvent('import-complete', { bubbles: true, composed: true }));
    } catch (err) {
      this._loading = false;
      this._error = err.message;
      this._render();
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-import-dialog', PosPortfolioImportDialog);
