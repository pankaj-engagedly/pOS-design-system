// Photos API service — wraps all /api/photos/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';

// ── Photos ──────────────────────────────────────────────

export function getPhotos(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/photos${qs ? '?' + qs : ''}`);
}

export function getTimeline(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/photos/timeline${qs ? '?' + qs : ''}`);
}

export function getPhoto(id) {
  return apiFetch(`/api/photos/${id}`);
}

export function updatePhoto(id, data) {
  return apiFetch(`/api/photos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePhoto(id) {
  return apiFetch(`/api/photos/${id}`, { method: 'DELETE' });
}

export async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch('/api/photos/upload', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function uploadPhotoBulk(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const token = getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch('/api/photos/upload/bulk', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Bulk upload failed: ${response.status}`);
  }
  return response.json();
}

export function thumbUrl(photoId, size = 'sm') {
  const token = getAccessToken();
  return `/api/photos/${photoId}/thumb/${size}${token ? '?token=' + token : ''}`;
}

export function originalUrl(photoId) {
  const token = getAccessToken();
  return `/api/photos/${photoId}/file${token ? '?token=' + token : ''}`;
}

export function getStats() {
  return apiFetch('/api/photos/stats');
}

export function getDuplicates() {
  return apiFetch('/api/photos/duplicates');
}

// ── Tags ────────────────────────────────────────────────

export function addTag(photoId, name) {
  return apiFetch(`/api/photos/${photoId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(photoId, tagId) {
  return apiFetch(`/api/photos/${photoId}/tags/${tagId}`, { method: 'DELETE' });
}

export function getTags() {
  return apiFetch('/api/photos/tags');
}

// ── Albums ──────────────────────────────────────────────

export function getAlbums() {
  return apiFetch('/api/photos/albums');
}

export function getAlbum(id) {
  return apiFetch(`/api/photos/albums/${id}`);
}

export function createAlbum(data) {
  return apiFetch('/api/photos/albums', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAlbum(id, data) {
  return apiFetch(`/api/photos/albums/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAlbum(id) {
  return apiFetch(`/api/photos/albums/${id}`, { method: 'DELETE' });
}

export function addPhotosToAlbum(albumId, photoIds) {
  return apiFetch(`/api/photos/albums/${albumId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ photo_ids: photoIds }),
  });
}

export function removePhotoFromAlbum(albumId, photoId) {
  return apiFetch(`/api/photos/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' });
}

// ── Comments ────────────────────────────────────────────

export function getComments(photoId) {
  return apiFetch(`/api/photos/${photoId}/comments`);
}

export function addComment(photoId, text) {
  return apiFetch(`/api/photos/${photoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function updateComment(commentId, text) {
  return apiFetch(`/api/photos/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  });
}

export function deleteComment(commentId) {
  return apiFetch(`/api/photos/comments/${commentId}`, { method: 'DELETE' });
}

// ── People ──────────────────────────────────────────────

export function getPeople() {
  return apiFetch('/api/photos/people');
}

export function createPerson(name) {
  return apiFetch('/api/photos/people', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updatePerson(id, data) {
  return apiFetch(`/api/photos/people/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePerson(id) {
  return apiFetch(`/api/photos/people/${id}`, { method: 'DELETE' });
}

export function getPersonPhotos(personId, params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && val !== undefined && val !== '') query.set(key, val);
  }
  const qs = query.toString();
  return apiFetch(`/api/photos/people/${personId}/photos${qs ? '?' + qs : ''}`);
}

export function tagPhotoWithPerson(photoId, personId) {
  return apiFetch(`/api/photos/${photoId}/people`, {
    method: 'POST',
    body: JSON.stringify({ person_id: personId }),
  });
}

export function untagPhotoPerson(photoId, personId) {
  return apiFetch(`/api/photos/${photoId}/people/${personId}`, { method: 'DELETE' });
}

export function mergePeople(sourceId, targetId) {
  return apiFetch(`/api/photos/people/${sourceId}/merge`, {
    method: 'POST',
    body: JSON.stringify({ merge_into_id: targetId }),
  });
}
