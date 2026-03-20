// pos-vault-sidebar — Sidebar with smart views + categories
// Composes: pos-sidebar (shell + scroll + footer)
// Dispatches: view-select, category-select, category-create, category-delete, category-rename

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-sidebar.js';

const vaultSheet = new CSSStyleSheet();
vaultSheet.replaceSync(`
  .new-category-btn {
    display: flex;
    align-items: center;
    gap: var(--pos-space-xs);
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px dashed var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm);
    background: transparent;
    color: var(--pos-color-text-secondary);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }
  .new-category-btn:hover {
    border-color: var(--pos-color-action-primary);
    color: var(--pos-color-action-primary);
  }
  .new-category-input {
    width: 100%;
    padding: 6px var(--pos-space-sm);
    border: 1px solid var(--pos-color-action-primary);
    border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm);
    font-family: inherit;
    background: var(--pos-color-background-primary);
    color: var(--pos-color-text-primary);
    outline: none;
    box-sizing: border-box;
  }
`);

const SMART_VIEWS = [
  { id: 'all',        label: 'All Items',   iconName: 'lock' },
  { id: 'favourites', label: 'Favourites',  iconName: 'star' },
];

class PosVaultSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, vaultSheet];
    this._categories = [];
    this._selectedView = 'all';
    this._selectedCategoryId = null;
    this._editingCategoryId = null;
    this._showNewInput = false;
    this._counts = {};
  }

  set categories(val) { this._categories = val || []; this.render(); }
  set selectedView(val) { this._selectedView = val; this._selectedCategoryId = null; this.render(); }
  set selectedCategoryId(val) { this._selectedCategoryId = val; this._selectedView = null; this.render(); }
  set counts(val) { this._counts = val || {}; this.render(); }

  connectedCallback() {
    this._bindEvents();
    this.render();
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        e.stopPropagation();
        const catId = action.dataset.categoryId;
        const act = action.dataset.action;
        if (act === 'delete-category' && catId) {
          this._dispatch('category-delete', { categoryId: catId });
        } else if (act === 'rename-category' && catId) {
          this._editingCategoryId = catId;
          this.render();
          requestAnimationFrame(() => this.shadow.querySelector('.rename-input')?.select());
        } else if (act === 'new-category') {
          this._showNewInput = true;
          this.render();
          requestAnimationFrame(() => this.shadow.querySelector('.new-category-input')?.focus());
        }
        return;
      }

      const view = e.target.closest('[data-view]');
      if (view) {
        this._dispatch('view-select', { view: view.dataset.view });
        return;
      }

      const cat = e.target.closest('[data-category-id]');
      if (cat) {
        if (this._editingCategoryId === cat.dataset.categoryId) return;
        this._dispatch('category-select', { categoryId: cat.dataset.categoryId });
        return;
      }
    });

    this.shadow.addEventListener('dblclick', (e) => {
      const cat = e.target.closest('[data-category-id]');
      if (cat) {
        this._editingCategoryId = cat.dataset.categoryId;
        this.render();
        requestAnimationFrame(() => this.shadow.querySelector('.rename-input')?.select());
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('rename-input')) {
        if (e.key === 'Enter') {
          const newName = e.target.value.trim();
          if (newName) {
            this._dispatch('category-rename', { categoryId: this._editingCategoryId, name: newName });
          }
          this._editingCategoryId = null;
          this.render();
        } else if (e.key === 'Escape') {
          this._editingCategoryId = null;
          this.render();
        }
      }
      if (e.target.classList.contains('new-category-input')) {
        if (e.key === 'Enter') {
          const name = e.target.value.trim();
          if (name) this._dispatch('category-create', { name });
          this._showNewInput = false;
          this.render();
        } else if (e.key === 'Escape') {
          this._showNewInput = false;
          this.render();
        }
      }
    });

    this.shadow.addEventListener('blur', (e) => {
      if (e.target.classList.contains('rename-input')) {
        this._editingCategoryId = null;
        this.render();
      }
      if (e.target.classList.contains('new-category-input')) {
        this._showNewInput = false;
        this.render();
      }
    }, true);
  }

  _dispatch(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _renderCategoryItem(c) {
    if (this._editingCategoryId === c.id) {
      return `<div class="rename-wrap">
        <input class="rename-input" value="${this._escAttr(c.name)}" />
      </div>`;
    }
    const isActive = this._selectedCategoryId === c.id;
    return `<div class="nav-item ${isActive ? 'active' : ''}" data-category-id="${c.id}">
      ${c.icon ? `<span style="font-size:15px;line-height:1">${c.icon}</span>` : icon('folder', 15)}
      <span class="nav-label">${this._esc(c.name)}</span>
      ${c.item_count > 0 ? `<span class="nav-count">${c.item_count}</span>` : ''}
      <div class="nav-actions">
        <button class="nav-action-btn" data-action="rename-category" data-category-id="${c.id}" title="Rename">
          ${icon('edit', 13)}
        </button>
        <button class="nav-action-btn delete" data-action="delete-category" data-category-id="${c.id}" title="Delete">
          ${icon('trash', 13)}
        </button>
      </div>
    </div>`;
  }

  render() {
    const totalCount = this._categories.reduce((s, c) => s + (c.item_count || 0), 0);
    const favCount = this._counts.favourites || 0;

    this.shadow.innerHTML = `
      <pos-sidebar title="Vault">

        ${SMART_VIEWS.map(v => {
          const count = v.id === 'all' ? totalCount : favCount;
          return `<div class="nav-item ${this._selectedView === v.id ? 'active' : ''}" data-view="${v.id}">
            ${icon(v.iconName, 15)}
            <span class="nav-label">${v.label}</span>
            ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
          </div>`;
        }).join('')}

        ${this._categories.length > 0 ? `
          <div class="divider"></div>
          <div class="section-label">Categories</div>
          ${this._categories.map(c => this._renderCategoryItem(c)).join('')}
        ` : ''}

        <div slot="footer">
          ${this._showNewInput
            ? `<input class="new-category-input" placeholder="Category name\u2026" />`
            : `<button class="new-category-btn" data-action="new-category">
                 ${icon('plus', 13)} New Category
               </button>`
          }
        </div>

      </pos-sidebar>
    `;

    if (this._showNewInput) {
      requestAnimationFrame(() => this.shadow.querySelector('.new-category-input')?.focus());
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('pos-vault-sidebar', PosVaultSidebar);
