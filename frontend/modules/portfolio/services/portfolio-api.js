// Portfolio API service — wraps all /api/portfolio/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Watchlist (cross-service, frontend composition) ────

export function getWatchlistItems(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return apiFetch(`/api/watchlist/items${qs ? '?' + qs : ''}`);
}

export function getWatchlistStages() {
  return apiFetch('/api/watchlist/stages');
}

// ── Portfolios ─────────────────────────────────────────

export function getPortfolios() {
  return apiFetch('/api/portfolio/portfolios');
}

export function getPortfolio(id) {
  return apiFetch(`/api/portfolio/portfolios/${id}`);
}

export function createPortfolio(data) {
  return apiFetch('/api/portfolio/portfolios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePortfolio(id, data) {
  return apiFetch(`/api/portfolio/portfolios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePortfolio(id) {
  return apiFetch(`/api/portfolio/portfolios/${id}`, { method: 'DELETE' });
}

// ── CAS Import ─────────────────────────────────────────

export async function importCAS(portfolioId, file, password) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);

  // Use fetch directly for multipart form
  const { getAccessToken } = await import('../../../shared/services/auth-store.js');
  const token = getAccessToken();

  const response = await fetch(`/api/portfolio/portfolios/${portfolioId}/import`, {
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

export async function importStocks(portfolioId, file, broker) {
  const formData = new FormData();
  formData.append('file', file);
  if (broker) formData.append('broker', broker);

  const { getAccessToken } = await import('../../../shared/services/auth-store.js');
  const token = getAccessToken();

  const response = await fetch(`/api/portfolio/portfolios/${portfolioId}/import-stocks`, {
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

export function getImports(portfolioId) {
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/imports`);
}

// ── Holdings ───────────────────────────────────────────

export function getHoldings(portfolioId) {
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/holdings`);
}

// ── Transactions ───────────────────────────────────────

export function getTransactions(portfolioId, params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/transactions${qs ? '?' + qs : ''}`);
}

// ── NAV ────────────────────────────────────────────────

export function refreshNAV() {
  return apiFetch('/api/portfolio/nav/refresh', { method: 'POST' });
}

export function refreshStockPrices() {
  return apiFetch('/api/portfolio/stock-prices/refresh', { method: 'POST' });
}

// ── Aggregation ────────────────────────────────────────

export function getFamilyAggregation() {
  return apiFetch('/api/portfolio/aggregation/family');
}

// ── Tags ───────────────────────────────────────────────

export function getPortfolioTags(portfolioId) {
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/tags`);
}

export function addPortfolioTag(portfolioId, name) {
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removePortfolioTag(portfolioId, tagId) {
  return apiFetch(`/api/portfolio/portfolios/${portfolioId}/tags/${tagId}`, { method: 'DELETE' });
}

// ── Investment Plans ───────────────────────────────────

export function getPlans(status) {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/api/portfolio/plans${qs}`);
}

export function getPlan(id) {
  return apiFetch(`/api/portfolio/plans/${id}`);
}

export function createPlan(data) {
  return apiFetch('/api/portfolio/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePlan(id, data) {
  return apiFetch(`/api/portfolio/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePlan(id) {
  return apiFetch(`/api/portfolio/plans/${id}`, { method: 'DELETE' });
}

export function getPlanHistory(planId) {
  return apiFetch(`/api/portfolio/plans/${planId}/history`);
}

// ── Allocations ────────────────────────────────────────

export function getAllocations(planId) {
  return apiFetch(`/api/portfolio/plans/${planId}/allocations`);
}

export function createAllocation(planId, data) {
  return apiFetch(`/api/portfolio/plans/${planId}/allocations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAllocation(planId, allocationId, data) {
  return apiFetch(`/api/portfolio/plans/${planId}/allocations/${allocationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAllocation(planId, allocationId) {
  return apiFetch(`/api/portfolio/plans/${planId}/allocations/${allocationId}`, { method: 'DELETE' });
}

// ── Deployment Events ──────────────────────────────────

export function getDeployments(allocationId) {
  return apiFetch(`/api/portfolio/allocations/${allocationId}/deployments`);
}

export function createDeployment(allocationId, data) {
  return apiFetch(`/api/portfolio/allocations/${allocationId}/deployments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
