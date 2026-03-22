import { PosBaseElement } from '../core/pos-base-element.js';
import { define } from '../core/define.js';

const ICON_CALENDAR = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const CSS = `
  :host {
    display: inline-flex;
    position: relative;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border: 1px solid var(--pos-color-border-default);
    border-radius: 99px;
    background: transparent;
    font-size: var(--pos-font-size-xs, 12px);
    font-family: inherit;
    color: var(--pos-color-text-secondary, #6b6b80);
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .chip:hover { border-color: var(--pos-color-action-primary, #4361ee); color: var(--pos-color-action-primary, #4361ee); }
  .chip.active {
    border-color: var(--pos-color-action-primary, #4361ee);
    color: var(--pos-color-action-primary, #4361ee);
    background: color-mix(in srgb, var(--pos-color-action-primary, #4361ee) 8%, transparent);
  }
  .chip svg { pointer-events: none; }

  /* Inline variant — looks like a detail row value, not a pill */
  :host([variant="inline"]) .chip {
    border-radius: var(--pos-radius-sm, 6px);
    padding: 3px 8px;
  }
  :host([variant="inline"]) .chip:not(.active) {
    font-style: italic;
  }

  .clear {
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px; border-radius: 50%;
    border: none; background: transparent; cursor: pointer;
    color: inherit; padding: 0; margin-left: 2px;
  }
  .clear:hover { background: color-mix(in srgb, currentColor 15%, transparent); }

  .menu {
    position: absolute;
    top: 100%; left: 0; margin-top: 4px;
    background: var(--pos-color-background-primary, #fff);
    border: 1px solid var(--pos-color-border-default, #e2e2e8);
    border-radius: var(--pos-radius-md, 8px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    z-index: 9999;
    overflow: hidden;
    min-width: 180px;
  }

  /* If menu would go off-screen right, flip to right-aligned */
  :host([menu-align="right"]) .menu {
    left: auto; right: 0;
  }

  .option {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding: 7px 12px;
    font-size: var(--pos-font-size-sm, 13px);
    font-family: inherit;
    color: var(--pos-color-text-primary, #1a1a2e);
    cursor: pointer; background: none; border: none;
    width: 100%; text-align: left;
  }
  .option:hover { background: var(--pos-color-background-secondary, #f8f8fc); }
  .option.selected {
    color: var(--pos-color-action-primary, #4361ee);
    font-weight: var(--pos-font-weight-medium, 500);
  }
  .option-hint {
    font-size: var(--pos-font-size-xs, 12px);
    color: var(--pos-color-text-tertiary, #9b9bb0);
  }

  input[type="date"] {
    position: absolute; opacity: 0; pointer-events: none;
    width: 0; height: 0;
  }
`;

class UiDatePicker extends PosBaseElement {
  static get observedAttributes() { return ['value', 'placeholder', 'variant']; }

  constructor() {
    super();
    this.adoptStyles(CSS);
    this._open = false;
    this._value = '';
  }

  get value() { return this._value; }
  set value(val) {
    this._value = val || '';
    this._render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'value' && newVal !== this._value) {
      this._value = newVal || '';
      this._render();
    }
    if (name === 'placeholder' || name === 'variant') this._render();
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const val = this._value;
    const label = val ? this._formatDate(val) : (this.getAttribute('placeholder') || 'Due date');
    const hasValue = !!val;

    this.shadow.innerHTML = `
      <button class="chip ${hasValue ? 'active' : ''}" id="chip">
        ${ICON_CALENDAR} ${label}
        ${hasValue ? `<button class="clear" id="clear">${ICON_X}</button>` : ''}
      </button>
      <input type="date" id="native" value="${val}" tabindex="-1" />
      ${this._open ? this._renderMenu() : ''}
    `;
  }

  _renderMenu() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const daysUntilMon = (8 - today.getDay()) % 7 || 7;
    const nextWeekStr = new Date(today.getTime() + daysUntilMon * 86400000).toISOString().slice(0, 10);

    const dayHint = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `
      <div class="menu">
        <button class="option ${this._value === todayStr ? 'selected' : ''}" data-date="${todayStr}">
          ${ICON_CALENDAR} Today
          <span class="option-hint">${dayHint(todayStr)}</span>
        </button>
        <button class="option ${this._value === tomorrowStr ? 'selected' : ''}" data-date="${tomorrowStr}">
          ${ICON_CHEVRON} Tomorrow
          <span class="option-hint">${dayHint(tomorrowStr)}</span>
        </button>
        <button class="option ${this._value === nextWeekStr ? 'selected' : ''}" data-date="${nextWeekStr}">
          ${ICON_CHEVRON} Next Week
          <span class="option-hint">${dayHint(nextWeekStr)}</span>
        </button>
        <button class="option" data-date="__pick__">
          ${ICON_CALENDAR} Pick a date\u2026
        </button>
        ${this._value ? `
          <button class="option" data-date="">
            ${ICON_X} No date
          </button>
        ` : ''}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Clear button
      if (e.target.closest('#clear')) {
        e.stopPropagation();
        this._setValue('');
        return;
      }

      // Chip click — toggle menu
      if (e.target.closest('#chip')) {
        this._open = !this._open;
        this._render();
        this._bindEvents();
        if (this._open) this._listenOutside();
        return;
      }

      // Menu option
      const opt = e.target.closest('[data-date]');
      if (opt) {
        const val = opt.dataset.date;
        this._open = false;

        if (val === '__pick__') {
          this._render();
          this._bindEvents();
          // Trigger native picker
          setTimeout(() => {
            const native = this.shadow.getElementById('native');
            if (native) {
              native.style.pointerEvents = 'auto';
              try { native.showPicker(); } catch { native.click(); }
              setTimeout(() => { native.style.pointerEvents = 'none'; }, 300);
            }
          }, 50);
          return;
        }

        this._setValue(val);
        return;
      }
    });

    // Native date input change
    this.shadow.getElementById('native')?.addEventListener('change', (e) => {
      this._setValue(e.target.value);
    });
  }

  _setValue(val) {
    this._value = val || '';
    this._open = false;
    this.setAttribute('value', this._value);
    this._render();
    this._bindEvents();
    this.dispatchEvent(new CustomEvent('date-change', {
      bubbles: true, composed: true,
      detail: { value: this._value || null },
    }));
  }

  _listenOutside() {
    setTimeout(() => {
      const handler = (e) => {
        if (!this.contains(e.target) && !this.shadow.contains(e.composedPath()[0])) {
          this._open = false;
          this._render();
          this._bindEvents();
        }
      };
      document.addEventListener('click', handler, { once: true, capture: true });
    }, 0);
  }

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

define('ui-date-picker', UiDatePicker);
