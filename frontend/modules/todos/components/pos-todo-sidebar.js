// pos-todo-sidebar — Todos sidebar: smart views + user lists
// Composes: pos-sidebar (shell + scroll + footer)

import '../../../shared/components/pos-sidebar.js';
import { SIDEBAR_NAV_STYLES } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';

class PosTodoSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._lists = [];
    this._selectedId = null;
    this._selectedView = null;
    this._showNewInput = false;
    this._renamingId = null; // list ID currently being renamed
    this._smartCounts = { today: 0, upcoming: 0, completed: 0 };
  }

  set lists(val) { this._lists = val || []; this._render(); }
  set selectedId(val) { this._selectedId = val; this._render(); }
  set selectedView(val) { this._selectedView = val; this._render(); }
  set smartCounts(val) { this._smartCounts = val || {}; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    const { inbox = 0, today = 0, upcoming = 0, completed = 0 } = this._smartCounts;

    const SMART_VIEWS = [
      { view: 'inbox',     label: 'Inbox',     iconName: 'folder',        count: inbox },
      { view: 'today',     label: 'Today',     iconName: 'check-square',  count: today },
      { view: 'upcoming',  label: 'Upcoming',  iconName: 'chevron-right', count: upcoming },
      { view: 'completed', label: 'Completed', iconName: 'check',         count: completed },
    ];

    this.shadow.innerHTML = `
      <style>
        ${SIDEBAR_NAV_STYLES}

        /* List items need relative positioning for the action overlay */
        .nav-item { position: relative; }

        /* Hide count when actions are showing so they don't overlap */
        .nav-item:hover .nav-count { visibility: hidden; }

        /* Action overlay — sits on top of the count badge on hover */
        .nav-actions {
          display: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          align-items: center;
          gap: 2px;
          padding-right: 2px;
          background: inherit; /* inherits hover/active bg from parent */
        }
        .nav-item:hover .nav-actions { display: flex; }

        .nav-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: none;
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-secondary);
          cursor: pointer;
          padding: 0;
          transition: background 0.1s, color 0.1s;
        }
        .nav-action-btn:hover { background: var(--pos-color-border-default); color: var(--pos-color-text-primary); }
        .nav-action-btn.delete:hover { color: var(--pos-color-priority-urgent); }
        .nav-action-btn svg { pointer-events: none; }

        /* Inline rename input replaces the nav-item row */
        .rename-wrap {
          padding: 2px var(--pos-space-xs);
        }
        .rename-input {
          width: 100%;
          padding: 4px var(--pos-space-sm);
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
          box-sizing: border-box;
        }

        /* New list controls */
        .new-list-btn {
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
        .new-list-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
        }

        .new-list-input {
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
      </style>

      <pos-sidebar title="Todos">

        ${SMART_VIEWS.map(v => `
          <div class="nav-item ${this._selectedView === v.view && !this._selectedId ? 'active' : ''}"
               data-view="${v.view}">
            ${icon(v.iconName, 15)}
            <span class="nav-label">${v.label}</span>
            ${v.count > 0 ? `<span class="nav-count">${v.count}</span>` : ''}
          </div>
        `).join('')}

        <div class="divider"></div>
        <div class="section-label">Lists</div>

        ${this._lists.map(l => this._renamingId === l.id
          ? `<div class="rename-wrap">
               <input class="rename-input" id="rename-input" value="${this._escAttr(l.name)}" data-list-id="${l.id}" />
             </div>`
          : `<div class="nav-item ${!this._selectedView && l.id === this._selectedId ? 'active' : ''}"
                  data-list-id="${l.id}">
               ${icon('check-square', 15)}
               <span class="nav-label">${this._esc(l.name)}</span>
               ${l.task_count > 0 ? `<span class="nav-count">${l.task_count}</span>` : ''}
               <div class="nav-actions">
                 <button class="nav-action-btn" data-action="rename" data-list-id="${l.id}" title="Rename">
                   ${icon('edit', 13)}
                 </button>
                 <button class="nav-action-btn delete" data-action="delete" data-list-id="${l.id}" title="Delete">
                   ${icon('trash', 13)}
                 </button>
               </div>
             </div>`
        ).join('')}

        <div slot="footer">
          ${this._showNewInput
            ? `<input class="new-list-input" id="new-list-input" placeholder="List name…" />`
            : `<button class="new-list-btn" id="new-list-btn">
                 ${icon('plus', 13)} New list
               </button>`
          }
        </div>

      </pos-sidebar>
    `;

    if (this._showNewInput) {
      setTimeout(() => this.shadow.getElementById('new-list-input')?.focus(), 0);
    }
    if (this._renamingId) {
      setTimeout(() => {
        const inp = this.shadow.getElementById('rename-input');
        inp?.focus();
        inp?.select();
      }, 0);
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // New list button
      if (e.target.closest('#new-list-btn')) {
        this._showNewInput = true;
        this._render();
        return;
      }

      // Action buttons — handle before nav-item so clicks don't also select
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        const listId = actionBtn.dataset.listId;
        if (actionBtn.dataset.action === 'rename') {
          this._renamingId = listId;
          this._render();
        } else if (actionBtn.dataset.action === 'delete') {
          this.dispatchEvent(new CustomEvent('list-delete', {
            bubbles: true, composed: true,
            detail: { listId },
          }));
        }
        return;
      }

      // Nav item selection
      const item = e.target.closest('.nav-item');
      if (!item) return;

      if (item.dataset.view) {
        this._selectedView = item.dataset.view;
        this._selectedId = null;
        this._render();
        this.dispatchEvent(new CustomEvent('smart-view-select', {
          bubbles: true, composed: true,
          detail: { view: item.dataset.view },
        }));
      } else if (item.dataset.listId) {
        this._selectedView = null;
        this._selectedId = item.dataset.listId;
        this._render();
        this.dispatchEvent(new CustomEvent('list-select', {
          bubbles: true, composed: true,
          detail: { listId: item.dataset.listId },
        }));
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      // New list input
      const newInput = e.target.closest('#new-list-input');
      if (newInput) {
        if (e.key === 'Enter' && newInput.value.trim()) {
          this.dispatchEvent(new CustomEvent('list-create', {
            bubbles: true, composed: true,
            detail: { name: newInput.value.trim() },
          }));
          this._showNewInput = false;
          this._render();
        }
        if (e.key === 'Escape') { this._showNewInput = false; this._render(); }
        return;
      }

      // Rename input
      const renameInput = e.target.closest('#rename-input');
      if (renameInput) {
        if (e.key === 'Enter' && renameInput.value.trim()) {
          this.dispatchEvent(new CustomEvent('list-rename', {
            bubbles: true, composed: true,
            detail: { listId: renameInput.dataset.listId, name: renameInput.value.trim() },
          }));
          this._renamingId = null;
          this._render();
        }
        if (e.key === 'Escape') { this._renamingId = null; this._render(); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-list-input')) {
        setTimeout(() => {
          if (this._showNewInput) { this._showNewInput = false; this._render(); }
        }, 150);
      }
      if (e.target.closest('#rename-input')) {
        setTimeout(() => {
          if (this._renamingId) { this._renamingId = null; this._render(); }
        }, 150);
      }
    });
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

customElements.define('pos-todo-sidebar', PosTodoSidebar);
