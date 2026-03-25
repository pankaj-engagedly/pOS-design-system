"""Feed parsing — RSS/Atom/YouTube via feedparser."""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from time import mktime

import feedparser
import httpx
from loguru import logger


@dataclass
class ParsedFeed:
    title: str = ""
    url: str = ""
    site_url: str = ""
    feed_type: str = "rss"
    icon_url: str = ""
    items: list = None

    def __post_init__(self):
        if self.items is None:
            self.items = []


@dataclass
class ParsedFeedItem:
    guid: str = ""
    title: str = ""
    url: str = ""
    author: str = ""
    summary: str = ""
    content_html: str = ""
    thumbnail_url: str = ""
    published_at: datetime | None = None


async def discover_feed(url: str) -> ParsedFeed:
    """Discover and parse a feed URL. Also handles YouTube channel URLs."""
    feed_url = await _resolve_feed_url(url)
    return await parse_feed(feed_url)


async def parse_feed(url: str) -> ParsedFeed:
    """Parse a feed URL and return structured data."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers={"User-Agent": "pOS/1.0 (Feed Reader)"})
            resp.raise_for_status()
            content = resp.text
    except Exception as e:
        logger.error(f"Failed to fetch feed {url}: {e}")
        raise ValueError(f"Could not fetch feed: {e}")

    d = feedparser.parse(content)

    if d.bozo and not d.entries:
        raise ValueError(f"Invalid feed: {d.bozo_exception}")

    feed_type = "rss"
    if hasattr(d, "version") and d.version:
        if "atom" in d.version.lower():
            feed_type = "atom"

    # Detect YouTube
    if "youtube.com" in url:
        feed_type = "youtube"

    # Extract icon/artwork — prefer itunes:image (high-res podcast art),
    # fall back to standard RSS <image> element
    icon_url = ""
    itunes_img = d.feed.get("itunes_image")
    if itunes_img:
        icon_url = itunes_img.get("href", "") if isinstance(itunes_img, dict) else str(itunes_img)
    if not icon_url and hasattr(d.feed, "image"):
        icon_url = d.feed.get("image", {}).get("href", "")

    parsed = ParsedFeed(
        title=d.feed.get("title", ""),
        url=url,
        site_url=d.feed.get("link", ""),
        feed_type=feed_type,
        icon_url=icon_url,
    )

    for entry in d.entries:
        item = _parse_entry(entry)
        parsed.items.append(item)

    return parsed


async def _resolve_feed_url(url: str) -> str:
    """Resolve a URL to an actual feed URL (handles YouTube channels, HTML pages with feed links)."""
    # YouTube channel URL → RSS feed
    yt_channel = re.match(r"https?://(?:www\.)?youtube\.com/channel/([\w-]+)", url)
    if yt_channel:
        channel_id = yt_channel.group(1)
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        # Verify feed is accessible before returning
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(feed_url, headers={"User-Agent": "pOS/1.0 (Feed Reader)"})
                if resp.status_code == 200:
                    return feed_url
                raise ValueError(
                    "YouTube RSS feeds are currently unavailable. Try again later."
                )
        except ValueError:
            raise
        except Exception:
            return feed_url  # try anyway

    yt_user = re.match(r"https?://(?:www\.)?youtube\.com/@([\w.-]+)", url)
    if yt_user:
        # Need to discover channel_id from the page
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                })
                # Prefer the RSS link tag (most reliable)
                rss_match = re.search(
                    r'<link[^>]*type="application/rss\+xml"[^>]*href="([^"]+)"', resp.text
                )
                if rss_match:
                    feed_url = rss_match.group(1)
                    # Verify the feed is actually accessible
                    feed_resp = await client.get(feed_url, headers={"User-Agent": "pOS/1.0 (Feed Reader)"})
                    if feed_resp.status_code == 200:
                        return feed_url
                    logger.warning(f"YouTube RSS feed returned {feed_resp.status_code} for {feed_url}")
                    raise ValueError(
                        "YouTube RSS feeds are currently unavailable. "
                        "Try subscribing with the channel's RSS URL directly if available, "
                        "or try again later."
                    )
                # Fallback: extract externalId
                ext_match = re.search(r'"externalId":"([\w-]+)"', resp.text)
                if ext_match:
                    return f"https://www.youtube.com/feeds/videos.xml?channel_id={ext_match.group(1)}"
        except ValueError:
            raise
        except Exception:
            pass
        raise ValueError(f"Could not discover feed for YouTube channel: {url}")

    # Try the URL directly — if it's already a feed, feedparser will handle it
    # If it's HTML, try to find <link rel="alternate" type="application/rss+xml">
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "pOS/1.0"})
            content_type = resp.headers.get("content-type", "")

            if "xml" in content_type or "rss" in content_type or "atom" in content_type:
                return url

            if "html" in content_type:
                # Look for feed link in HTML
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(resp.text, "lxml")
                feed_link = soup.find("link", attrs={
                    "rel": "alternate",
                    "type": re.compile(r"application/(rss|atom)\+xml"),
                })
                if feed_link and feed_link.get("href"):
                    href = feed_link["href"]
                    if href.startswith("/"):
                        from urllib.parse import urljoin
                        href = urljoin(url, href)
                    return href
    except Exception:
        pass

    # Fall back to trying the URL directly
    return url


def _parse_entry(entry) -> ParsedFeedItem:
    """Parse a single feedparser entry."""
    # GUID
    guid = entry.get("id", entry.get("link", entry.get("title", "")))

    # Published date
    published_at = None
    time_struct = entry.get("published_parsed") or entry.get("updated_parsed")
    if time_struct:
        try:
            published_at = datetime.fromtimestamp(mktime(time_struct), tz=timezone.utc)
        except (ValueError, OverflowError):
            pass

    # Content
    content_html = ""
    if entry.get("content"):
        content_html = entry.content[0].get("value", "")
    elif entry.get("summary_detail", {}).get("type") == "text/html":
        content_html = entry.get("summary", "")

    # Summary — plain text
    summary = entry.get("summary", "")
    if len(summary) > 500:
        summary = summary[:497] + "..."

    # Thumbnail
    thumbnail_url = ""
    if entry.get("media_thumbnail"):
        thumbnail_url = entry.media_thumbnail[0].get("url", "")
    elif entry.get("media_content"):
        for mc in entry.media_content:
            if mc.get("medium") == "image" or (mc.get("type", "").startswith("image/")):
                thumbnail_url = mc.get("url", "")
                break

    # URL — prefer link, fall back to audio/video enclosure
    url = entry.get("link", "")
    if not url:
        for enc in entry.get("enclosures", []):
            if enc.get("href"):
                url = enc["href"]
                break
    # Also extract audio enclosure even if link exists (for podcasts)
    enclosure_url = ""
    for enc in entry.get("enclosures", []):
        enc_type = enc.get("type", "")
        if enc_type.startswith("audio/") or enc.get("href", "").split("?")[0].endswith((".mp3", ".m4a", ".ogg", ".aac")):
            enclosure_url = enc.get("href", "")
            break

    return ParsedFeedItem(
        guid=guid,
        title=entry.get("title", ""),
        url=enclosure_url or url,
        author=entry.get("author", ""),
        summary=summary,
        content_html=content_html,
        thumbnail_url=thumbnail_url,
        published_at=published_at,
    )
