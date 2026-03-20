// Vault API service

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories() {
  return apiFetch('/api/vault/categories');
}

export function createCategory(data) {
  return apiFetch('/api/vault/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(id, data) {
  return apiFetch(`/api/vault/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id) {
  return apiFetch(`/api/vault/categories/${id}`, { method: 'DELETE' });
}

export function reorderCategories(orderedIds) {
  return apiFetch('/api/vault/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

// ── Field Templates ───────────────────────────────────────────────────────────

export function getTemplates(categoryId) {
  return apiFetch(`/api/vault/categories/${categoryId}/templates`);
}

export function createTemplate(categoryId, data) {
  return apiFetch(`/api/vault/categories/${categoryId}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTemplate(categoryId, templateId, data) {
  return apiFetch(`/api/vault/categories/${categoryId}/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(categoryId, templateId) {
  return apiFetch(`/api/vault/categories/${categoryId}/templates/${templateId}`, {
    method: 'DELETE',
  });
}

export function reorderTemplates(categoryId, orderedIds) {
  return apiFetch(`/api/vault/categories/${categoryId}/templates/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

// ── Items ─────────────────────────────────────────────────────────────────────

export function getItems(params = {}) {
  const q = new URLSearchParams();
  if (params.category_id) q.set('category_id', params.category_id);
  if (params.search) q.set('search', params.search);
  if (params.is_favorite) q.set('is_favorite', 'true');
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

// ── Field Values ──────────────────────────────────────────────────────────────

export function addFieldValue(itemId, data) {
  return apiFetch(`/api/vault/items/${itemId}/fields`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateFieldValue(itemId, valueId, data) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${valueId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteFieldValue(itemId, valueId) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${valueId}`, { method: 'DELETE' });
}

export function revealFieldValue(itemId, valueId) {
  return apiFetch(`/api/vault/items/${itemId}/fields/${valueId}/reveal`);
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
