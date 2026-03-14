// API client — HTTP client with auth token injection and auto-refresh

import { getAccessToken, refreshAccessToken, logout } from './auth-store.js';
import { navigate } from './router.js';

export const API_BASE_URL = '';

export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // On 401, try refreshing the token once
  if (response.status === 401 && token) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
    } catch {
      await logout();
      navigate('#/login');
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.detail || `API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}
