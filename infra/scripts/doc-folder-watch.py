#!/usr/bin/env python3
"""
pOS Document Folder Watcher
============================
Watches a local folder and syncs files to the pOS Documents service.

Usage:
  python3 infra/scripts/doc-folder-watch.py /path/to/folder

  Options:
    --email    / -e   Login email (or set POS_EMAIL env var)
    --password / -p   Login password (or set POS_PASSWORD env var)
    --api-url         API base URL (default: http://localhost:3001)
    --interval        Poll interval in seconds (default: 5)
    --once            Sync once and exit (no watching)

Requires: watchdog, requests
  pip install watchdog requests

Sync state is stored in ~/.pos-doc-sync.json
"""

import argparse
import hashlib
import json
import os
import signal
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: 'requests' package required. Install with: pip install requests")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────────

STATE_FILE = Path.home() / ".pos-doc-sync.json"
IGNORE_PATTERNS = {".DS_Store", "Thumbs.db", ".gitkeep", "__pycache__", ".git"}
IGNORE_EXTENSIONS = {".tmp", ".swp", ".lock", ".part"}

# ── State persistence ───────────────────────────────────────────────────────

def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {"synced_files": {}, "folder_map": {}}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def file_hash(path):
    """Quick hash: size + mtime (fast) — not content hash for performance."""
    stat = path.stat()
    return f"{stat.st_size}:{stat.st_mtime_ns}"

# ── Auth ────────────────────────────────────────────────────────────────────

class PosClient:
    def __init__(self, api_url, email, password):
        self.api_url = api_url.rstrip("/")
        self.email = email
        self.password = password
        self.access_token = None
        self.refresh_token = None

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
        }

    def login(self):
        res = requests.post(f"{self.api_url}/api/auth/login", json={
            "email": self.email,
            "password": self.password,
        })
        res.raise_for_status()
        data = res.json()
        self.access_token = data["access_token"]
        self.refresh_token = data.get("refresh_token")
        print(f"  Authenticated as {self.email}")

    def _refresh(self):
        if not self.refresh_token:
            self.login()
            return
        res = requests.post(f"{self.api_url}/api/auth/refresh", json={
            "refresh_token": self.refresh_token,
        })
        if res.ok:
            data = res.json()
            self.access_token = data["access_token"]
            self.refresh_token = data.get("refresh_token", self.refresh_token)
        else:
            self.login()

    def _request(self, method, path, **kwargs):
        """Make authenticated request with auto-refresh on 401."""
        url = f"{self.api_url}{path}"
        res = requests.request(method, url, headers=self._headers(), **kwargs)
        if res.status_code == 401:
            self._refresh()
            res = requests.request(method, url, headers=self._headers(), **kwargs)
        return res

    def get(self, path, **kwargs):
        return self._request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self._request("POST", path, **kwargs)

    def get_or_create_folder(self, name, parent_id=None):
        """Find existing folder by name+parent, or create it."""
        params = {}
        if parent_id:
            params["parent_id"] = parent_id
        res = self.get("/api/documents/folders", params=params)
        res.raise_for_status()
        folders = res.json()

        for f in folders:
            if f["name"] == name:
                return f["id"]

        # Create
        payload = {"name": name}
        if parent_id:
            payload["parent_id"] = parent_id
        res = self.post("/api/documents/folders", json=payload)
        res.raise_for_status()
        return res.json()["id"]

    def upload_file(self, file_path, folder_id=None):
        """Upload file via attachments then create document record."""
        path = Path(file_path)

        # Step 1: Upload to attachments
        with open(path, "rb") as f:
            res = self._request("POST", "/api/attachments/upload",
                files={"file": (path.name, f)},
            )
        res.raise_for_status()
        attachment = res.json()

        # Step 2: Create document record
        payload = {
            "name": path.name,
            "attachment_id": attachment["id"],
            "content_type": attachment.get("content_type", ""),
            "file_size": attachment.get("file_size", 0),
        }
        if folder_id:
            payload["folder_id"] = folder_id

        res = self.post("/api/documents/documents", json=payload)
        res.raise_for_status()
        return res.json()

# ── Sync logic ──────────────────────────────────────────────────────────────

def should_ignore(path):
    """Check if file/dir should be ignored."""
    name = path.name
    if name.startswith("."):
        return True
    if name in IGNORE_PATTERNS:
        return True
    if path.is_file() and path.suffix.lower() in IGNORE_EXTENSIONS:
        return True
    return False


