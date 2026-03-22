// pos-portfolio-plan-history — Chronological event list (revisions + deployments)

import { formatINR } from './pos-portfolio-holdings.js';

class PosPortfolioPlanHistory extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._events = [];
  }

  set events(val) { this._events = val || []; this._render(); }

  connectedCallback() { this._render(); }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .event {
          display: flex; gap: 12px; padding: 10px 0;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f0f0f5);
          font-size: 13px;
        }
        .event-date {
          flex-shrink: 0; width: 80px;
          color: var(--pos-color-text-tertiary, #9b9bb0);
          font-size: 12px;
        }
        .event-type {
          display: inline-block; padding: 2px 6px;
          border-radius: 3px; font-size: 11px; font-weight: 500;
        }
        .type-deployment { background: #dcfce7; color: #166534; }
        .type-revision { background: #dbeafe; color: #1e40af; }
        .event-detail { flex: 1; color: var(--pos-color-text-primary); }
        .event-notes { font-size: 12px; color: var(--pos-color-text-tertiary); margin-top: 2px; }
        .empty { color: var(--pos-color-text-tertiary); font-size: 13px; }
      </style>

      ${this._events.length === 0 ? '<div class="empty">No events yet</div>' : ''}

      ${this._events.map(ev => `
        <div class="event">
          <div class="event-date">${ev.event_date}</div>
          <div>
            <span class="event-type type-${ev.type}">${ev.type}</span>
          </div>
          <div class="event-detail">
            ${ev.type === 'deployment'
              ? `${this._esc(ev.asset_name || '')}: ${formatINR(ev.amount)}${ev.units ? ' (' + ev.units + ' units)' : ''}`
              : `${ev.event_type}: ${ev.previous_value || ''} \u2192 ${ev.new_value || ''}`
            }
            ${ev.notes ? `<div class="event-notes">${this._esc(ev.notes)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }

  _esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
}

customElements.define('pos-portfolio-plan-history', PosPortfolioPlanHistory);
