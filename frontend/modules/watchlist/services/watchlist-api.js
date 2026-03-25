// Watchlist API service — wraps all /api/watchlist/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Asset Classes ─────────────────────────────────────

export function getAssetClasses() {
  return apiFetch('/api/watchlist/asset-classes');
}

// ── Items ──────────────────────────────────────────────

export function getItems(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/watchlist/items${qs ? '?' + qs : ''}`);
}

export function getItem(id) {
  return apiFetch(`/api/watchlist/items/${id}`);
}

export function createItem(data) {
  return apiFetch('/api/watchlist/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateItem(id, data) {
  return apiFetch(`/api/watchlist/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteItem(id) {
  return apiFetch(`/api/watchlist/items/${id}`, { method: 'DELETE' });
}

// ── Market Data ────────────────────────────────────────

export function refreshItem(id) {
  return apiFetch(`/api/watchlist/items/${id}/refresh`, { method: 'POST' });
}

export function refreshAll() {
  return apiFetch('/api/watchlist/refresh-all', { method: 'POST' });
}

export function getHistory(id, period = '1y') {
  return apiFetch(`/api/watchlist/items/${id}/history?period=${period}`);
}

export function getFinancials(id, frequency = 'annual') {
  return apiFetch(`/api/watchlist/items/${id}/financials?frequency=${frequency}`);
}

// ── Search ─────────────────────────────────────────────

export function searchSymbols(q, assetType = 'stock') {
  return apiFetch(`/api/watchlist/search?q=${encodeURIComponent(q)}&asset_type=${assetType}`);
}

// ── Pipeline Stages ────────────────────────────────────

export function getStages() {
  return apiFetch('/api/watchlist/stages');
}

export function createStage(data) {
  return apiFetch('/api/watchlist/stages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateStage(id, data) {
  return apiFetch(`/api/watchlist/stages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function reorderStages(stageIds) {
  return apiFetch('/api/watchlist/stages/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ stage_ids: stageIds }),
  });
}

export function deleteStage(id) {
  return apiFetch(`/api/watchlist/stages/${id}`, { method: 'DELETE' });
}

// ── Themes ─────────────────────────────────────────────

export function getThemes(assetType) {
  const qs = assetType ? `?asset_type=${assetType}` : '';
  return apiFetch(`/api/watchlist/themes${qs}`);
}

export function createTheme(data) {
  return apiFetch('/api/watchlist/themes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTheme(id, data) {
  return apiFetch(`/api/watchlist/themes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteTheme(id) {
  return apiFetch(`/api/watchlist/themes/${id}`, { method: 'DELETE' });
}

// ── Tags ───────────────────────────────────────────────

export function addTag(itemId, name) {
  return apiFetch(`/api/watchlist/items/${itemId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(itemId, tagId) {
  return apiFetch(`/api/watchlist/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
}

export function getTags() {
  return apiFetch('/api/watchlist/tags');
}

// ── Stats ──────────────────────────────────────────────

export function getStats() {
  return apiFetch('/api/watchlist/stats');
}

// ── Snapshots / Trends ────────────────────────────────

export function getAvailableMetrics(itemId) {
  return apiFetch(`/api/watchlist/items/${itemId}/metrics/available`);
}

export function getMetricHistory(itemId, metric, fromDate, toDate) {
  const params = new URLSearchParams({ metric });
  if (fromDate) params.set('from_date', fromDate);
  if (toDate) params.set('to_date', toDate);
  return apiFetch(`/api/watchlist/items/${itemId}/metrics/history?${params}`);
}

export function getAccumulatedFinancials(itemId, statementType, frequency = 'annual') {
  const params = new URLSearchParams({ frequency });
  if (statementType) params.set('statement_type', statementType);
  return apiFetch(`/api/watchlist/items/${itemId}/financials/accumulated?${params}`);
}

export function triggerSnapshots() {
  return apiFetch('/api/watchlist/snapshots/trigger', { method: 'POST' });
}

// ── Column Preferences (localStorage) ─────────────────

const COL_PREFS_PREFIX = 'pos-watchlist-cols-';

export function getColumnPrefs(assetClass) {
  try {
    const saved = localStorage.getItem(COL_PREFS_PREFIX + assetClass);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function setColumnPrefs(assetClass, keys) {
  localStorage.setItem(COL_PREFS_PREFIX + assetClass, JSON.stringify(keys));
}
