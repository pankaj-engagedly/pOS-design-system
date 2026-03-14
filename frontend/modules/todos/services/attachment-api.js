// Attachment API service — file upload/download/metadata
// Uses raw fetch (not apiFetch) because file uploads need multipart/form-data

import { getAccessToken, refreshAccessToken, logout } from '../../../shared/services/auth-store.js';
import { navigate } from '../../../shared/services/router.js';

async function authFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(path, { ...options, headers });

  if (response.status === 401 && token) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(path, { ...options, headers });
    } catch {
      await logout();
      navigate('#/login');
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.detail || `Upload error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return authFetch('/api/attachments/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getMetadata(id) {
  return authFetch(`/api/attachments/${id}`);
}

export async function batchGetMetadata(ids) {
  if (!ids || ids.length === 0) return [];
  return authFetch('/api/attachments/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export function getDownloadUrl(id) {
  return `/api/attachments/${id}/download`;
}

export async function deleteAttachment(id) {
  return authFetch(`/api/attachments/${id}`, { method: 'DELETE' });
}
