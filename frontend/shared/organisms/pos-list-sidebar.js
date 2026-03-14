// pos-list-sidebar — Sidebar with smart views + user lists
// Composes: ui-side-panel, ui-nav-item, ui-input, ui-button

class PosListSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._lists = [];
    this._selectedId = null;
    this._selectedView = null; // 'inbox', 'today', 'upcoming', 'completed'
    this._showNewInput = false;
    this._todayCount = 0;
    this._upcomingCount = 0;
    this._completedCount = 0;
  }

  set lists(val) {
    this._lists = val || [];
    this.render();
  }

  set selectedId(val) {
    this._selectedId = val;
    this.render();
  }

  set selectedView(val) {
    this._selectedView = val;
    this.render();
  }

  set smartCounts(val) {
    if (!val) return;
    this._todayCount = val.today || 0;
    this._upcomingCount = val.upcoming || 0;
    this._completedCount = val.completed || 0;
    this.render();
  }

  connectedCallback() {
    this._bindShadowEvents();
    this.render();
  }

  render() {
    const inboxList = this._lists[0];
    const inboxCount = inboxList ? (inboxList.task_count || 0) : 0;

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
        }

        .section-label {
          font-size: var(--pos-raw-font-size-xs);
          font-weight: var(--pos-font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--pos-color-text-secondary);
          padding: var(--pos-space-sm) var(--pos-space-md) var(--pos-space-xs);
        }

        .smart-views, .list-items {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .divider {
          height: 1px;
          background: var(--pos-color-border-default);
          margin: var(--pos-space-sm) var(--pos-space-md);
        }

        .new-list {
          padding: var(--pos-space-sm);
        }

        ui-button { width: 100%; }
        ui-input { width: 100%; }
      </style>

      <ui-side-panel>
        <div class="smart-views">
          <ui-nav-item
            data-view="inbox"
            count="${inboxCount}"
            ${this._selectedView === 'inbox' ? 'selected' : ''}
          >\u{1F4E5} Inbox</ui-nav-item>
          <ui-nav-item
            data-view="today"
            count="${this._todayCount}"
            ${this._selectedView === 'today' ? 'selected' : ''}
          >\u{1F4C5} Today</ui-nav-item>
          <ui-nav-item
            data-view="upcoming"
            count="${this._upcomingCount}"
            ${this._selectedView === 'upcoming' ? 'selected' : ''}
          >\u{1F4C6} Upcoming</ui-nav-item>
          <ui-nav-item
            data-view="completed"
            count="${this._completedCount}"
            ${this._selectedView === 'completed' ? 'selected' : ''}
          >\u2705 Completed</ui-nav-item>
        </div>

        <div class="divider"></div>
        <div class="section-label">Lists</div>

        <div class="list-items">
          ${this._lists.map(l => `
            <ui-nav-item
              data-list-id="${l.id}"
              count="${l.task_count || 0}"
              ${!this._selectedView && l.id === this._selectedId ? 'selected' : ''}
            >${this._escapeHtml(l.name)}</ui-nav-item>
          `).join('')}
        </div>

        <div slot="footer" class="new-list">
          ${this._showNewInput
            ? '<ui-input id="new-list-input" placeholder="List name..." size="sm"></ui-input>'
            : '<ui-button id="new-list-btn" variant="outline" size="sm">+ New list</ui-button>'
          }
        </div>
      </ui-side-panel>
    `;

    if (this._showNewInput) {
      const uiInput = this.shadow.getElementById('new-list-input');
      if (uiInput) {
        setTimeout(() => {
          const inner = uiInput.shadowRoot?.querySelector('input');
          if (inner) inner.focus();
        }, 0);
      }
    }
  }

  _bindShadowEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#new-list-btn')) {
        this._showNewInput = true;
        this.render();
        return;
      }
    });

    // Handle nav-select from ui-nav-item
    this.shadow.addEventListener('nav-select', (e) => {
      const navItem = e.target.closest('ui-nav-item');
      if (!navItem) return;

      // Smart view?
      const view = navItem.dataset.view;
      if (view) {
        this._selectedView = view;
        this._selectedId = null;
        this.render();
        this.dispatchEvent(new CustomEvent('smart-view-select', {
          bubbles: true, composed: true,
          detail: { view },
        }));
        return;
      }

      // List select
      const listId = navItem.dataset.listId;
      if (listId) {
        this._selectedView = null;
        this._selectedId = listId;
        this.render();
        this.dispatchEvent(new CustomEvent('list-select', {
          bubbles: true, composed: true,
          detail: { listId },
        }));
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      const uiInput = e.target.closest('#new-list-input');
      if (!uiInput) return;

      const inner = uiInput.shadowRoot?.querySelector('input');
      if (!inner) return;

      if (e.key === 'Enter' && inner.value.trim()) {
        this.dispatchEvent(new CustomEvent('list-create', {
          bubbles: true, composed: true,
          detail: { name: inner.value.trim() },
        }));
        this._showNewInput = false;
        this.render();
      }
      if (e.key === 'Escape') {
        this._showNewInput = false;
        this.render();
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-list-input')) {
        setTimeout(() => {
          if (this._showNewInput) {
            this._showNewInput = false;
            this.render();
          }
        }, 150);
      }
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define('pos-list-sidebar', PosListSidebar);
