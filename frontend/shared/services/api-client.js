// API client — HTTP client with auth token injection
// Implementation will be added in Phase 1 (Auth + Todos)

export const API_BASE_URL = 'http://localhost:8000';

export async function apiFetch(path, options = {}) {
  // TODO: Inject auth token from auth-store
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
