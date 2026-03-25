'use strict';

const API_BASE = 'http://localhost:3001';

// ── DOM refs ────────────────────────────────────────────────────────────────

const views = {
  loading: document.getElementById('view-loading'),
  login:   document.getElementById('view-login'),
  save:    document.getElementById('view-save'),
};

const els = {
  // header
  btnLogout:     document.getElementById('btn-logout'),

  // login
  inputEmail:    document.getElementById('input-email'),
  inputPassword: document.getElementById('input-password'),
  btnLogin:      document.getElementById('btn-login'),
  btnLoginLabel: document.getElementById('btn-login-label'),
  loginError:    document.getElementById('login-error'),

  // save — preview
  previewImg:         document.getElementById('preview-img'),
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewBadge:       document.getElementById('preview-badge'),

  // save — info
  infoSkeleton:  document.getElementById('info-skeleton'),
  infoContent:   document.getElementById('info-content'),
  pageSite:      document.getElementById('page-site'),
  pageTitle:     document.getElementById('page-title'),
  pageDesc:      document.getElementById('page-description'),
  pageAuthor:    document.getElementById('page-author'),

  // save — organize
  organizeSection:  document.getElementById('organize-section'),
  tagInputWrap:     document.getElementById('tag-input-wrap'),
  tagInput:         document.getElementById('tag-input'),
  tagSuggestions:   document.getElementById('tag-suggestions'),
  collectionSelect: document.getElementById('collection-select'),

  // save — saved state
  savedState:    document.getElementById('saved-state'),
  savedSubtitle: document.getElementById('saved-subtitle'),

  // save — action
  saveActions:   document.getElementById('save-actions'),
  btnSave:       document.getElementById('btn-save'),
  btnSaveLabel:  document.getElementById('btn-save-label'),
  saveError:     document.getElementById('save-error'),
};

// ── State ───────────────────────────────────────────────────────────────────

let state = {
  token:       null,
  metadata:    null,
  saving:      false,
  saved:       false,
  tags:        [],        // tags to add after save (strings)
  allTags:     [],        // fetched from API { id, name, count }
  collections: [],        // fetched from API { id, name }
  selectedCollectionId: null,
};

// ── View helpers ─────────────────────────────────────────────────────────────

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

function showLoginError(msg) {
  els.loginError.textContent = msg;
  els.loginError.classList.add('visible');
}

function hideLoginError() {
  els.loginError.classList.remove('visible');
}

function showSaveError(msg) {
  els.saveError.textContent = msg;
  els.saveError.classList.remove('hidden');
}

function hideSaveError() {
  els.saveError.classList.add('hidden');
}

function setLoginLoading(loading) {
  els.btnLogin.disabled = loading;
  els.btnLoginLabel.textContent = loading ? 'Signing in…' : 'Sign in';
  if (loading) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.id = 'login-spinner';
    els.btnLogin.prepend(spinner);
  } else {
    const s = document.getElementById('login-spinner');
    if (s) s.remove();
  }
}

function setSaveLoading(loading) {
  state.saving = loading;
  els.btnSave.disabled = loading;
  els.btnSaveLabel.textContent = loading ? 'Saving…' : 'Save to KB';
  const existing = document.getElementById('save-spinner');
  if (loading && !existing) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.id = 'save-spinner';
    els.btnSave.prepend(spinner);
  } else if (!loading && existing) {
    existing.remove();
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pos_token'], (result) => {
      resolve(result.pos_token || null);
    });
  });
}

async function storeToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pos_token: token }, resolve);
  });
}

async function clearToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['pos_token', 'pos_refresh_token'], resolve);
  });
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail || (res.status === 401 ? 'Invalid email or password.' : `Login failed (${res.status}).`);
    throw new Error(msg);
  }

  const data = await res.json();
  // Store refresh token alongside access token
  if (data.refresh_token) {
    await new Promise(r => chrome.storage.local.set({ pos_refresh_token: data.refresh_token }, r));
  }
  return data.access_token;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  });

  // On 401, try refreshing the token once
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      state.token = newToken;
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          ...(options.headers || {}),
        },
      });
    } else {
      await clearToken();
      state.token = null;
      showView('login');
      els.btnLogout.classList.add('hidden');
      showLoginError('Session expired. Please sign in again.');
      throw new Error('Session expired');
    }
  }
  return res;
}

