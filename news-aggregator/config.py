"""
Feed configuration, premium source settings, and default custom topics.
All RSS feed URLs are organized by category. Premium sources require browser cookies
stored in .env (see .env.example for instructions on how to export them).
"""

from __future__ import annotations
import os
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Feed descriptor
# ---------------------------------------------------------------------------

@dataclass
class Feed:
    name: str
    url: str
    domain: Optional[str] = None   # if set, will try premium cookie auth for this domain
    is_premium: bool = False


# ---------------------------------------------------------------------------
# Core categories
# ---------------------------------------------------------------------------

CATEGORIES: dict[str, dict] = {
    "india_political": {
        "label": "India — Politics",
        "icon": "🇮🇳",
        "feeds": [
            Feed("Times of India", "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms"),
            Feed("The Hindu National", "https://www.thehindu.com/news/national/feeder/default.rss"),
            Feed("NDTV India", "https://feeds.feedburner.com/ndtvnews-india-news"),
            Feed("Indian Express", "https://indianexpress.com/section/india/feed/"),
            Feed("The Wire", "https://thewire.in/feed"),
        ],
    },
    "india_financial": {
        "label": "India — Finance",
        "icon": "📈",
        "feeds": [
            Feed("Economic Times", "https://economictimes.indiatimes.com/rssfeedstopstories.cms"),
            Feed("Mint Economy", "https://www.livemint.com/rss/economy"),
            Feed("Business Standard", "https://www.business-standard.com/rss/home_page_top_stories.rss"),
            Feed("Financial Express", "https://www.financialexpress.com/feed/"),
            Feed("CNBC TV18", "https://www.cnbctv18.com/rss/economy"),
        ],
    },
    "us_political": {
        "label": "US — Politics",
        "icon": "🇺🇸",
        "feeds": [
            Feed("NYT Politics", "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
                 domain="nytimes.com", is_premium=True),
            Feed("Politico", "https://www.politico.com/rss/politicopicks.xml"),
            Feed("The Hill", "https://thehill.com/feed/"),
            Feed("NPR Politics", "https://feeds.npr.org/1014/rss.xml"),
            Feed("AP Politics", "https://feeds.apnews.com/apf-politics"),
        ],
    },
    "us_financial": {
        "label": "US — Finance",
        "icon": "💵",
        "feeds": [
            Feed("NYT Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
                 domain="nytimes.com", is_premium=True),
            Feed("WSJ Markets", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
                 domain="wsj.com", is_premium=True),
            Feed("FT US", "https://www.ft.com/rss/home/us",
                 domain="ft.com", is_premium=True),
            Feed("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss"),
            Feed("Reuters Finance", "https://feeds.reuters.com/reuters/businessNews"),
            Feed("CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
        ],
    },
    "europe_political": {
        "label": "Europe — Politics",
        "icon": "🇪🇺",
        "feeds": [
            Feed("Guardian Europe", "https://www.theguardian.com/world/europe-news/rss"),
            Feed("Politico Europe", "https://www.politico.eu/feed/"),
            Feed("BBC Europe", "https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
            Feed("Euronews", "https://www.euronews.com/rss?format=mrss&level=theme&name=news"),
            Feed("DW (Deutsche Welle)", "https://rss.dw.com/rdf/rss-en-all"),
        ],
    },
    "europe_financial": {
        "label": "Europe — Finance",
        "icon": "💶",
        "feeds": [
            Feed("FT Europe", "https://www.ft.com/rss/home/europe",
                 domain="ft.com", is_premium=True),
            Feed("The Economist", "https://www.economist.com/rss",
                 domain="economist.com", is_premium=True),
            Feed("Reuters EU Business", "https://feeds.reuters.com/reuters/EuropeanbusinessNews"),
            Feed("WSJ Europe", "https://feeds.a.dj.com/rss/WSJEurope.xml",
                 domain="wsj.com", is_premium=True),
        ],
    },
    "ops_supply_chain": {
        "label": "Ops & Supply Chain",
        "icon": "🚢",
        "feeds": [
            Feed("Supply Chain Dive", "https://www.supplychaindive.com/feeds/news/"),
            Feed("Logistics Management", "https://www.logisticsmgmt.com/rss"),
            Feed("DC Velocity", "https://www.dcvelocity.com/rss/"),
            Feed("FreightWaves", "https://www.freightwaves.com/news/feed"),
            Feed("Reuters Commodities", "https://feeds.reuters.com/reuters/businessNews"),
            Feed("WSJ Logistics", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
                 domain="wsj.com", is_premium=True),
        ],
    },
}

# ---------------------------------------------------------------------------
# Premium source cookie config
# Maps domain → env variable name that holds the cookie string.
# To get cookie strings: browser DevTools → Application → Cookies → copy as header value
# OR use the "Cookie-Editor" browser extension → export as "Header String"
# ---------------------------------------------------------------------------

PREMIUM_SOURCES: dict[str, dict] = {
    "nytimes.com": {
        "env_var": "NYT_COOKIES",
        "label": "New York Times",
    },
    "ft.com": {
        "env_var": "FT_COOKIES",
        "label": "Financial Times",
    },
    "wsj.com": {
        "env_var": "WSJ_COOKIES",
        "label": "Wall Street Journal",
    },
    "economist.com": {
        "env_var": "ECONOMIST_COOKIES",
        "label": "The Economist",
    },
}


def get_premium_cookies(domain: str) -> dict[str, str]:
    """Return cookie dict for a given domain, or empty dict if not configured."""
    source = PREMIUM_SOURCES.get(domain, {})
    env_var = source.get("env_var")
    if not env_var:
        return {}
    cookie_str = os.environ.get(env_var, "").strip()
    if not cookie_str:
        return {}
    # Parse "key=value; key2=value2" header format into dict
    cookies: dict[str, str] = {}
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            k, _, v = part.partition("=")
            cookies[k.strip()] = v.strip()
    return cookies


# ---------------------------------------------------------------------------
# Default custom topic watchlists (user can add more via the UI / API)
# Each topic specifies search keywords and optional dedicated RSS feeds.
# ---------------------------------------------------------------------------

# Default custom topics — empty by default. Add any topic you want tracked via
# the dashboard UI ("+ Add Topic" button) or the POST /api/topics API.
# Each topic can specify keywords for search and/or dedicated RSS feeds.
# Examples of topics users have added: "Nvidia earnings", "Red Sea shipping",
# "India-Pakistan border", "Fed rate decisions", "SpaceX launches", etc.
DEFAULT_CUSTOM_TOPICS: list[dict] = []

# ---------------------------------------------------------------------------
# App settings (overridable via environment)
# ---------------------------------------------------------------------------

REFRESH_INTERVAL_MINUTES: int = int(os.environ.get("REFRESH_INTERVAL_MINUTES", "30"))
MAX_ARTICLES_PER_FEED: int = int(os.environ.get("MAX_ARTICLES_PER_FEED", "8"))
MAX_ARTICLES_AGE_HOURS: int = int(os.environ.get("MAX_ARTICLES_AGE_HOURS", "48"))
PORT: int = int(os.environ.get("PORT", "8000"))
NEWS_API_KEY: str = os.environ.get("NEWS_API_KEY", "")
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
PERPLEXITY_API_KEY: str = os.environ.get("PERPLEXITY_API_KEY", "")
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")

# Which AI to use for article summaries: "claude" | "openai" | "both"
# Perplexity is always used for follow-up story tracking (it has web search).
SUMMARY_AI: str = os.environ.get("SUMMARY_AI", "claude")

# Hour (UTC) to run the daily follow-up check via Perplexity
FOLLOWUP_CHECK_HOUR_UTC: int = int(os.environ.get("FOLLOWUP_CHECK_HOUR_UTC", "9"))

# ---------------------------------------------------------------------------
# Classification labels — derived from category_id
# Used to badge every article card and story card in the UI.
# ---------------------------------------------------------------------------

CATEGORY_CLASSIFICATIONS: dict[str, str] = {
    "india_political":   "political",
    "us_political":      "political",
    "europe_political":  "political",
    "india_financial":   "financial",
    "us_financial":      "financial",
    "europe_financial":  "financial",
    "ops_supply_chain":  "supply_chain",
    "search":            "search",
}

# Articles published within this many hours get the "breaking" classification
BREAKING_THRESHOLD_HOURS: float = 2.0
