// pos-watchlist-column-picker — Popover to toggle visible table columns

import { icon } from '../../../shared/utils/icons.js';

const TAG = 'pos-watchlist-column-picker';

class PosWatchlistColumnPicker extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._visible = false;
    this._columns = [];       // all available columns
    this._visibleKeys = [];   // currently visible column keys
  }

  set columns(val) { this._columns = val || []; if (this._visible) this._render(); }
  set visibleKeys(val) { this._visibleKeys = [...(val || [])]; if (this._visible) this._render(); }

  open() {
    this._visible = true;
    this._render();
    // Close on outside click
    setTimeout(() => {
      this._outsideHandler = (e) => {
        if (!this.shadow.contains(e.composedPath()[0])) {
          this.close();
        }
      };
      document.addEventListener('click', this._outsideHandler, true);
    }, 0);
  }

  close() {
    this._visible = false;
    this._render();
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler, true);
      this._outsideHandler = null;
    }
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  disconnectedCallback() {
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler, true);
    }
  }

  _render() {
    if (!this._visible) {
      this.shadow.innerHTML = '';
      return;
    }

    // Filter out special columns that can't be toggled (name is always shown)
    const toggleable = this._columns.filter(c => c.key !== 'name');

    this.shadow.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: 100;
          margin-top: 4px;
        }
        .popover {
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-default);
          border-radius: var(--pos-radius-md);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          width: 220px;
          max-height: 360px;
          overflow-y: auto;
          padding: 8px 0;
        }
        .title {
          padding: 4px 12px 8px;
          font-size: var(--pos-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-secondary);
          border-bottom: 1px solid var(--pos-color-border-subtle);
          margin-bottom: 4px;
        }
        .col-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          cursor: pointer;
          transition: background 0.1s;
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-primary);
        }
        .col-item:hover { background: var(--pos-color-background-secondary); }
        .checkbox {
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--pos-color-border-default);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.1s;
        }
        .checkbox.checked {
          background: var(--pos-color-action-primary);
          border-color: var(--pos-color-action-primary);
          color: white;
        }
      </style>
      <div class="popover">
        <div class="title">Visible Columns</div>
        ${toggleable.map(c => {
          const checked = this._visibleKeys.includes(c.key);
          return `
            <div class="col-item" data-key="${c.key}">
              <div class="checkbox ${checked ? 'checked' : ''}">
                ${checked ? icon('check', 10) : ''}
              </div>
              <span>${c.label || c.key}</span>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const item = e.target.closest('.col-item');
      if (!item) return;

      const key = item.dataset.key;
      const idx = this._visibleKeys.indexOf(key);
      if (idx >= 0) {
        this._visibleKeys.splice(idx, 1);
      } else {
        this._visibleKeys.push(key);
      }

      this._render();
      this.dispatchEvent(new CustomEvent('columns-change', {
        bubbles: true, composed: true,
        detail: { keys: [...this._visibleKeys] },
      }));
    });
  }
}

customElements.define(TAG, PosWatchlistColumnPicker);
