// Documents API service — wraps all documents endpoints + two-step upload

import { apiFetch } from '../../../shared/services/api-client.js';
import { getAccessToken } from '../../../shared/services/auth-store.js';

// --- Folders ---

export function getFolders(parentId = null) {
  const qs = parentId ? `?parent_id=${parentId}` : '';
  return apiFetch(`/api/documents/folders${qs}`);
}

export function createFolder(name, parentId = null) {
  return apiFetch('/api/documents/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parent_id: parentId }),
  });
}

export function updateFolder(id, data) {
  return apiFetch(`/api/documents/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteFolder(id) {
  return apiFetch(`/api/documents/folders/${id}`, { method: 'DELETE' });
}

export function reorderFolders(orderedIds) {
  return apiFetch('/api/documents/folders/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

export function getFolderPath(folderId) {
  return apiFetch(`/api/documents/folders/${folderId}/path`);
}

// --- Documents ---

export function getDocuments(params = {}) {
  const query = new URLSearchParams();
  if (params.folder_id) query.set('folder_id', params.folder_id);
  if (params.tag) query.set('tag', params.tag);
  const qs = query.toString();
  return apiFetch(`/api/documents/documents${qs ? '?' + qs : ''}`);
}

export function getDocument(id) {
  return apiFetch(`/api/documents/documents/${id}`);
}

export function updateDocument(id, data) {
  return apiFetch(`/api/documents/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteDocument(id) {
  return apiFetch(`/api/documents/documents/${id}`, { method: 'DELETE' });
}

/**
 * Two-step upload: (1) upload file to attachments service, (2) create document record.
 * Returns the created document.
 * onProgress(percent) called during upload.
 */
export async function uploadDocument({ file, name, folderId, description, onProgress }) {
  // Step 1: Upload to attachments service
  const formData = new FormData();
  formData.append('file', file);

  const attachment = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments/upload');

    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 80)); // 80% for upload phase
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.send(formData);
  });

  if (onProgress) onProgress(90);

  // Step 2: Create document record
  const doc = await apiFetch('/api/documents/documents', {
    method: 'POST',
    body: JSON.stringify({
      attachment_id: attachment.id,
      name: name || file.name,
      folder_id: folderId || null,
      description: description || null,
      file_size: attachment.file_size || file.size,
      content_type: attachment.content_type || file.type,
    }),
  });

  if (onProgress) onProgress(100);
  return doc;
}

// --- Tags ---

export function getTags() {
  return apiFetch('/api/documents/tags');
}

export function addTag(documentId, name) {
  return apiFetch(`/api/documents/documents/${documentId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTag(documentId, tagId) {
  return apiFetch(`/api/documents/documents/${documentId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

// --- Sharing ---

export function getShares() {
  return apiFetch('/api/documents/shares');
}

export function createShare(data) {
  return apiFetch('/api/documents/shares', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function revokeShare(shareId) {
  return apiFetch(`/api/documents/shares/${shareId}`, { method: 'DELETE' });
}

export function getSharedWithMe() {
  return apiFetch('/api/documents/shared-with-me');
}

// --- Favourites ---

export function favouriteDocument(documentId) {
  return apiFetch(`/api/documents/documents/${documentId}/favourite`, { method: 'POST' });
}

export function unfavouriteDocument(documentId) {
  return apiFetch(`/api/documents/documents/${documentId}/favourite`, { method: 'DELETE' });
}

export function getFavourites() {
  return apiFetch('/api/documents/favourites');
}

// --- Recent ---

export function getRecentDocuments(limit = 20) {
  return apiFetch(`/api/documents/recent?limit=${limit}`);
}

// --- Comments ---

export function getComments(documentId) {
  return apiFetch(`/api/documents/documents/${documentId}/comments`);
}

export function createComment(documentId, content) {
  return apiFetch(`/api/documents/documents/${documentId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function updateComment(commentId, content) {
  return apiFetch(`/api/documents/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(commentId) {
  return apiFetch(`/api/documents/comments/${commentId}`, { method: 'DELETE' });
}

// --- Attachment download helper ---

export function getDownloadUrl(attachmentId) {
  return `/api/attachments/${attachmentId}/download`;
}
