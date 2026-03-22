// Portfolio module state store

import { createStore } from '../../shared/services/state-store.js';

const portfolioStore = createStore({
  // Navigation
  selectedView: 'all',              // 'all' | 'family' | 'plan'
  selectedPortfolioId: null,
  selectedPlanId: null,

  // Content view
  contentView: 'holdings',          // 'holdings' | 'transactions'

  // Data
  portfolios: [],
  holdings: null,                   // PortfolioHoldingsSummary for selected portfolio
  transactions: [],
  plans: [],
  familyAggregation: null,

  // UI
  loading: false,
  error: null,
});

export default portfolioStore;
