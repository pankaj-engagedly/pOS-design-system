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
  return [...routes.entries()]
    .filter(([, config]) => !config.hidden)
    .map(([path, config]) => ({ path, ...config }));
}

function handleHashChange() {
  const hash = window.location.hash.slice(1) || '/overview';
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
// Auth routes (hidden from nav)
registerRoute('/login', { module: 'auth', page: 'pos-auth-login', label: 'Login', hidden: true, public: true });
registerRoute('/register', { module: 'auth', page: 'pos-auth-register', label: 'Register', hidden: true, public: true });

// App routes
registerRoute('/overview', { module: 'overview', label: 'Overview', icon: 'home' });
registerRoute('/todos', { module: 'todos', label: 'Todos', icon: 'check-square' });
registerRoute('/notes', { module: 'notes', label: 'Notes', icon: 'file-text' });
registerRoute('/knowledge-base', { module: 'knowledge-base', label: 'Knowledge Base', icon: 'book-open' });
registerRoute('/vault', { module: 'vault', label: 'Vault', icon: 'lock' });
registerRoute('/feeds', { module: 'feed-watcher', label: 'Feeds', icon: 'rss', hidden: true });
registerRoute('/documents', { module: 'documents', label: 'Documents', icon: 'folder' });
registerRoute('/documents/shared', { module: 'documents', page: 'pos-documents-shared-app', label: 'Shared with Me', hidden: true });
registerRoute('/documents/recent', { module: 'documents', page: 'pos-documents-recent-app', label: 'Recent Documents', hidden: true });
registerRoute('/photos', { module: 'photos', label: 'Photos', icon: 'image' });
registerRoute('/watchlist', { module: 'watchlist', label: 'Watchlist', icon: 'trending-up' });
registerRoute('/portfolio', { module: 'portfolio', label: 'Portfolio', icon: 'briefcase' });
registerRoute('/settings', { module: 'settings', label: 'Settings', icon: 'settings' });
