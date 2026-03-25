// Feed API service — wraps all /api/feeds/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// --- Feed Folders ---

export function getFeedFolders() {
  return apiFetch('/api/feeds/folders');
}

export function createFeedFolder(name) {
  return apiFetch('/api/feeds/folders', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateFeedFolder(id, data) {
  return apiFetch(`/api/feeds/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteFeedFolder(id) {
  return apiFetch(`/api/feeds/folders/${id}`, { method: 'DELETE' });
}

// --- Feed Sources ---

export function getFeedSources() {
  return apiFetch('/api/feeds/sources');
}

export function subscribeFeed(url, { folderId = null, iconUrl = null } = {}) {
  const payload = { url };
  if (folderId) payload.folder_id = folderId;
  if (iconUrl) payload.icon_url = iconUrl;
  return apiFetch('/api/feeds/sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function discoverFeed(url) {
  return apiFetch('/api/feeds/sources/discover', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function updateFeedSource(id, data) {
  return apiFetch(`/api/feeds/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function unsubscribeFeed(id) {
  return apiFetch(`/api/feeds/sources/${id}`, { method: 'DELETE' });
}

export function refreshFeedSource(id) {
  return apiFetch(`/api/feeds/sources/${id}/refresh`, { method: 'POST' });
}

// --- Feed Items ---

export function getFeedItems(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/feeds/items${qs ? '?' + qs : ''}`);
}

export function updateFeedItem(id, data) {
  return apiFetch(`/api/feeds/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function saveFeedItemToKB(itemId) {
  return apiFetch(`/api/feeds/items/${itemId}/save-to-kb`, { method: 'POST' });
}

export function markAllRead(sourceId = null, folderId = null) {
  return apiFetch('/api/feeds/items/mark-all-read', {
    method: 'POST',
    body: JSON.stringify({ source_id: sourceId, folder_id: folderId }),
  });
}

// --- Stats ---

export function getFeedStats() {
  return apiFetch('/api/feeds/stats');
}