// Mutex: prevent parallel refresh attempts (race causes token revocation)
let _refreshPromise = null;

async function tryRefreshToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
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
      await storeToken(data.access_token);
      if (data.refresh_token) {
        await new Promise(r => chrome.storage.local.set({ pos_refresh_token: data.refresh_token }, r));
      }
      return data.access_token;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

async function fetchTagsAndCollections() {
  try {
    const [tagsRes, collectionsRes] = await Promise.all([
      apiFetch('/api/kb/tags'),
      apiFetch('/api/kb/collections'),
    ]);
    if (tagsRes.ok) state.allTags = await tagsRes.json();
    if (collectionsRes.ok) state.collections = await collectionsRes.json();
  } catch {
    // Non-critical — tags/collections just won't show suggestions
  }
}

// ── Metadata extraction ──────────────────────────────────────────────────────

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

  const url      = window.location.href;
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

  const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com', 'wistia.com'];
  const podcastDomains = ['podcasts.apple.com', 'open.spotify.com', 'overcast.fm', 'pocketcasts.com', 'podcastaddict.com', 'castbox.fm', 'stitcher.com', 'transistor.fm', 'anchor.fm'];

  const faviconEl = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="shortcut icon"]');
  const favicon = faviconEl ? new URL(faviconEl.getAttribute('href'), window.location.origin).href : `https://www.google.com/s2/favicons?domain=${hostname}`;

  return { url, title, description, image, site_name: siteName, author, item_type: 'url', favicon };
}

async function fetchMetadataFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) throw new Error('No active tab found.');

  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
    throw new Error('Cannot save this type of page.');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageMetadata,
  });

  const result = results?.[0]?.result;
  if (!result) throw new Error('Could not extract page metadata.');

  return result;
}

// ── Tags UI ──────────────────────────────────────────────────────────────────

