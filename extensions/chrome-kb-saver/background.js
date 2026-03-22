'use strict';

const API_BASE = 'http://localhost:3001';

// ── Notification helper ──────────────────────────────────────────────────────

function notify(title, message, success = true) {
  // System notification
  chrome.notifications.create('pos-kb-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
  // Badge as fallback
  chrome.action.setBadgeText({ text: success ? '✓' : '!' });
  chrome.action.setBadgeBackgroundColor({ color: success ? '#16a34a' : '#dc2626' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

// ── Context menu setup ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-kb',
    title: 'Save to pOS Knowledge Base',
    contexts: ['page', 'link'],
  });
});

// ── Context menu click handler ──────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-kb') return;

  // Determine URL to save — link URL if right-clicked on a link, otherwise page URL
  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  // Get stored token, refresh if needed
  let { pos_token: token } = await chrome.storage.local.get(['pos_token']);
  if (!token) {
    token = await bgTryRefresh();
    if (!token) {
      notify('Sign in required', 'Open the extension popup to sign in to pOS.', false);
      return;
    }
  }

  // Extract metadata from the page (only if saving the current page, not a link)
  let metadata = { url };
  if (!info.linkUrl && tab?.id) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageMetadata,
      });
      if (results?.[0]?.result) {
        metadata = results[0].result;
      }
    } catch {
      // Can't extract metadata (e.g. chrome:// page) — just save with URL
    }
  }

  // Save to KB
  try {
    const res = await fetch(`${API_BASE}/api/kb/items/save-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: metadata.url,
        title: metadata.title || undefined,
        description: metadata.description || undefined,
        image: metadata.image || undefined,
        author: metadata.author || undefined,
        site_name: metadata.site_name || undefined,
        item_type: metadata.item_type || 'url',
      }),
    });

    if (res.ok) {
      const title = metadata.title || url;
      notify('Saved to Knowledge Base', title.slice(0, 80));
    } else if (res.status === 401) {
      // Try refresh
      const newToken = await bgTryRefresh();
      if (newToken) {
        // Retry with new token
        const retry = await fetch(`${API_BASE}/api/kb/items/save-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` },
          body: JSON.stringify({
            url: metadata.url, title: metadata.title || undefined,
            description: metadata.description || undefined, image: metadata.image || undefined,
            author: metadata.author || undefined, site_name: metadata.site_name || undefined,
            item_type: metadata.item_type || 'url',
          }),
        });
        if (retry.ok) {
          notify('Saved to Knowledge Base', (metadata.title || url).slice(0, 80));
        } else {
          notify('Save failed', `Could not save — server returned ${retry.status}.`, false);
        }
      } else {
        await chrome.storage.local.remove(['pos_token', 'pos_refresh_token']);
        notify('Sign in required', 'Open the extension popup to sign in to pOS.', false);
      }
    } else {
      notify('Save failed', `Could not save — server returned ${res.status}.`, false);
    }
  } catch {
    notify('Save failed', 'Could not connect to pOS. Is the server running?', false);
  }
});

// ── Metadata extraction (same as popup.js, must be self-contained) ──────────

function extractPageMetadata() {
  function getMeta(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('content') || el.getAttribute('href') || el.textContent;
        if (val && val.trim()) return val.trim();
      }
    }
    return null;
  }

  const url = window.location.href;
  const hostname = window.location.hostname.replace(/^www\./, '');

  const title = getMeta([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ]) || document.title || '';

  const description = getMeta([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]) || '';

  const image = getMeta([
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]) || '';

  const siteName = getMeta([
    'meta[property="og:site_name"]',
  ]) || hostname;

  const author = getMeta([
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
  ]) || '';

  const ogType = getMeta(['meta[property="og:type"]']) || '';

  const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com'];
  const podcastDomains = ['podcasts.apple.com', 'open.spotify.com', 'overcast.fm', 'pocketcasts.com'];

  return { url, title, description, image, site_name: siteName, author, item_type: 'url' };
}

// ── Token refresh helper ──────────────────────────────────────────────────

async function bgTryRefresh() {
  try {
    const { pos_refresh_token: refreshToken } = await chrome.storage.local.get(['pos_refresh_token']);
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    await chrome.storage.local.set({
      pos_token: data.access_token,
      ...(data.refresh_token ? { pos_refresh_token: data.refresh_token } : {}),
    });
    return data.access_token;
  } catch {
    return null;
  }
}
