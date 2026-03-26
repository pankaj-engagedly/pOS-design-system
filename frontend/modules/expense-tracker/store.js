// Expense Tracker module state store

import { createStore } from '../../shared/services/state-store.js';

const expenseStore = createStore({
  // Navigation
  selectedView: 'dashboard',       // 'dashboard' | 'all' | 'uncategorized' | 'account' | 'categories' | 'rules'
  selectedAccountId: null,

  // Data
  accounts: [],
  transactions: [],
  categories: [],
  rules: [],
  dashboardSummary: null,
  categoryBreakdown: [],
  monthlyTrend: [],
  ownerSplit: [],

  // Filters
  selectedMonth: null,              // "2026-03" or null for current

  // UI
  loading: false,
  error: null,
});

export default expenseStore;