def scan_folder(root_path):
    """Return dict of relative_path → Path for all syncable files."""
    files = {}
    root = Path(root_path)
    for item in root.rglob("*"):
        if any(should_ignore(Path(p)) for p in item.relative_to(root).parts):
            continue
        if item.is_file():
            rel = str(item.relative_to(root))
            files[rel] = item
    return files


def sync_folder(client, watch_path, state):
    """One-shot sync: upload new/changed files, mirror folder structure."""
    root = Path(watch_path)
    root_key = str(root.resolve())

    synced = state.get("synced_files", {}).get(root_key, {})
    folder_cache = {}  # relative_dir_path → folder_id

    files = scan_folder(root)
    new_count = 0
    skip_count = 0

    for rel_path, abs_path in sorted(files.items()):
        current_hash = file_hash(abs_path)

        # Skip if unchanged
        if rel_path in synced and synced[rel_path] == current_hash:
            skip_count += 1
            continue

        # Ensure folder hierarchy exists
        rel_dir = str(Path(rel_path).parent)
        folder_id = None
        if rel_dir and rel_dir != ".":
            folder_id = _ensure_folders(client, rel_dir, folder_cache)

        # Upload
        try:
            doc = client.upload_file(abs_path, folder_id)
            synced[rel_path] = current_hash
            new_count += 1
            print(f"  ↑ {rel_path}")
        except Exception as e:
            print(f"  ✗ {rel_path}: {e}")

    # Persist state
    if "synced_files" not in state:
        state["synced_files"] = {}
    state["synced_files"][root_key] = synced
    save_state(state)

    return new_count, skip_count


def _ensure_folders(client, rel_dir, cache):
    """Create nested folder structure, returning the leaf folder ID."""
    if rel_dir in cache:
        return cache[rel_dir]

    parts = Path(rel_dir).parts
    parent_id = None
    built = ""

    for part in parts:
        built = str(Path(built) / part) if built else part
        if built in cache:
            parent_id = cache[built]
            continue
        parent_id = client.get_or_create_folder(part, parent_id)
        cache[built] = parent_id

    return parent_id

# ── Watch mode (using watchdog) ─────────────────────────────────────────────

def watch_folder(client, watch_path, state, interval):
    """Watch folder for changes using polling (no watchdog dependency needed)."""
    print(f"  Watching {watch_path} (poll every {interval}s, Ctrl+C to stop)")
    running = True

    def _stop(sig, frame):
        nonlocal running
        running = False
        print("\n  Stopping watcher...")

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    while running:
        try:
            new, skipped = sync_folder(client, watch_path, state)
            if new > 0:
                print(f"  Synced {new} file(s)")
        except Exception as e:
            print(f"  Sync error: {e}")
        time.sleep(interval)

    print("  Watcher stopped.")

# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="pOS Document Folder Watcher")
    parser.add_argument("folder", help="Local folder to sync")
    parser.add_argument("--email", "-e", default=os.environ.get("POS_EMAIL", ""),
                        help="Login email (or POS_EMAIL env var)")
    parser.add_argument("--password", "-p", default=os.environ.get("POS_PASSWORD", ""),
                        help="Login password (or POS_PASSWORD env var)")
    parser.add_argument("--api-url", default="http://localhost:3001",
                        help="API base URL (default: http://localhost:3001)")
    parser.add_argument("--interval", type=int, default=5,
                        help="Poll interval in seconds (default: 5)")
    parser.add_argument("--once", action="store_true",
                        help="Sync once and exit")

    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    if not folder.is_dir():
        print(f"Error: {folder} is not a directory")
        sys.exit(1)

    if not args.email or not args.password:
        print("Error: --email and --password required (or set POS_EMAIL / POS_PASSWORD)")
        sys.exit(1)

    print(f"pOS Document Folder Sync")
    print(f"  Folder: {folder}")
    print(f"  API:    {args.api_url}")

    client = PosClient(args.api_url, args.email, args.password)

    try:
        client.login()
    except Exception as e:
        print(f"  Login failed: {e}")
        sys.exit(1)

    state = load_state()

    new, skipped = sync_folder(client, folder, state)
    print(f"  Initial sync: {new} uploaded, {skipped} unchanged")

    if args.once:
        print("  Done.")
        return

    watch_folder(client, folder, state, args.interval)


if __name__ == "__main__":
    main()
