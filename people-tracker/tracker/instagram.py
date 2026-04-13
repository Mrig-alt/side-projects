"""
Instagram scraper using Playwright with a persistent browser session.

Strategy:
  1. Navigate to the profile page.
  2. Intercept Instagram's internal GraphQL/API responses to get post data
     (more reliable than parsing the obfuscated DOM).
  3. Fall back to extracting /p/ links from the DOM if API interception yields nothing.

Usage:
  1. Run `tracker login instagram` once to authenticate.
  2. After that, `tracker fetch` scrapes headlessly using the saved session.
"""

import re
from pathlib import Path

from playwright.sync_api import sync_playwright

SESSION_DIR = Path.home() / ".people-tracker" / "sessions" / "instagram"

_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def login():
    """Open a real browser window so you can log in manually, then saves the session."""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(SESSION_DIR),
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
            user_agent=_USER_AGENT,
        )
        page = ctx.new_page()
        page.goto("https://www.instagram.com/accounts/login/")
        print("\nLog in to Instagram in the browser window.")
        print("Press Enter here after you can see your Instagram feed...")
        input()
        ctx.close()


def fetch_posts(username: str, limit: int = 10) -> list[dict]:
    """
    Fetch recent posts for an Instagram username.
    Returns a list of dicts with keys: post_id, platform, content, url, posted_at.
    Raises RuntimeError if not logged in.
    """
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    captured_responses: list[dict] = []

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(SESSION_DIR),
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
            user_agent=_USER_AGENT,
        )
        page = ctx.new_page()

        def _on_response(response):
            url = response.url
            if response.status != 200:
                return
            if "graphql/query" in url or "/api/v1/feed/user" in url or "timeline_media" in url:
                try:
                    captured_responses.append(response.json())
                except Exception:
                    pass

        page.on("response", _on_response)

        try:
            page.goto(
                f"https://www.instagram.com/{username}/",
                wait_until="domcontentloaded",
                timeout=30_000,
            )

            if "/accounts/login" in page.url:
                raise RuntimeError(
                    "Not logged in to Instagram. Run: tracker login instagram"
                )

            # Wait for the network to settle so API calls are captured
            try:
                page.wait_for_load_state("networkidle", timeout=12_000)
            except Exception:
                pass

            posts: list[dict] = []

            # Try API responses first
            for data in captured_responses:
                posts.extend(_extract_from_api(data))
                if len(posts) >= limit:
                    break

            # Deduplicate
            seen_ids: set[str] = set()
            unique: list[dict] = []
            for p_ in posts:
                if p_["post_id"] not in seen_ids:
                    seen_ids.add(p_["post_id"])
                    unique.append(p_)

            posts = unique[:limit]

            # Fallback: extract shortcodes from post grid links
            if not posts:
                posts = _extract_from_dom(page, limit)

            return posts
        finally:
            ctx.close()


def _extract_from_api(data: dict) -> list[dict]:
    posts: list[dict] = []

    # Shape 1: GraphQL edge_owner_to_timeline_media
    try:
        edges = (
            data.get("data", {})
            .get("user", {})
            .get("edge_owner_to_timeline_media", {})
            .get("edges", [])
        )
        for edge in edges:
            node = edge.get("node", {})
            shortcode = node.get("shortcode")
            if not shortcode:
                continue
            caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
            caption = caption_edges[0]["node"]["text"] if caption_edges else ""
            taken_at = node.get("taken_at_timestamp")
            posts.append(
                {
                    "post_id": f"ig_{shortcode}",
                    "platform": "instagram",
                    "content": caption,
                    "url": f"https://www.instagram.com/p/{shortcode}/",
                    "posted_at": str(taken_at) if taken_at else None,
                }
            )
    except Exception:
        pass

    if posts:
        return posts

    # Shape 2: API v1 /feed/user items list
    try:
        items = data.get("items", [])
        for item in items:
            pk = str(item.get("pk") or item.get("id") or "")
            if not pk:
                continue
            caption_obj = item.get("caption") or {}
            text = caption_obj.get("text", "") if isinstance(caption_obj, dict) else ""
            taken_at = item.get("taken_at")
            code = item.get("code", "")
            posts.append(
                {
                    "post_id": f"ig_{pk}",
                    "platform": "instagram",
                    "content": text,
                    "url": f"https://www.instagram.com/p/{code}/" if code else "",
                    "posted_at": str(taken_at) if taken_at else None,
                }
            )
    except Exception:
        pass

    return posts


def _extract_from_dom(page, limit: int) -> list[dict]:
    """Last-resort: pull /p/ shortcodes from the profile grid."""
    posts: list[dict] = []
    seen: set[str] = set()
    try:
        links = page.query_selector_all("a[href*='/p/']")
        for link in links:
            href = link.get_attribute("href") or ""
            m = re.search(r"/p/([^/]+)/", href)
            if m and m.group(1) not in seen:
                shortcode = m.group(1)
                seen.add(shortcode)
                posts.append(
                    {
                        "post_id": f"ig_{shortcode}",
                        "platform": "instagram",
                        "content": "",
                        "url": f"https://www.instagram.com/p/{shortcode}/",
                        "posted_at": None,
                    }
                )
            if len(posts) >= limit:
                break
    except Exception:
        pass
    return posts