function renderTagChips() {
  // Remove existing chips
  els.tagInputWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());

  // Add chips before the input
  state.tags.forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escHtml(tag)}<button class="tag-chip-remove" data-tag-idx="${idx}">&times;</button>`;
    els.tagInputWrap.insertBefore(chip, els.tagInput);
  });
}

function showTagSuggestions(query) {
  const q = query.toLowerCase();
  const existing = new Set(state.tags.map(t => t.toLowerCase()));
  const matches = state.allTags
    .filter(t => t.name.toLowerCase().includes(q) && !existing.has(t.name.toLowerCase()))
    .slice(0, 5);

  const exactMatch = state.allTags.some(t => t.name.toLowerCase() === q) || existing.has(q);

  let html = matches.map(t =>
    `<div class="tag-suggestion" data-tag-name="${escAttr(t.name)}">${escHtml(t.name)} <span style="color:var(--color-text-muted);font-size:11px">(${t.count})</span></div>`
  ).join('');

  // Show "Create" option if typed value doesn't exactly match an existing tag
  if (q.length > 0 && !exactMatch) {
    html += `<div class="tag-suggestion" data-tag-name="${escAttr(query)}" style="color:var(--color-accent);font-weight:500;">Create "${escHtml(query)}"</div>`;
  }

  if (!html) {
    els.tagSuggestions.classList.remove('visible');
    return;
  }

  els.tagSuggestions.innerHTML = html;
  els.tagSuggestions.classList.add('visible');
}

function addTag(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
  state.tags.push(trimmed);
  renderTagChips();
  els.tagInput.value = '';
  els.tagSuggestions.classList.remove('visible');
}

function removeTag(idx) {
  state.tags.splice(idx, 1);
  renderTagChips();
}

function populateCollections() {
  els.collectionSelect.innerHTML = '<option value="">None</option>';
  state.collections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    els.collectionSelect.appendChild(opt);
  });
}

// ── Save view population ─────────────────────────────────────────────────────

function populateSaveView(meta) {
  // Thumbnail
  if (meta.image) {
    els.previewImg.src = meta.image;
    els.previewImg.classList.remove('hidden');
    els.previewPlaceholder.classList.add('hidden');
    els.previewImg.onerror = () => {
      document.getElementById('page-preview').classList.add('hidden');
    };
  } else {
    document.getElementById('page-preview').classList.add('hidden');
  }

  // Type badge
  if (meta.item_type && meta.item_type !== 'article') {
    els.previewBadge.textContent = meta.item_type;
    els.previewBadge.classList.remove('hidden');
  }

  // Site name with favicon
  els.pageSite.innerHTML = '';
  if (meta.favicon) {
    const img = document.createElement('img');
    img.src = meta.favicon;
    img.className = 'page-favicon';
    img.onerror = () => img.remove();
    els.pageSite.appendChild(img);
  }
  const siteText = document.createTextNode(meta.site_name || '');
  els.pageSite.appendChild(siteText);

  // Title
  els.pageTitle.textContent = meta.title || 'Untitled';

  // Description
  if (meta.description) {
    els.pageDesc.textContent = meta.description;
  } else {
    els.pageDesc.classList.add('hidden');
  }

  // Author
  if (meta.author) {
    els.pageAuthor.textContent = `By ${meta.author}`;
    els.pageAuthor.classList.remove('hidden');
  }

  // Swap skeleton → content
  els.infoSkeleton.classList.add('hidden');
  els.infoContent.classList.remove('hidden');

  // Show organize section & populate collections
  els.organizeSection.classList.remove('hidden');
  populateCollections();

  // Enable save button
  els.btnSave.disabled = false;
}

// ── Save action ───────────────────────────────────────────────────────────────

async function saveToKB() {
  if (!state.token || !state.metadata || state.saving || state.saved) return;

  hideSaveError();
  setSaveLoading(true);

  const { url, title, description, image, site_name, author, item_type } = state.metadata;
  const selectedCollectionId = els.collectionSelect.value || null;

  try {
    // 1. Save the item
    const res = await apiFetch('/api/kb/items/save-url', {
      method: 'POST',
      body: JSON.stringify({
        url,
        title:       title       || undefined,
        description: description || undefined,
        image:       image       || undefined,
        author:      author      || undefined,
        site_name:   site_name   || undefined,
        item_type:   item_type   || 'url',
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Save failed (${res.status}).`);
    }

    const savedItem = await res.json();
    const itemId = savedItem.id;

    // 2. Add tags (fire and forget, don't block on errors)
    const tagPromises = state.tags.map(tagName =>
      apiFetch(`/api/kb/items/${itemId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ name: tagName }),
      }).catch(() => {})
    );

    // 3. Add to collection
    if (selectedCollectionId) {
      tagPromises.push(
        apiFetch(`/api/kb/collections/${selectedCollectionId}/items`, {
          method: 'POST',
          body: JSON.stringify({ kb_item_id: itemId }),
        }).catch(() => {})
      );
    }

    await Promise.all(tagPromises);

    // Success!
    state.saved = true;
    setSaveLoading(false);

    // Build subtitle
    let subtitle = title ? `"${title.slice(0, 50)}${title.length > 50 ? '…' : ''}"` : url;
    const extras = [];
    if (state.tags.length) extras.push(`${state.tags.length} tag${state.tags.length > 1 ? 's' : ''}`);
    if (selectedCollectionId) {
      const coll = state.collections.find(c => c.id === selectedCollectionId);
      if (coll) extras.push(`→ ${coll.name}`);
    }
    if (extras.length) subtitle += `\n${extras.join(' · ')}`;

    els.savedSubtitle.textContent = subtitle;
    document.getElementById('page-preview').classList.add('hidden');
    document.getElementById('page-info').classList.add('hidden');
    els.organizeSection.classList.add('hidden');
    els.savedState.classList.add('visible');
    els.saveActions.classList.add('hidden');

  } catch (err) {
    setSaveLoading(false);
    showSaveError(err.message || 'Failed to save. Please try again.');
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────

async function logout() {
  await clearToken();
  state.token = null;
  state.metadata = null;
  state.saved = false;
  state.tags = [];
  state.allTags = [];
  state.collections = [];
  els.btnLogout.classList.add('hidden');
  hideLoginError();
  showView('login');
}

// ── Initialisation ──────────────────────────────────────────────────────────

async function init() {
  const token = await getStoredToken();

  if (!token) {
    showView('login');
    return;
  }

  // Proactively refresh token — access tokens are short-lived (15 min)
  const freshToken = await tryRefreshToken();
  state.token = freshToken || token;
  if (freshToken) await storeToken(freshToken);

  els.btnLogout.classList.remove('hidden');
  showView('save');

  // Fetch metadata and tags/collections in parallel
  try {
    const [meta] = await Promise.all([
      fetchMetadataFromTab(),
      fetchTagsAndCollections(),
    ]);
    state.metadata = meta;
    populateSaveView(meta);
  } catch (err) {
    els.infoSkeleton.classList.add('hidden');
    els.infoContent.classList.remove('hidden');
    els.pageTitle.textContent = 'Could not extract page info';
    els.pageDesc.textContent = err.message;
    els.pageDesc.classList.remove('hidden');
    showSaveError(err.message);
  }
}

// ── Event listeners ─────────────────────────────────────────────────────────

els.btnLogin.addEventListener('click', async () => {
  const email    = els.inputEmail.value.trim();
  const password = els.inputPassword.value;

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  hideLoginError();
  setLoginLoading(true);

  try {
    const token = await login(email, password);
    await storeToken(token);
    state.token = token;
    setLoginLoading(false);
    els.btnLogout.classList.remove('hidden');

    // Reset save view
    els.infoSkeleton.classList.remove('hidden');
    els.infoContent.classList.add('hidden');
    els.previewImg.classList.add('hidden');
    els.previewPlaceholder.classList.remove('hidden');
    const pagePreview = document.getElementById('page-preview');
    if (pagePreview) pagePreview.classList.remove('hidden');
    els.previewBadge.classList.add('hidden');
    els.organizeSection.classList.add('hidden');
    els.btnSave.disabled = true;
    hideSaveError();
    state.saved = false;
    state.tags = [];
    document.getElementById('page-info').classList.remove('hidden');
    els.savedState.classList.remove('visible');
    els.saveActions.classList.remove('hidden');

    showView('save');

    try {
      const [meta] = await Promise.all([
        fetchMetadataFromTab(),
        fetchTagsAndCollections(),
      ]);
      state.metadata = meta;
      populateSaveView(meta);
    } catch (err) {
      els.infoSkeleton.classList.add('hidden');
      els.infoContent.classList.remove('hidden');
      els.pageTitle.textContent = 'Could not extract page info';
      els.pageDesc.textContent = err.message;
      els.pageDesc.classList.remove('hidden');
      showSaveError(err.message);
    }

  } catch (err) {
    setLoginLoading(false);
    showLoginError(err.message);
  }
});

// Enter key handlers
els.inputPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.btnLogin.click();
});

els.inputEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.inputPassword.focus();
});

// Tag input
els.tagInput.addEventListener('input', () => {
  const val = els.tagInput.value.trim();
  if (val.length > 0) {
    showTagSuggestions(val);
  } else {
    els.tagSuggestions.classList.remove('visible');
  }
});

els.tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(els.tagInput.value.replace(',', ''));
  }
  if (e.key === 'Backspace' && els.tagInput.value === '' && state.tags.length > 0) {
    removeTag(state.tags.length - 1);
  }
});

els.tagInput.addEventListener('blur', () => {
  // Small delay to allow click on suggestion
  setTimeout(() => els.tagSuggestions.classList.remove('visible'), 150);
});

// Click on tag input wrap focuses the input
els.tagInputWrap.addEventListener('click', () => els.tagInput.focus());

// Tag suggestion click
els.tagSuggestions.addEventListener('click', (e) => {
  const suggestion = e.target.closest('.tag-suggestion');
  if (suggestion) {
    addTag(suggestion.dataset.tagName);
  }
});

// Tag chip remove
els.tagInputWrap.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.tag-chip-remove');
  if (removeBtn) {
    e.stopPropagation();
    removeTag(parseInt(removeBtn.dataset.tagIdx));
  }
});

// Collection select
els.collectionSelect.addEventListener('change', () => {
  state.selectedCollectionId = els.collectionSelect.value || null;
});

// Save & logout
els.btnSave.addEventListener('click', saveToKB);
els.btnLogout.addEventListener('click', logout);

// ── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ────────────────────────────────────────────────────────────────────

init();
