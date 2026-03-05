// Auth store — Token management, login state, session refresh
// Implementation will be added in Phase 1 (Auth + Todos)

let accessToken = null;
let user = null;

export function getAccessToken() {
  return accessToken;
}

export function getUser() {
  return user;
}

export function isAuthenticated() {
  return accessToken !== null;
}

export function setAuth(token, userData) {
  accessToken = token;
  user = userData;
}

export function clearAuth() {
  accessToken = null;
  user = null;
}
