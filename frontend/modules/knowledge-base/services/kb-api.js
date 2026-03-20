// KB API service — wraps all /api/kb/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// --- KB Items ---

export function getItems(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/kb/items${qs ? '?' + qs : ''}`);
}

export function getItem(id) {
  return apiFetch(`/api/kb/items/${id}`);
}

export function createItem(data) {
  return apiFetch('/api/kb/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function saveURL(url, preview = null) {
  const payload = { url };
  if (preview) {
    payload.title = preview.title || null;
    payload.description = preview.description || null;
    payload.image = preview.image || null;
    payload.author = preview.author || null;
    payload.site_name = preview.site_name || null;
    payload.item_type = preview.item_type || null;
  }
  return apiFetch('/api/kb/items/save-url', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function previewURL(url) {
  return apiFetch('/api/kb/items/preview-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function updateItem(id, data) {
  return apiFetch(`/api/kb/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteItem(id) {
  return apiFetch(`/api/kb/items/${id}`, { method: 'DELETE' });
}

// --- Tags on Items ---

export function addTag(itemId, name) {
  return apiFetch(`/api/kb/items/${itemId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(itemId, tagId) {
  return apiFetch(`/api/kb/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
}

// --- Highlights ---

export function getHighlights(itemId) {
  return apiFetch(`/api/kb/items/${itemId}/highlights`);
}

export function createHighlight(itemId, data) {
  return apiFetch(`/api/kb/items/${itemId}/highlights`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateHighlight(highlightId, data) {
  return apiFetch(`/api/kb/highlights/${highlightId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteHighlight(highlightId) {
  return apiFetch(`/api/kb/highlights/${highlightId}`, { method: 'DELETE' });
}

// --- Collections ---

export function getCollections() {
  return apiFetch('/api/kb/collections');
}

export function getCollection(id) {
  return apiFetch(`/api/kb/collections/${id}`);
}

export function createCollection(data) {
  return apiFetch('/api/kb/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCollection(id, data) {
  return apiFetch(`/api/kb/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCollection(id) {
  return apiFetch(`/api/kb/collections/${id}`, { method: 'DELETE' });
}

export function addToCollection(collectionId, kbItemId) {
  return apiFetch(`/api/kb/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify({ kb_item_id: kbItemId }),
  });
}

export function removeFromCollection(collectionId, itemId) {
  return apiFetch(`/api/kb/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' });
}

// --- Tags & Stats ---

export function getTags() {
  return apiFetch('/api/kb/tags');
}

export function getStats() {
  return apiFetch('/api/kb/stats');
}
