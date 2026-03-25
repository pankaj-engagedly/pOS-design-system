// pos-watchlist-board — Kanban board with drag-drop cards + column reorder + inline stage create

import { icon } from '../../../shared/utils/icons.js';

const TAG = 'pos-watchlist-board';

class PosWatchlistBoard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._items = [];
    this._stages = [];
    this._assetClass = null;
    this._dragItemId = null;
    this._dragColId = null;  // column being dragged for reorder
    this._addingStage = false;
  }

  set items(val) { this._items = val || []; this._render(); }
  set stages(val) { this._stages = val || []; this._render(); }
  set assetClass(val) { this._assetClass = val; this._render(); }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    const stageColumns = this._stages.map(s => ({
      stage: s,
      items: this._items.filter(i => i.stage_id === s.id),
    }));
    const unassigned = this._items.filter(i => !i.stage_id);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; overflow-x: auto; overflow-y: hidden; }
        .board {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          height: 100%;
          min-width: max-content;
          align-items: flex-start;
        }
        .column {
          min-width: 280px;
          max-width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--pos-color-background-secondary);
          border-radius: var(--pos-radius-md);
          overflow: hidden;
          transition: outline 0.15s, opacity 0.15s;
          max-height: 100%;
        }
        .column.card-drop-target {
          outline: 2px solid var(--pos-color-action-primary);
          outline-offset: -2px;
        }
        .column.col-dragging { opacity: 0.4; }
        .column.col-drop-target {
          border-left: 3px solid var(--pos-color-action-primary);
        }

        .col-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          border-bottom: 1px solid var(--pos-color-border-subtle);
          cursor: grab;
        }
        .col-header.no-drag { cursor: default; }
        .col-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .col-count {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          font-weight: normal;
          margin-left: auto;
        }
        .col-cards {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Cards */
        .card {
          position: relative;
          background: var(--pos-color-background-primary);
          border: 1px solid var(--pos-color-border-subtle);
          border-radius: var(--pos-radius-sm);
          padding: 10px 12px;
          cursor: grab;
          transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
          user-select: none;
        }
        .card:hover {
          border-color: var(--pos-color-action-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .card.dragging { opacity: 0.4; }
        .card-actions {
          position: absolute;
          top: 6px; right: 6px;
          display: none;
          align-items: center;
          gap: 2px;
          background: var(--pos-color-background-primary);
          border-radius: var(--pos-radius-sm);
          padding: 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          z-index: 2;
        }
        .card:hover .card-actions { display: flex; }
        .card-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          border: none; border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          padding: 0;
        }
        .card-action-btn:hover { color: var(--pos-color-text-primary); background: var(--pos-color-border-default); }
        .card-action-btn.active { color: #f59e0b; }
        .card-action-btn.active svg { fill: currentColor; }
        .card-action-btn.delete:hover { color: var(--pos-color-priority-urgent); }
        .card-action-btn svg { pointer-events: none; }
        .card-name {
          font-size: var(--pos-font-size-sm);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
          margin-bottom: 2px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .card-symbol {
          font-size: var(--pos-font-size-xs);
          color: var(--pos-color-text-tertiary);
          margin-bottom: 6px;
        }
        .card-price-row { display: flex; align-items: baseline; gap: 8px; }
        .card-price {
          font-size: var(--pos-font-size-md);
          font-weight: var(--pos-font-weight-semibold);
          color: var(--pos-color-text-primary);
        }
        .card-change { font-size: var(--pos-font-size-xs); font-weight: var(--pos-font-weight-semibold); }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .card-metrics {
          display: flex; gap: 12px; margin-top: 6px;
          font-size: 10px; color: var(--pos-color-text-tertiary);
        }
        .card-metric span { font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-secondary); }
        .empty-col {
          padding: 16px; text-align: center;
          color: var(--pos-color-text-tertiary);
          font-size: var(--pos-font-size-xs);
        }

        /* Add stage — compact button after last column */
        .add-stage-wrap {
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          padding-top: 2px;
        }
        .add-stage-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border: 1px dashed var(--pos-color-border-default);
          border-radius: var(--pos-radius-sm);
          background: transparent;
          color: var(--pos-color-text-tertiary);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .add-stage-btn:hover {
          border-color: var(--pos-color-action-primary);
          color: var(--pos-color-action-primary);
          background: var(--pos-color-background-secondary);
        }
        .add-stage-input-wrap {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .add-stage-input {
          width: 180px;
          padding: 6px 10px;
          border: 1px solid var(--pos-color-action-primary);
          border-radius: var(--pos-radius-sm);
          font-size: var(--pos-font-size-sm);
          font-family: inherit;
          background: var(--pos-color-background-primary);
          color: var(--pos-color-text-primary);
          outline: none;
        }
      </style>
      <div class="board">
        ${stageColumns.map(col => this._renderColumn(col.stage, col.items)).join('')}
        ${unassigned.length > 0 ? this._renderColumn({ name: 'Unassigned', color: '#94a3b8' }, unassigned) : ''}
        <div class="add-stage-wrap">
          ${this._addingStage
            ? `<div class="add-stage-input-wrap">
                 <input class="add-stage-input" id="new-stage-input" placeholder="Stage name\u2026" />
               </div>`
            : `<button class="add-stage-btn" id="add-stage-btn" title="Add stage">${icon('plus', 16)}</button>`
          }
        </div>
      </div>
    `;

    if (this._addingStage) {
      setTimeout(() => this.shadow.getElementById('new-stage-input')?.focus(), 0);
    }
  }

  _renderColumn(stage, items) {
    const stageId = stage.id || '';
    const isDraggable = !!stage.id; // Unassigned column can't be reordered
    return `
      <div class="column" data-stage-id="${stageId}" ${isDraggable ? 'draggable="true"' : ''}>
        <div class="col-header ${isDraggable ? '' : 'no-drag'}">
          <span class="col-dot" style="background:${stage.color || '#94a3b8'}"></span>
          ${this._esc(stage.name)}
          <span class="col-count">${items.length}</span>
        </div>
        <div class="col-cards" data-drop-stage="${stageId}">
          ${items.length === 0
            ? '<div class="empty-col">Drop items here</div>'
            : items.map(item => this._renderCard(item)).join('')}
        </div>
      </div>
    `;
  }

  _renderCard(item) {
    const cache = item.cache || {};
    const price = cache.current_price ?? cache.nav;
    const chg = cache.day_change_pct;
    const chgCls = chg > 0 ? 'positive' : chg < 0 ? 'negative' : '';
    const chgStr = chg != null ? (chg > 0 ? '+' : '') + chg.toFixed(2) + '%' : '';
    const cur = this._cur(cache.currency);
    const metrics = this._getCardMetrics(item, cache);

    return `
      <div class="card" data-item-id="${item.id}" draggable="true">
        <div class="card-actions">
          <button class="card-action-btn ${item.is_favourite ? 'active' : ''}" data-fav="${item.id}" title="${item.is_favourite ? 'Unfavourite' : 'Favourite'}">${icon('star', 13)}</button>
          <button class="card-action-btn delete" data-delete="${item.id}" title="Remove">${icon('trash', 13)}</button>
        </div>
        <div class="card-name">${this._esc(item.name)}</div>
        <div class="card-symbol">${this._esc(item.symbol)}${item.exchange ? ' · ' + this._esc(item.exchange) : ''}</div>
        <div class="card-price-row">
          <span class="card-price">${price != null ? cur + price.toFixed(2) : '--'}</span>
          ${chgStr ? `<span class="card-change ${chgCls}">${chgStr}</span>` : ''}
        </div>
        ${metrics.length > 0 ? `
          <div class="card-metrics">
            ${metrics.map(m => `<span class="card-metric">${m.label}: <span>${m.value}</span></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  _getCardMetrics(item, cache) {
    const metrics = [];
    const t = item.asset_type;
    const c = cache.currency;
    if (t === 'stock') {
      if (cache.pe_ratio != null) metrics.push({ label: 'PE', value: cache.pe_ratio.toFixed(1) });
      if (cache.market_cap) metrics.push({ label: 'MCap', value: this._fmtCap(cache.market_cap, c) });
      if (cache.roe != null) metrics.push({ label: 'ROE', value: (cache.roe * 100).toFixed(1) + '%' });
    } else if (t === 'mutual_fund') {
      if (cache.return_1y != null) metrics.push({ label: '1Y', value: cache.return_1y.toFixed(1) + '%' });
      if (cache.expense_ratio != null) metrics.push({ label: 'ER', value: cache.expense_ratio.toFixed(2) + '%' });
    } else if (t === 'etf') {
      if (cache.expense_ratio != null) metrics.push({ label: 'ER', value: cache.expense_ratio.toFixed(2) + '%' });
      if (cache.aum) metrics.push({ label: 'AUM', value: this._fmtCap(cache.aum, c) });
    } else if (t === 'crypto') {
      if (cache.market_cap) metrics.push({ label: 'MCap', value: this._fmtCap(cache.market_cap, c) });
      if (cache.volume_24h) metrics.push({ label: 'Vol', value: this._fmtCap(cache.volume_24h, c) });
    } else if (t === 'bond') {
      if (cache.bond_yield != null) metrics.push({ label: 'Yield', value: cache.bond_yield.toFixed(2) + '%' });
    } else if (t === 'precious_metal') {
      if (cache.fifty_two_week_low != null && cache.fifty_two_week_high != null) {
        metrics.push({ label: '52W', value: cache.fifty_two_week_low.toFixed(0) + '-' + cache.fifty_two_week_high.toFixed(0) });
      }
    }
    return metrics.slice(0, 3);
  }

  _cur(code) {
    const map = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', CAD: 'C$', AUD: 'A$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$' };
    return map[code] || (code ? code + ' ' : '');
  }

  _fmtCap(n, currency) {
    if (n == null) return '--';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (currency === 'INR') {
      if (abs >= 1e7) {
        const cr = abs / 1e7;
        return sign + cr.toLocaleString('en-IN', { maximumFractionDigits: cr >= 100 ? 0 : 2 }) + ' Cr';
      }
      if (abs >= 1e5) return sign + (abs / 1e5).toFixed(2) + ' L';
      return sign + abs.toLocaleString('en-IN');
    }
    if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + 'T';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
    return sign + abs.toLocaleString();
  }

  _bindEvents() {
    // ── Clicks ──
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('#add-stage-btn')) {
        this._addingStage = true;
        this._render();
        return;
      }
      // Card favourite button
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('item-favourite', {
          bubbles: true, composed: true,
          detail: { itemId: fav.dataset.fav },
        }));
        return;
      }
      // Card delete button
      const del = e.target.closest('[data-delete]');
      if (del) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('item-delete', {
          bubbles: true, composed: true,
          detail: { itemId: del.dataset.delete },
        }));
        return;
      }
      // Card click → open detail
      const card = e.target.closest('.card');
      if (card) {
        this.dispatchEvent(new CustomEvent('item-open', {
          bubbles: true, composed: true,
          detail: { itemId: card.dataset.itemId },
        }));
      }
    });

    // ── New stage input ──
    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.closest('#new-stage-input')) {
        if (e.key === 'Enter' && e.target.value.trim()) {
          this.dispatchEvent(new CustomEvent('stage-create', {
            bubbles: true, composed: true,
            detail: { name: e.target.value.trim() },
          }));
          this._addingStage = false;
          this._render();
        }
        if (e.key === 'Escape') { this._addingStage = false; this._render(); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.closest('#new-stage-input')) {
        setTimeout(() => { if (this._addingStage) { this._addingStage = false; this._render(); } }, 150);
      }
    });

    // ── Drag: determine if card or column ──
    this.shadow.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.card');
      const col = e.target.closest('.column');

      if (card) {
        // Card drag
        this._dragItemId = card.dataset.itemId;
        this._dragColId = null;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'card:' + card.dataset.itemId);
      } else if (col && col.dataset.stageId) {
        // Column drag (only for real stages, not unassigned)
        this._dragColId = col.dataset.stageId;
        this._dragItemId = null;
        col.classList.add('col-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'col:' + col.dataset.stageId);
      }
    });

    this.shadow.addEventListener('dragend', () => {
      this._dragItemId = null;
      this._dragColId = null;
      this.shadow.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      this.shadow.querySelectorAll('.col-dragging').forEach(el => el.classList.remove('col-dragging'));
      this.shadow.querySelectorAll('.card-drop-target').forEach(el => el.classList.remove('card-drop-target'));
      this.shadow.querySelectorAll('.col-drop-target').forEach(el => el.classList.remove('col-drop-target'));
    });

    this.shadow.addEventListener('dragover', (e) => {
      const col = e.target.closest('.column');
      if (!col) return;

      if (this._dragItemId) {
        // Card dragging → highlight target column
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.shadow.querySelectorAll('.column.card-drop-target').forEach(el => {
          if (el !== col) el.classList.remove('card-drop-target');
        });
        col.classList.add('card-drop-target');
      } else if (this._dragColId && col.dataset.stageId && col.dataset.stageId !== this._dragColId) {
        // Column dragging → show insertion indicator
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.shadow.querySelectorAll('.column.col-drop-target').forEach(el => {
          if (el !== col) el.classList.remove('col-drop-target');
        });
        col.classList.add('col-drop-target');
      }
    });

    this.shadow.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.column');
      if (col && !col.contains(e.relatedTarget)) {
        col.classList.remove('card-drop-target');
        col.classList.remove('col-drop-target');
      }
    });

    this.shadow.addEventListener('drop', (e) => {
      e.preventDefault();
      const col = e.target.closest('.column');
      if (!col) return;

      if (this._dragItemId) {
        // Card drop → change stage
        col.classList.remove('card-drop-target');
        const targetStageId = col.dataset.stageId || null;
        const item = this._items.find(i => i.id === this._dragItemId);
        if (!item || (item.stage_id || null) === targetStageId) return;

        this.dispatchEvent(new CustomEvent('item-stage-change', {
          bubbles: true, composed: true,
          detail: { itemId: this._dragItemId, stageId: targetStageId || null },
        }));
      } else if (this._dragColId && col.dataset.stageId) {
        // Column drop → reorder stages
        col.classList.remove('col-drop-target');
        const targetId = col.dataset.stageId;
        if (targetId === this._dragColId) return;

        // Build new order: insert dragged before target
        const ids = this._stages.map(s => s.id);
        const fromIdx = ids.indexOf(this._dragColId);
        const toIdx = ids.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;

        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, this._dragColId);

        this.dispatchEvent(new CustomEvent('stages-reorder', {
          bubbles: true, composed: true,
          detail: { stageIds: ids },
        }));
      }

      this._dragItemId = null;
      this._dragColId = null;
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define(TAG, PosWatchlistBoard);
