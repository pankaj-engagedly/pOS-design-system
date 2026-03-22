// pos-watchlist-search-dialog — Modal search + add dialog with theme assignment

import { icon } from '../../../shared/utils/icons.js';
import { searchSymbols } from '../services/watchlist-api.js';

const TAG = 'pos-watchlist-search-dialog';

const ASSET_LABELS = {
  stock: 'stocks',
  mutual_fund: 'mutual funds',
  etf: 'ETFs',
  precious_metal: 'precious metals',
  bond: 'bonds',
  crypto: 'crypto',
};

class PosWatchlistSearchDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._visible = false;
    this._results = [];
    this._loading = false;
    this._assetType = 'stock';
    this._debounce = null;
    // Theme assignment
    this._themes = [];             // top-level themes (with .children)
    this._selectedThemeId = null;  // pre-selected theme
    this._selectedSubThemeId = null;
  }

  set assetType(val) { this._assetType = val; }
  set themes(val) { this._themes = val || []; }
  set selectedThemeId(val) { this._selectedThemeId = val; }
  set selectedSubThemeId(val) { this._selectedSubThemeId = val; }

  open() {
    this._visible = true;
    this._results = [];
    this._loading = false;
    this._render();
    setTimeout(() => this.shadow.getElementById('search-input')?.focus(), 50);
  }

  close() {
    this._visible = false;
    this._render();
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _getSelectedParent() {
    return this._themes.find(t => t.id === this._selectedThemeId) || null;
  }

  _getSubThemes() {
    const parent = this._getSelectedParent();
    return parent?.children || [];
  }

  /** The theme_id to attach to a new item — subtheme takes priority */
  _getThemeIdForAdd() {
    return this._selectedSubThemeId || this._selectedThemeId || null;
  }

  _render() {
    if (!this._visible) {
      this.shadow.innerHTML = '';
      return;
    }

    // If the dialog shell already exists, only update results
    const existing = this.shadow.getElementById('results');
    if (existing) {
      this._renderResults();
      return;
    }

    const label = ASSET_LABELS[this._assetType] || this._assetType;
    const subThemes = this._getSubThemes();

    this.shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 9999;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
        }
        .dialog {
          background: var(--pos-color-background-primary);
          border-radius: var(--pos-radius-lg);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          width: 480px;
          max-height: 560px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--pos-color-border-default);
        }
        .search-bar svg { color: var(--pos-color-text-tertiary); flex-shrink: 0; }
        .search-bar input {
          flex: 1;
          border: none;
          outline: none;
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: transparent;
          color: var(--pos-color-text-primary);
        }
        .close-btn {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          border-radius: var(--pos-radius-sm);
          display: flex;
          align-items: center;
        }
        .close-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-background-secondary); }
        .close-btn svg { pointer-events: none; }
        .theme-bar {
          display: flex;
          gap: 8px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--pos-color-border-subtle);
          align-items: center;
        }
        .theme-bar label {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          white-space: nowrap;
        }
        .theme-bar select {
          flex: 1;
          padding: 4px 8px;
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          cursor: pointer;
          min-width: 0;
        }
        .results {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .result-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.1s;
        }
        .result-item:hover { background: var(--pos-color-background-secondary); }
        .result-info { flex: 1; min-width: 0; }
        .result-name {
          font-size: var(--pos-font-size-sm);
          color: var(--pos-color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-meta {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
        }
        .result-add {
          padding: 4px 10px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-action-primary);
          font-size: var(--pos-font-size-xs);
          font-family: inherit;
          cursor: pointer;
          transition: all 0.1s;
          white-space: nowrap;
        }
        .result-add:hover {
          background: var(--pos-color-action-primary);
          color: white;
        }
        .empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--pos-color-text-tertiary);
          font-size: var(--pos-font-size-sm);
        }
        .loading { opacity: 0.6; }
      </style>
      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="search-bar">
            ${icon('search', 16)}
            <input id="search-input" placeholder="Search ${label}..." autocomplete="off" />
            <button class="close-btn" id="dialog-close-btn" title="Close">${icon('x', 16)}</button>
          </div>
          ${this._themes.length > 0 ? `
            <div class="theme-bar">
              <label>Theme</label>
              <select id="theme-select">
                <option value="">None</option>
                ${this._themes.map(t => `<option value="${t.id}" ${this._selectedThemeId === t.id ? 'selected' : ''}>${this._esc(t.name)}</option>`).join('')}
              </select>
              ${subThemes.length > 0 ? `
                <label>Sub</label>
                <select id="subtheme-select">
                  <option value="">None</option>
                  ${subThemes.map(c => `<option value="${c.id}" ${this._selectedSubThemeId === c.id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('')}
                </select>
              ` : ''}
            </div>
          ` : ''}
          <div class="results" id="results">
            <div class="empty">Type to search</div>
          </div>
        </div>
      </div>
    `;
  }

  /** Update only the results container — leaves input and dropdowns untouched. */
  _renderResults() {
    const container = this.shadow.getElementById('results');
    if (!container) return;
    container.className = `results ${this._loading ? 'loading' : ''}`;
    container.innerHTML = this._results.length === 0
      ? `<div class="empty">${this._loading ? 'Searching...' : 'Type to search'}</div>`
      : this._results.map((r, i) => `
          <div class="result-item" data-index="${i}">
            <div class="result-info">
              <div class="result-name">${this._esc(r.name)}</div>
              <div class="result-meta">${this._esc(r.symbol)} ${r.exchange ? '· ' + this._esc(r.exchange) : ''}</div>
            </div>
            <button class="result-add" data-index="${i}">Add</button>
          </div>
        `).join('');
  }

  /** Re-render just the subtheme dropdown when parent theme changes */
  _updateSubThemeSelect() {
    const themeBar = this.shadow.querySelector('.theme-bar');
    if (!themeBar) return;
    const subThemes = this._getSubThemes();
    // Remove existing subtheme label + select
    const existingSub = themeBar.querySelector('#subtheme-select');
    const existingLabel = existingSub?.previousElementSibling;
    if (existingSub) existingSub.remove();
    if (existingLabel?.tagName === 'LABEL') existingLabel.remove();

    if (subThemes.length > 0) {
      const lbl = document.createElement('label');
      lbl.textContent = 'Sub';
      const sel = document.createElement('select');
      sel.id = 'subtheme-select';
      sel.innerHTML = `<option value="">None</option>` +
        subThemes.map(c => `<option value="${c.id}">${this._esc(c.name)}</option>`).join('');
      themeBar.appendChild(lbl);
      themeBar.appendChild(sel);
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#dialog-close-btn')) {
        this.close();
        return;
      }
      const addBtn = e.target.closest('.result-add');
      if (addBtn) {
        const idx = parseInt(addBtn.dataset.index);
        const result = this._results[idx];
        if (result) {
          this.dispatchEvent(new CustomEvent('item-add', {
            bubbles: true, composed: true,
            detail: { ...result, theme_id: this._getThemeIdForAdd() },
          }));
          this.close();
        }
      }
    });

    this.shadow.addEventListener('change', (e) => {
      if (e.target.closest('#theme-select')) {
        this._selectedThemeId = e.target.value || null;
        this._selectedSubThemeId = null;
        this._updateSubThemeSelect();
      }
      if (e.target.closest('#subtheme-select')) {
        this._selectedSubThemeId = e.target.value || null;
      }
    });

    this.shadow.addEventListener('input', (e) => {
      if (!e.target.closest('#search-input')) return;
      clearTimeout(this._debounce);
      const q = e.target.value.trim();
      if (!q) {
        this._results = [];
        this._loading = false;
        this._renderResults();
        return;
      }
      this._debounce = setTimeout(() => this._search(q), 300);
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  async _search(q) {
    this._loading = true;
    this._renderResults();

    try {
      this._results = await searchSymbols(q, this._assetType);
    } catch (err) {
      console.error('Search failed', err);
      this._results = [];
    }
    this._loading = false;
    this._renderResults();
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistSearchDialog);
