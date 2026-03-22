// Notes API service — wraps all notes endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// --- Folders ---

export function getFolders() {
  return apiFetch('/api/notes/folders');
}

export function createFolder(name) {
  return apiFetch('/api/notes/folders', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateFolder(id, data) {
  return apiFetch(`/api/notes/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteFolder(id) {
  return apiFetch(`/api/notes/folders/${id}`, { method: 'DELETE' });
}

export function reorderFolders(orderedIds) {
  return apiFetch('/api/notes/folders/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

// --- Notes ---

export function getNotes(params = {}) {
  const query = new URLSearchParams();
  if (params.folder_id) query.set('folder_id', params.folder_id);
  if (params.tag) query.set('tag', params.tag);
  if (params.is_pinned != null) query.set('is_pinned', params.is_pinned);
  if (params.is_deleted != null) query.set('is_deleted', params.is_deleted);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch(`/api/notes/notes${qs ? '?' + qs : ''}`);
}

export function createNote(data) {
  return apiFetch('/api/notes/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getNote(id) {
  return apiFetch(`/api/notes/notes/${id}`);
}

export function updateNote(id, data) {
  return apiFetch(`/api/notes/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteNote(id) {
  return apiFetch(`/api/notes/notes/${id}`, { method: 'DELETE' });
}

export function permanentDeleteNote(id) {
  return apiFetch(`/api/notes/notes/${id}/permanent`, { method: 'DELETE' });
}

export function restoreNote(id) {
  return apiFetch(`/api/notes/notes/${id}/restore`, { method: 'POST' });
}

export function emptyTrash() {
  return apiFetch('/api/notes/notes/trash', { method: 'DELETE' });
}

export function reorderNotes(orderedIds) {
  return apiFetch('/api/notes/notes/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

export function searchNotes(query) {
  return apiFetch(`/api/notes/notes?search=${encodeURIComponent(query)}`);
}

// --- Tags ---

export function getTags() {
  return apiFetch('/api/notes/tags');
}

export function addTag(noteId, name) {
  return apiFetch(`/api/notes/notes/${noteId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(noteId, tagId) {
  return apiFetch(`/api/notes/notes/${noteId}/tags/${tagId}`, { method: 'DELETE' });
}
