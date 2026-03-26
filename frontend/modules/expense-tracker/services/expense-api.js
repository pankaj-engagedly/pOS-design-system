// Expense Tracker API service — wraps /api/expenses/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Accounts ───────────────────────────────────────────

export function getAccounts() {
  return apiFetch('/api/expenses/accounts');
}

export function createAccount(data) {
  return apiFetch('/api/expenses/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAccount(id, data) {
  return apiFetch(`/api/expenses/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAccount(id) {
  return apiFetch(`/api/expenses/accounts/${id}`, { method: 'DELETE' });
}

// ── Transactions ───────────────────────────────────────

export function getTransactions(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return apiFetch(`/api/expenses/transactions${qs ? '?' + qs : ''}`);
}

export function updateTransaction(id, data) {
  return apiFetch(`/api/expenses/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function createTransaction(data) {
  return apiFetch('/api/expenses/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id) {
  return apiFetch(`/api/expenses/transactions/${id}`, { method: 'DELETE' });
}

// ── Import ─────────────────────────────────────────────

export async function importStatement(accountId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const { getAccessToken } = await import('../../../shared/services/auth-store.js');
  const token = getAccessToken();

  const response = await fetch(`/api/expenses/accounts/${accountId}/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Import failed: ${response.status}`);
  }

  return response.json();
}

export function getImports(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return apiFetch(`/api/expenses/imports${qs ? '?' + qs : ''}`);
}

// ── Categories ─────────────────────────────────────────

export function getCategories() {
  return apiFetch('/api/expenses/categories');
}

export function createCategory(data) {
  return apiFetch('/api/expenses/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(id, data) {
  return apiFetch(`/api/expenses/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id) {
  return apiFetch(`/api/expenses/categories/${id}`, { method: 'DELETE' });
}

// ── Category Rules ─────────────────────────────────────

export function getRules() {
  return apiFetch('/api/expenses/rules');
}

export function createRule(data) {
  return apiFetch('/api/expenses/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRule(id, data) {
  return apiFetch(`/api/expenses/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteRule(id) {
  return apiFetch(`/api/expenses/rules/${id}`, { method: 'DELETE' });
}

// ── Dashboard ──────────────────────────────────────────

export function getDashboardSummary(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/summary${qs}`);
}

export function getCategoryBreakdown(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/category-breakdown${qs}`);
}

export function getMonthlyTrend(months = 12) {
  return apiFetch(`/api/expenses/dashboard/monthly-trend?months=${months}`);
}

export function getOwnerSplit(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/owner-split${qs}`);
}

// ── Tags ───────────────────────────────────────────────

export function getTags() {
  return apiFetch('/api/expenses/tags');
}

export function getTransactionTags(txnId) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags`);
}

export function addTransactionTag(txnId, name) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTransactionTag(txnId, tagId) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags/${tagId}`, { method: 'DELETE' });
}
