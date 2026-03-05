// Hash-based client-side router

import { emit } from './event-bus.js';

const routes = new Map();
let currentRoute = null;

export function registerRoute(path, config) {
  routes.set(path, config);
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

export function getRouteConfig(path) {
  return routes.get(path) || null;
}

export function getAllRoutes() {
  return [...routes.entries()].map(([path, config]) => ({ path, ...config }));
}

function handleHashChange() {
  const hash = window.location.hash.slice(1) || '/todos';
  const config = routes.get(hash);

  const previous = currentRoute;
  currentRoute = {
    path: hash,
    config: config || null,
    found: !!config,
  };

  emit('route:changed', {
    path: hash,
    config,
    found: !!config,
    previous: previous?.path || null,
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleHashChange);
  // Trigger initial route
  handleHashChange();
}

// Register all app routes
registerRoute('/todos', { module: 'todos', label: 'Todos', icon: 'check-square' });
registerRoute('/notes', { module: 'notes', label: 'Notes', icon: 'file-text' });
registerRoute('/knowledge-base', { module: 'knowledge-base', label: 'Knowledge Base', icon: 'book-open' });
registerRoute('/vault', { module: 'vault', label: 'Vault', icon: 'lock' });
registerRoute('/feeds', { module: 'feed-watcher', label: 'Feeds', icon: 'rss' });
registerRoute('/documents', { module: 'documents', label: 'Documents', icon: 'folder' });
registerRoute('/photos', { module: 'photos', label: 'Photos', icon: 'image' });
registerRoute('/settings', { module: 'settings', label: 'Settings', icon: 'settings' });
