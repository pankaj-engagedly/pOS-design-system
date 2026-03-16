// Vault API service

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Items ─────────────────────────────────────────────────────────────────────

export function getItems(params = {}) {
  const q = new URLSearchParams();
  if (params.tag) q.set('tag', params.tag);
  if (params.search) q.set('search', params.search);
  if (params.favorites) q.set('favorites', 'true');
  const qs = q.toString();
  return apiFetch(`/api/vault/items${qs ? '?' + qs : ''}`);
}

export function getItem(id) {
  return apiFetch(`/api/vault/items/${id}`);
}

export function createItem(data) {
  return apiFetch('/api/vault/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateItem(id, data) {
  return apiFetch(`/api/vault/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteItem(id) {
  return apiFetch(`/api/vault/items/${id}`, { method: 'DELETE' });
}

// ── Fields ────────────────────────────────────────────────────────────────────

export function addField(itemId, data) {
  return apiFetch(`/api/vault/items/${itemId}/fields`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateField(itemId, fieldId, data) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteField(itemId, fieldId) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${fieldId}`, { method: 'DELETE' });
}

export function reorderFields(itemId, orderedIds) {
  return apiFetch(`/api/vault/items/${itemId}/fields/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

export function revealField(itemId, fieldId) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${fieldId}/reveal`);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function getTags() {
  return apiFetch('/api/vault/tags');
}

export function addTag(itemId, name) {
  return apiFetch(`/api/vault/items/${itemId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(itemId, tagId) {
  return apiFetch(`/api/vault/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
}
