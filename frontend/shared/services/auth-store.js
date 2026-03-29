// Auth store — Token management, login state, session refresh

import { emit } from './event-bus.js';

const API_BASE = '';
const REFRESH_TOKEN_KEY = 'pos_refresh_token';

let accessToken = null;
let user = null;
let refreshPromise = null;

export function getAccessToken() {
  return accessToken;
}

export function getUser() {
  return user;
}

export function isAuthenticated() {
  return accessToken !== null;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Invalid email or password');
  }

  const data = await res.json();
  _setTokens(data.access_token, data.refresh_token, data.user);
}

export async function register(name, email, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Registration failed');
  }

  const data = await res.json();
  _setTokens(data.access_token, data.refresh_token, data.user);
}

export async function logout() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    // Best-effort revoke
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore — token will expire naturally
    }
  }
  _clearTokens();
}

export async function refreshAccessToken() {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    _clearTokens();
    throw new Error('No refresh token');
  }

  refreshPromise = _doRefresh(refreshToken);

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function _doRefresh(refreshToken) {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    console.warn('[auth] Token refresh failed:', res.status, await res.text().catch(() => ''));
    _clearTokens();
    throw new Error('Token refresh failed');
  }

  const data = await res.json();
  accessToken = data.access_token;
  // Save new refresh token BEFORE returning — critical for rotation
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  _scheduleProactiveRefresh(); // reschedule with new token's expiry
  return data.access_token;
}

// Proactive refresh — schedule 2 minutes before actual JWT expiry
let _refreshTimer = null;
function _scheduleProactiveRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  if (!accessToken) return;

  // Decode exp from JWT payload (no verification needed, just reading the claim)
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const expiresAt = payload.exp * 1000; // seconds → ms
    const refreshAt = expiresAt - 2 * 60000; // 2 minutes before expiry
    const ms = Math.max(refreshAt - Date.now(), 10000); // at least 10s

    _refreshTimer = setTimeout(async () => {
      try {
        await refreshAccessToken();
        _scheduleProactiveRefresh(); // reschedule with new token
      } catch {
        // Silent — will prompt login on next API call
      }
    }, ms);
  } catch {
    // Malformed token — skip scheduling
  }
}

export async function tryRestoreSession() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    await refreshAccessToken();
    // Fetch user profile
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      user = await res.json();
      _scheduleProactiveRefresh();
      emit('auth:changed', { authenticated: true, user });
      return true;
    }
  } catch {
    // Silent fail — user will see login page
  }
  _clearTokens();
  return false;
}

function _setTokens(newAccessToken, refreshToken, userData) {
  accessToken = newAccessToken;
  user = userData;
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  _scheduleProactiveRefresh();
  emit('auth:changed', { authenticated: true, user });
}

function _clearTokens() {
  accessToken = null;
  user = null;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  emit('auth:changed', { authenticated: false, user: null });
}
