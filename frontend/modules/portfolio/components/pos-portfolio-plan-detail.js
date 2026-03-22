// pos-portfolio-plan-detail — Unified investment planning view
// Select a plan at the top, then click-to-edit target amounts in the table.
// All allocations go to the selected plan. Funded-from column shows all plans.

import { icon } from '../../../shared/utils/icons.js';
import { formatINR } from './pos-portfolio-holdings.js';
import {
  getAllocations, createAllocation, updateAllocation, deleteAllocation,
  getPlans, getHoldings, getPortfolios,
  getWatchlistItems,
} from '../services/portfolio-api.js';

class PosPortfolioPlanDetail extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._plans = [];
    this._assets = [];
    this._allAllocations = [];
    this._groupBy = 'asset_type';
    this._editingCell = null;
    this._activePlanId = null; // selected plan — new allocations go here
    this._loaded = false;
  }

  set plan(val) {
    if (!this._loaded) this._loadAll();
  }

  connectedCallback() {
    this._bindEvents();
    if (!this._loaded) this._loadAll();
  }

  async _loadAll() {
    this._loaded = true;
    try {
      const [plans, portfolios, watchlistItems] = await Promise.all([
        getPlans(),
        getPortfolios(),
        getWatchlistItems({ limit: 500 }).catch(() => []),
      ]);

      this._plans = plans;

      // Auto-select first active plan if none selected
      if (!this._activePlanId) {
        const active = plans.find(p => p.status === 'active');
        if (active) this._activePlanId = active.id;
      }

      // Load all allocations across all plans
      const allAllocations = [];
      for (const plan of plans) {
        try {
          const allocs = await getAllocations(plan.id);
          for (const a of allocs) {
            allAllocations.push({ ...a, _planId: plan.id, _planName: plan.name });
          }
        } catch (e) { /* skip */ }
      }
      this._allAllocations = allAllocations;

      // Load holdings
      const allHoldings = [];
      for (const p of portfolios) {
        try {
          const h = await getHoldings(p.id);
          for (const holding of (h.holdings || [])) {
            allHoldings.push({ ...holding, _portfolioName: p.name });
          }
        } catch (e) { /* skip */ }
      }

      this._assets = this._mergeAssets(allHoldings, watchlistItems, allAllocations);
      this._render();
    } catch (e) {
      console.error('Failed to load plan data', e);
    }
  }

  _mergeAssets(holdings, watchlistItems, allocations) {
    const assetMap = new Map();
    const allocsByAsset = new Map();
    for (const a of allocations) {
      if (!allocsByAsset.has(a.asset_identifier)) allocsByAsset.set(a.asset_identifier, []);
      allocsByAsset.get(a.asset_identifier).push(a);
    }

    for (const h of holdings) {
      const key = h.scheme_isin || h.scheme_name;
      if (assetMap.has(key)) continue;
      const allocs = allocsByAsset.get(key) || [];
      assetMap.set(key, {
        key, name: h.scheme_name, identifier: h.scheme_isin || '',
        asset_type: 'mutual_fund', source: 'portfolio',
        current_value: Number(h.current_value || 0),
        current_nav: Number(h.current_nav || 0),
        units: Number(h.total_units || 0),
        allocations: allocs,
        total_allocated: allocs.reduce((s, a) => s + Number(a.target_amount || 0), 0),
        total_deployed: allocs.reduce((s, a) => s + Number(a.deployed_amount || 0), 0),
        target_price: allocs.length > 0 ? Number(allocs[0].target_price || 0) : null,
      });
    }

    for (const item of watchlistItems) {
      const key = item.symbol;
      if (assetMap.has(key)) continue;
      const allocs = allocsByAsset.get(key) || [];
      assetMap.set(key, {
        key, name: item.name, identifier: item.symbol,
        asset_type: item.asset_type || 'stock', source: 'watchlist',
        stage: item.stage?.name || '',
        current_value: 0,
        current_nav: item.cache?.current_price || item.cache?.nav || 0,
        units: 0,
        allocations: allocs,
        total_allocated: allocs.reduce((s, a) => s + Number(a.target_amount || 0), 0),
        total_deployed: allocs.reduce((s, a) => s + Number(a.deployed_amount || 0), 0),
        target_price: allocs.length > 0 ? Number(allocs[0].target_price || 0) : null,
      });
    }

    for (const a of allocations) {
      if (!assetMap.has(a.asset_identifier)) {
        const allocs = allocsByAsset.get(a.asset_identifier) || [];
        assetMap.set(a.asset_identifier, {
          key: a.asset_identifier, name: a.asset_name, identifier: a.asset_identifier,
          asset_type: a.asset_type, source: 'manual',
          current_value: 0, current_nav: 0, units: 0,
          allocations: allocs,
          total_allocated: allocs.reduce((s, al) => s + Number(al.target_amount || 0), 0),
          total_deployed: allocs.reduce((s, al) => s + Number(al.deployed_amount || 0), 0),
          target_price: allocs.length > 0 ? Number(allocs[0].target_price || 0) : null,
        });
      }
    }

    return [...assetMap.values()];
  }

  _getGrouped() {
    const groups = {};
    for (const a of this._assets) {
      const gk = this._groupBy === 'source' ? a.source : a.asset_type;
      if (!groups[gk]) groups[gk] = [];
      groups[gk].push(a);
    }
    const order = ['mutual_fund', 'stock', 'etf', 'gold', 'bond', 'crypto', 'portfolio', 'watchlist', 'manual'];
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  _render() {
    const plans = this._plans.filter(p => p.status === 'active');
    const totalCorpus = plans.reduce((s, p) => s + Number(p.total_corpus || 0), 0);
    const totalDeployed = plans.reduce((s, p) => s + Number(p.total_deployed || 0), 0);
    const totalRemaining = totalCorpus - totalDeployed;
    const totalAllocated = this._assets.reduce((s, a) => s + a.total_allocated, 0);
    const groups = this._getGrouped();
    const activePlan = plans.find(p => p.id === this._activePlanId);

    const groupLabels = {
      mutual_fund: 'Mutual Funds', stock: 'Stocks', etf: 'ETFs',
      gold: 'Gold', bond: 'Bonds', crypto: 'Crypto',
      portfolio: 'Portfolio Holdings', watchlist: 'Watchlist', manual: 'Other',
    };

    this.shadow.innerHTML = `
      <style>
        :host { display: block; }

        .plans-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: stretch; }
        .plan-card {
          border: 2px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 8px; padding: 10px 14px; min-width: 140px;
          display: flex; flex-direction: column; gap: 4px;
          cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .plan-card:hover { border-color: var(--pos-color-action-primary, #4361ee); }
        .plan-card.active {
          border-color: var(--pos-color-action-primary, #4361ee);
          box-shadow: 0 0 0 1px var(--pos-color-action-primary, #4361ee);
          background: #f0f4ff;
        }
        .plan-card-name { font-size: 13px; font-weight: 600; color: var(--pos-color-text-primary); }
        .plan-card-corpus { font-size: 12px; color: var(--pos-color-text-secondary); }
        .plan-card-bar { height: 4px; background: #e2e2e8; border-radius: 2px; margin-top: 4px; }
        .plan-card-fill { height: 100%; border-radius: 2px; background: var(--pos-color-action-primary, #4361ee); }
        .plan-card-pct { font-size: 11px; color: var(--pos-color-text-tertiary); }
        .plan-card-active-label {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
          color: var(--pos-color-action-primary, #4361ee); font-weight: 600;
        }

        .totals-card {
          border: 2px solid var(--pos-color-border-default, #e2e2e8);
          border-radius: 8px; padding: 10px 14px; min-width: 180px; margin-left: auto;
        }
        .totals-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--pos-color-text-tertiary); }
        .totals-card .value { font-size: 15px; font-weight: 700; color: var(--pos-color-text-primary); }
        .totals-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; font-size: 12px; }
        .totals-row .label { color: var(--pos-color-text-tertiary); }

        .active-plan-hint {
          font-size: 12px; color: var(--pos-color-text-secondary);
          margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
        }
        .active-plan-hint strong { color: var(--pos-color-action-primary, #4361ee); }

        .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .group-toggle { display: flex; border: 1px solid var(--pos-color-border-default, #e2e2e8); border-radius: 6px; overflow: hidden; }
        .group-btn {
          padding: 4px 10px; font-size: 11px; font-family: inherit; cursor: pointer;
          border: none; background: transparent; color: var(--pos-color-text-secondary);
        }
        .group-btn.active { background: var(--pos-color-action-primary, #4361ee); color: white; }
        .btn-sm {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border: 1px solid var(--pos-color-border-default);
          border-radius: 6px; background: transparent; font-size: 11px;
          font-family: inherit; cursor: pointer; color: var(--pos-color-text-secondary);
        }
        .btn-sm:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }

        .group-header {
          padding: 8px 12px; margin-top: 12px;
          font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
          color: var(--pos-color-text-tertiary);
          background: var(--pos-color-surface-secondary, #f8f8fc);
          border-radius: 6px 6px 0 0; border-bottom: 1px solid var(--pos-color-border-default);
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
        th {
          text-align: right; padding: 6px 10px; font-weight: 500; font-size: 11px;
          color: var(--pos-color-text-tertiary); border-bottom: 1px solid var(--pos-color-border-default);
        }
        th:first-child { text-align: left; }
        td {
          padding: 8px 10px; text-align: right;
          border-bottom: 1px solid var(--pos-color-border-subtle, #f0f0f5);
          font-variant-numeric: tabular-nums; vertical-align: top;
        }
        td:first-child { text-align: left; }
        tr:hover td { background: var(--pos-color-surface-secondary, #f8f8fc); }

        .asset-name { font-weight: 500; color: var(--pos-color-text-primary); }
        .asset-sub { font-size: 11px; color: var(--pos-color-text-tertiary); margin-top: 1px; }
        .source-badge {
          display: inline-block; padding: 1px 5px; border-radius: 3px;
          font-size: 10px; font-weight: 500;
        }
        .source-portfolio { background: #dbeafe; color: #1e40af; }
        .source-watchlist { background: #fef3c7; color: #92400e; }
        .source-manual { background: #e2e2e8; color: #6b6b80; }

        .fund-chips { display: flex; flex-direction: column; gap: 3px; text-align: left; }
        .fund-chip {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--pos-color-text-secondary);
        }
        .fund-chip-plan { font-weight: 500; color: var(--pos-color-text-primary); }
        .fund-chip-remove {
          cursor: pointer; opacity: 0.4; background: none; border: none; padding: 0;
          color: var(--pos-color-text-tertiary); display: inline-flex;
        }
        .fund-chip-remove:hover { opacity: 1; color: #dc2626; }

        .editable {
          cursor: pointer; min-width: 60px; padding: 3px 6px;
          border-radius: 4px; transition: background 0.1s; display: inline-block;
        }
        .editable:hover { background: #eef2ff; }
        .editable.empty { color: var(--pos-color-text-tertiary); font-style: italic; font-size: 11px; }
        .edit-input {
          width: 80px; padding: 3px 6px; border: 1px solid var(--pos-color-action-primary, #4361ee);
          border-radius: 4px; font-size: 13px; font-family: inherit;
          text-align: right; outline: none; background: white;
        }

        .deploy-btn {
          display: inline-flex; align-items: center; gap: 2px;
          padding: 2px 6px; font-size: 10px; border: 1px solid #d1d5db;
          border-radius: 3px; background: transparent; cursor: pointer;
          color: var(--pos-color-text-secondary); font-family: inherit;
        }
        .deploy-btn:hover { border-color: var(--pos-color-action-primary); color: var(--pos-color-action-primary); }
        .no-plan-hint {
          text-align: center; padding: 40px; color: var(--pos-color-text-tertiary); font-size: 13px;
        }
      </style>

      <!-- Plan cards — click to select active plan -->
      <div class="plans-bar">
        ${plans.map(p => {
          const pct = Math.round(Number(p.deployment_pct || 0));
          const rem = Number(p.total_corpus || 0) - Number(p.total_deployed || 0);
          const isActive = p.id === this._activePlanId;
          return `
            <div class="plan-card ${isActive ? 'active' : ''}" data-action="select-plan" data-plan-id="${p.id}">
              ${isActive ? '<div class="plan-card-active-label">Active</div>' : ''}
              <div class="plan-card-name">${this._esc(p.name)}</div>
              <div class="plan-card-corpus">\u20B9${formatINR(p.total_corpus)}</div>
              <div class="plan-card-bar"><div class="plan-card-fill" style="width:${Math.min(pct,100)}%"></div></div>
              <div class="plan-card-pct">${pct}% deployed \u00B7 \u20B9${formatINR(rem)} left</div>
            </div>`;
        }).join('')}
        <div class="plan-card" style="border-style:dashed;cursor:pointer;justify-content:center;align-items:center;" data-action="create-plan">
          <div style="color:var(--pos-color-text-tertiary);font-size:12px;">${icon('plus', 16)}</div>
        </div>
        <div class="totals-card">
          <div class="label">Total across ${plans.length} plan${plans.length !== 1 ? 's' : ''}</div>
          <div class="value">\u20B9${formatINR(totalCorpus)}</div>
          <div class="totals-row">
            <span><span class="label">Allocated</span> \u20B9${formatINR(totalAllocated)}</span>
            <span><span class="label">Deployed</span> \u20B9${formatINR(totalDeployed)}</span>
            <span><span class="label">Remaining</span> \u20B9${formatINR(totalRemaining)}</span>
          </div>
        </div>
      </div>

      ${activePlan ? `
        <div class="active-plan-hint">
          Allocating from: <strong>${this._esc(activePlan.name)}</strong>
          (\u20B9${formatINR(Number(activePlan.total_corpus || 0) - Number(activePlan.total_deployed || 0))} remaining)
        </div>
      ` : plans.length > 0 ? '<div class="active-plan-hint">Click a plan above to start allocating</div>' : ''}

      ${plans.length === 0 ? `
        <div class="no-plan-hint">
          ${icon('flag', 32)}<br><br>
          Create an investment plan to start allocating capital to your assets.
        </div>
      ` : `
        <div class="toolbar">
          <div class="group-toggle">
            <button class="group-btn ${this._groupBy === 'asset_type' ? 'active' : ''}" data-group="asset_type">By Asset Type</button>
            <button class="group-btn ${this._groupBy === 'source' ? 'active' : ''}" data-group="source">By Source</button>
          </div>
          <div style="flex:1"></div>
          <button class="btn-sm" data-action="add-manual">${icon('plus', 12)} Add Asset</button>
        </div>

        ${groups.map(([groupKey, assets]) => `
          <div class="group-header">${groupLabels[groupKey] || groupKey} (${assets.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width:25%">Asset</th>
                <th>Source</th>
                <th>Price</th>
                <th>Holding</th>
                <th>Target \u20B9</th>
                <th style="width:18%">Funded From</th>
                <th>Buy Below</th>
                <th>Deployed</th>
              </tr>
            </thead>
            <tbody>
              ${assets.map(a => this._renderRow(a)).join('')}
            </tbody>
          </table>
        `).join('')}
      `}
    `;
  }

  _renderRow(a) {
    const editing = this._editingCell;
    const isEditingTarget = editing?.assetKey === a.key && editing?.field === 'target_amount';
    const isEditingPrice = editing?.assetKey === a.key && editing?.field === 'target_price';

    const sourceClass = a.source === 'portfolio' ? 'source-portfolio'
      : a.source === 'watchlist' ? 'source-watchlist' : 'source-manual';
    const sourceLabel = a.source === 'portfolio' ? 'Portfolio'
      : a.source === 'watchlist' ? (a.stage || 'Watchlist') : 'Manual';

    // For the "Target" column — show the allocation for the active plan (editable)
    const activePlanAlloc = a.allocations.find(al => al._planId === this._activePlanId);
    const activePlanAmount = activePlanAlloc ? Number(activePlanAlloc.target_amount) : null;

    return `
      <tr data-asset-key="${this._esc(a.key)}">
        <td>
          <div class="asset-name">${this._esc(a.name)}</div>
          <div class="asset-sub">${this._esc(a.identifier)}</div>
        </td>
        <td><span class="source-badge ${sourceClass}">${sourceLabel}</span></td>
        <td>${a.current_nav > 0 ? formatINR(a.current_nav, 2) : '-'}</td>
        <td>${a.current_value > 0 ? '\u20B9' + formatINR(a.current_value) : '-'}</td>
        <td>
          ${isEditingTarget
            ? `<input class="edit-input" data-field="target_amount" data-key="${this._esc(a.key)}"
                 type="number" value="${activePlanAmount || ''}" min="0" step="100" autofocus>`
            : `<span class="editable ${activePlanAmount === null ? 'empty' : ''}"
                 data-edit="target_amount" data-key="${this._esc(a.key)}"
                 title="Set target for active plan">
                 ${activePlanAmount !== null ? '\u20B9' + formatINR(activePlanAmount) : 'click to set'}
               </span>`
          }
        </td>
        <td>
          <div class="fund-chips">
            ${a.allocations.map(al => `
              <div class="fund-chip">
                <span class="fund-chip-plan">${this._esc(al._planName)}</span>
                \u20B9${formatINR(al.target_amount)}
                <button class="fund-chip-remove" data-action="remove-alloc" data-alloc-id="${al.id}"
                  data-plan-id="${al._planId}" title="Remove">${icon('x', 10)}</button>
              </div>
            `).join('')}
            ${a.allocations.length === 0 ? '<span style="font-size:11px;color:var(--pos-color-text-tertiary)">-</span>' : ''}
            ${a.total_allocated > 0 && a.allocations.length > 1
              ? `<div style="font-size:10px;font-weight:600;color:var(--pos-color-text-secondary);margin-top:2px;">Total: \u20B9${formatINR(a.total_allocated)}</div>`
              : ''
            }
          </div>
        </td>
        <td>
          ${isEditingPrice
            ? `<input class="edit-input" data-field="target_price" data-key="${this._esc(a.key)}"
                 type="number" value="${a.target_price || ''}" min="0" step="0.01" autofocus>`
            : `<span class="editable ${!a.target_price ? 'empty' : ''}"
                 data-edit="target_price" data-key="${this._esc(a.key)}">
                 ${a.target_price ? formatINR(a.target_price, 2) : '-'}
               </span>`
          }
        </td>
        <td>
          ${a.total_deployed > 0 ? '\u20B9' + formatINR(a.total_deployed) : '-'}
          ${a.allocations.filter(al => al.id).length > 0 ? `
            <br>${a.allocations.filter(al => al.id).map(al => `
              <button class="deploy-btn" data-action="deploy" data-alloc-id="${al.id}">
                ${icon('plus', 10)} Deploy
              </button>
            `).join('')}
          ` : ''}
        </td>
      </tr>`;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      // Select plan
      const planCard = e.target.closest('[data-action="select-plan"]');
      if (planCard) {
        this._activePlanId = planCard.dataset.planId;
        this._editingCell = null;
        this._render();
        return;
      }

      // Group toggle
      const groupBtn = e.target.closest('[data-group]');
      if (groupBtn) { this._groupBy = groupBtn.dataset.group; this._render(); return; }

      // Editable cell
      const editEl = e.target.closest('[data-edit]');
      if (editEl) {
        if (!this._activePlanId) {
          alert('Select a plan first by clicking one of the plan cards above.');
          return;
        }
        this._editingCell = { assetKey: editEl.dataset.key, field: editEl.dataset.edit };
        this._render();
        requestAnimationFrame(() => {
          const input = this.shadow.querySelector('.edit-input');
          if (input) { input.focus(); input.select(); }
        });
        return;
      }

      const action = e.target.closest('[data-action]')?.dataset.action;

      if (action === 'remove-alloc') {
        const allocId = e.target.closest('[data-alloc-id]')?.dataset.allocId;
        const planId = e.target.closest('[data-plan-id]')?.dataset.planId;
        if (allocId && planId) this._removeAllocation(planId, allocId);
        return;
      }

      if (action === 'deploy') {
        const allocId = e.target.closest('[data-alloc-id]')?.dataset.allocId;
        this.dispatchEvent(new CustomEvent('record-deployment', {
          bubbles: true, composed: true, detail: { allocationId: allocId },
        }));
        return;
      }

      if (action === 'add-manual') {
        if (this._activePlanId) {
          this.dispatchEvent(new CustomEvent('add-allocation', {
            bubbles: true, composed: true, detail: { planId: this._activePlanId },
          }));
        }
        return;
      }

      if (action === 'create-plan') {
        this.dispatchEvent(new CustomEvent('create-plan', { bubbles: true, composed: true }));
        return;
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('edit-input')) {
        if (e.key === 'Enter') this._saveEdit(e.target);
        if (e.key === 'Escape') { this._editingCell = null; this._render(); }
        if (e.key === 'Tab') { e.preventDefault(); this._saveEdit(e.target); }
      }
    });

    this.shadow.addEventListener('focusout', (e) => {
      if (e.target.classList.contains('edit-input')) {
        setTimeout(() => { if (this._editingCell) this._saveEdit(e.target); }, 100);
      }
    });
  }

  async _saveEdit(input) {
    const key = input.dataset.key;
    const field = input.dataset.field;
    const value = input.value ? Number(input.value) : null;
    this._editingCell = null;

    const asset = this._assets.find(a => a.key === key);
    if (!asset) { this._render(); return; }

    if (field === 'target_amount') {
      // Find existing allocation for this asset in the active plan
      const existing = asset.allocations.find(al => al._planId === this._activePlanId);

      if (existing) {
        if (value && value > 0) {
          await updateAllocation(this._activePlanId, existing.id, { target_amount: value }).catch(console.error);
        } else {
          // Clear = remove allocation
          await deleteAllocation(this._activePlanId, existing.id).catch(console.error);
        }
      } else if (value && value > 0) {
        // Create new allocation in the active plan
        await createAllocation(this._activePlanId, {
          asset_identifier: asset.identifier || asset.key,
          asset_name: asset.name,
          asset_type: asset.asset_type,
          target_amount: value,
          target_price: asset.target_price || null,
        }).catch(console.error);
      }
    } else if (field === 'target_price') {
      // Update target_price on all allocations for this asset
      for (const alloc of asset.allocations) {
        await updateAllocation(alloc._planId, alloc.id, { target_price: value }).catch(console.error);
      }
    }

    await this._loadAll();
  }

  async _removeAllocation(planId, allocId) {
    await deleteAllocation(planId, allocId).catch(console.error);
    await this._loadAll();
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-portfolio-plan-detail', PosPortfolioPlanDetail);
