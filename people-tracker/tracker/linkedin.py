"""
LinkedIn scraper using Playwright with a persistent browser session.

Usage:
  1. Run `tracker login linkedin` once to authenticate in a real browser.
  2. After that, `tracker fetch` scrapes headlessly using the saved session.

LinkedIn's DOM changes often. The scraper tries multiple selector strategies
and falls back gracefully so partial results are still saved.
"""

import re
from pathlib import Path

from playwright.sync_api import sync_playwright

SESSION_DIR = Path.home() / ".people-tracker" / "sessions" / "linkedin"

_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Ordered list of selectors to try for post containers
_POST_CONTAINER_SELECTORS = [
    ".feed-shared-update-v2",
    ".occludable-update",
    "[data-urn*='activity']",
]

# Ordered list of selectors to try for post text
_TEXT_SELECTORS = [
    ".feed-shared-text",
    ".update-components-text",
    ".feed-shared-inline-show-more-text",
    ".break-words",
]


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
        page.goto("https://www.linkedin.com/login")
        print("\nLog in to LinkedIn in the browser window.")
        print("Press Enter here after you can see your LinkedIn feed...")
        input()
        ctx.close()


def fetch_posts(slug: str, limit: int = 10) -> list[dict]:
    """
    Fetch recent posts for a LinkedIn profile slug.
    Returns a list of dicts with keys: post_id, platform, content, url, posted_at.
    Raises RuntimeError if not logged in.
    """
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    posts = []

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(SESSION_DIR),
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
            user_agent=_USER_AGENT,
        )
        page = ctx.new_page()
        try:
            page.goto(
                f"https://www.linkedin.com/in/{slug}/recent-activity/shares/",
                wait_until="domcontentloaded",
                timeout=30_000,
            )

            if "login" in page.url or "authwall" in page.url:
                raise RuntimeError(
                    "Not logged in to LinkedIn. Run: tracker login linkedin"
                )

            elements = _find_post_elements(page)
            for el in elements[:limit]:
                post = _parse_post_element(el)
                if post:
                    posts.append(post)
        finally:
            ctx.close()

    return posts


def _find_post_elements(page):
    for selector in _POST_CONTAINER_SELECTORS:
        try:
            page.wait_for_selector(selector, timeout=8_000)
            els = page.query_selector_all(selector)
            if els:
                return els
        except Exception:
            continue
    return []


def _parse_post_element(el) -> dict | None:
    try:
        content = _extract_text(el)
        post_id, post_url = _extract_id_and_url(el)

        # Fall back to data-urn as ID
        if not post_id:
            urn = el.get_attribute("data-urn") or ""
            if urn:
                post_id = re.sub(r"[^a-zA-Z0-9_-]", "-", urn)

        if not post_id:
            return None

        posted_at = None
        time_el = el.query_selector("time")
        if time_el:
            posted_at = time_el.get_attribute("datetime")

        return {
            "post_id": f"li_{post_id}",
            "platform": "linkedin",
            "content": content,
            "url": post_url,
            "posted_at": posted_at,
        }
    except Exception:
        return None


def _extract_text(el) -> str:
    for sel in _TEXT_SELECTORS:
        text_el = el.query_selector(sel)
        if text_el:
            return text_el.inner_text().strip()
    # Last resort: get all visible text from the element
    return (el.inner_text() or "")[:600].strip()


def _extract_id_and_url(el) -> tuple[str | None, str]:
    link_patterns = [
        r"activity-(\d+)",
        r"ugcPost[:-](\d+)",
        r"/posts/([^/?]+)",
    ]
    for link_sel in ["a[href*='/activity-']", "a[href*='/posts/']", "a[href*='ugcPost']"]:
        link = el.query_selector(link_sel)
        if not link:
            continue
        href = link.get_attribute("href") or ""
        for pattern in link_patterns:
            m = re.search(pattern, href)
            if m:
                post_id = m.group(1)
                url = href if href.startswith("http") else f"https://www.linkedin.com{href}"
                # Strip query params from URL
                url = url.split("?")[0]
                return post_id, url
    return None, ""
