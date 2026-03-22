"""Google Photos Library API client — thin httpx wrapper.

Endpoints used:
- mediaItems.list (GET)
- mediaItems.get (GET)
- albums.list (GET)
- mediaItems.search (POST) — for album contents
- media download via baseUrl
"""

import asyncio

import httpx
from loguru import logger

API_BASE = "https://photoslibrary.googleapis.com/v1"

# Rate limit: max retries with exponential backoff
MAX_RETRIES = 3
BACKOFF_BASE = 1  # seconds


def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


async def _request_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Make an HTTP request with retry on 429 (rate limit)."""
    for attempt in range(MAX_RETRIES + 1):
        resp = await client.request(method, url, **kwargs)

        if resp.status_code != 429:
            return resp

        if attempt < MAX_RETRIES:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(f"Google API rate limited (429), retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
            await asyncio.sleep(wait)

    # Return the 429 response after all retries exhausted
    logger.error("Google API rate limit retries exhausted")
    return resp


async def list_media_items(
    access_token: str,
    page_token: str | None = None,
    page_size: int = 100,
) -> tuple[list[dict], str | None]:
    """List media items. Returns (items, nextPageToken)."""
    params = {"pageSize": page_size}
    if page_token:
        params["pageToken"] = page_token

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await _request_with_retry(
            client, "GET", f"{API_BASE}/mediaItems",
            headers=_auth_headers(access_token),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("mediaItems", []), data.get("nextPageToken")


async def get_media_item(access_token: str, item_id: str) -> dict:
    """Get a single media item (e.g. to refresh baseUrl)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await _request_with_retry(
            client, "GET", f"{API_BASE}/mediaItems/{item_id}",
            headers=_auth_headers(access_token),
        )
        resp.raise_for_status()
        return resp.json()


async def list_albums(
    access_token: str,
    page_token: str | None = None,
    page_size: int = 50,
) -> tuple[list[dict], str | None]:
    """List albums. Returns (albums, nextPageToken)."""
    params = {"pageSize": page_size}
    if page_token:
        params["pageToken"] = page_token

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await _request_with_retry(
            client, "GET", f"{API_BASE}/albums",
            headers=_auth_headers(access_token),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("albums", []), data.get("nextPageToken")


async def search_album_media(
    access_token: str,
    album_id: str,
    page_token: str | None = None,
    page_size: int = 100,
) -> tuple[list[dict], str | None]:
    """Search media items in a specific album. Returns (items, nextPageToken)."""
    body = {"albumId": album_id, "pageSize": page_size}
    if page_token:
        body["pageToken"] = page_token

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await _request_with_retry(
            client, "POST", f"{API_BASE}/mediaItems:search",
            headers=_auth_headers(access_token),
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("mediaItems", []), data.get("nextPageToken")


async def download_media_item(
    access_token: str,
    base_url: str,
    is_video: bool = False,
) -> bytes | None:
    """Download media content from baseUrl.

    Appends =d (photo) or =dv (video) suffix.
    Returns bytes or None if baseUrl expired (403).
    """
    suffix = "=dv" if is_video else "=d"
    url = f"{base_url}{suffix}"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(url)

        if resp.status_code == 403:
            # baseUrl expired
            logger.debug("Google baseUrl expired (403), needs refresh")
            return None

        resp.raise_for_status()
        return resp.content
