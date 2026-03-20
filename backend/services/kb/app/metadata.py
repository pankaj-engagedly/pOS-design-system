"""URL metadata extraction — OpenGraph, meta tags, oEmbed."""

import re
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup
from loguru import logger


@dataclass
class URLMetadata:
    title: str = ""
    description: str = ""
    image: str = ""
    author: str = ""
    site_name: str = ""
    item_type: str = "article"
    word_count: int | None = None
    reading_time_min: int | None = None
    published_at: str | None = None


async def extract_metadata(url: str) -> URLMetadata:
    """Fetch URL and extract metadata from HTML meta/OG tags."""
    meta = URLMetadata()

    try:
        # Detect YouTube URLs — use oEmbed
        youtube_match = re.match(
            r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]+)",
            url,
        )
        if youtube_match:
            return await _extract_youtube(url, youtube_match.group(1))

        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "pOS/1.0 (Knowledge Base)"})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # OpenGraph tags
        meta.title = _og(soup, "og:title") or _meta(soup, "title") or _tag_text(soup, "title") or ""
        meta.description = _og(soup, "og:description") or _meta(soup, "description") or ""
        meta.image = _og(soup, "og:image") or ""
        meta.site_name = _og(soup, "og:site_name") or ""
        meta.author = (
            _meta(soup, "author")
            or _og(soup, "article:author")
            or _tag_text(soup, '[rel="author"]')
            or ""
        )

        # Detect type
        og_type = _og(soup, "og:type") or ""
        if "video" in og_type:
            meta.item_type = "video"
        elif "music" in og_type or "audio" in og_type:
            meta.item_type = "podcast"

        # Published date
        meta.published_at = (
            _og(soup, "article:published_time")
            or _meta(soup, "date")
            or _meta(soup, "pubdate")
        )

        # Word count / reading time from body text
        body = soup.find("article") or soup.find("main") or soup.find("body")
        if body:
            text = body.get_text(separator=" ", strip=True)
            words = len(text.split())
            if words > 50:
                meta.word_count = words
                meta.reading_time_min = max(1, words // 200)

    except Exception as e:
        logger.warning(f"Metadata extraction failed for {url}: {e}")

    return meta


async def _extract_youtube(url: str, video_id: str) -> URLMetadata:
    """Extract YouTube metadata via oEmbed."""
    meta = URLMetadata(item_type="video", site_name="YouTube")
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(oembed_url)
            resp.raise_for_status()
            data = resp.json()

        meta.title = data.get("title", "")
        meta.author = data.get("author_name", "")
        meta.image = data.get("thumbnail_url", "")
    except Exception as e:
        logger.warning(f"YouTube oEmbed failed for {url}: {e}")

    return meta


def _og(soup: BeautifulSoup, prop: str) -> str | None:
    """Get OpenGraph meta content."""
    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
    return tag.get("content", "").strip() if tag else None


def _meta(soup: BeautifulSoup, name: str) -> str | None:
    """Get meta tag content by name."""
    tag = soup.find("meta", attrs={"name": name})
    return tag.get("content", "").strip() if tag else None


def _tag_text(soup: BeautifulSoup, selector: str) -> str | None:
    """Get text content of first matching element."""
    tag = soup.find(selector) if not selector.startswith("[") else soup.select_one(selector)
    return tag.get_text(strip=True) if tag else None
