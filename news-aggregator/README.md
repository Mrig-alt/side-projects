# Personal Intelligence Feed

A live news aggregator + data search tool. Pulls from 30+ RSS feeds across India, US, and Europe (politics + finance), operations & supply chain, with AI-powered developing story analysis and on-demand topic search.

## Features

- **Hero landing**: Top 3 most important stories from the last 6 hours, AI-selected
- **Category feeds**: India/US/Europe (political + financial), Ops & Supply Chain
- **Developing stories**: Claude AI clusters cross-cutting narratives across all regions
- **Search anything**: Full-text search + NewsAPI for any topic on demand (shipping delays, company earnings, political crises, anything)
- **Custom watchlists**: Add any topic (keywords + optional RSS feeds) — tracked on every refresh
- **AI summaries**: One-click per-article Claude summary, cached for the session
- **Premium auth**: Leverage NYT, FT, WSJ, Economist subscriptions via browser cookies
- **Auto-refresh**: Every 30 minutes, or manual trigger

## Quick Start

```bash
cd news-aggregator

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Edit .env with your API keys and cookie strings (see below)

# 3. Run
python -m uvicorn main:app --reload --port 8000

# 4. Open http://localhost:8000
```

## Setting Up Premium Cookies

Your subscriptions (NYT, FT, WSJ, Economist) are accessed by passing your browser session cookies with RSS requests. This is the same thing your browser does when you visit the site while logged in.

**Easiest method — Cookie-Editor extension:**
1. Install [Cookie-Editor](https://cookie-editor.com/) in Chrome/Firefox
2. Log into the news site
3. Click the Cookie-Editor icon → **Export** → **Header String**
4. Paste into the relevant `*_COOKIES=` variable in `.env`

Cookies expire periodically. Re-export when you notice a feed returning 403 errors (the app will log a warning).

## Adding Custom Watchlists

**Via the dashboard** (easiest):
- Scroll to "My Watchlists" section
- Enter a label (e.g. `Nvidia earnings`) and keywords (e.g. `Nvidia, NVDA, GPU`)
- Optionally add RSS feed URLs
- Click **+ Add Watchlist**

**Via API:**
```bash
curl -X POST http://localhost:8000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"label": "Red Sea Shipping", "keywords": ["Red Sea", "Houthi", "shipping lane"]}'
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hero` | Top 3 stories from last 6h |
| GET | `/api/articles` | All articles by category |
| GET | `/api/articles/{cat}` | One category's articles |
| GET | `/api/developing` | AI developing story analysis |
| GET | `/api/search?q=query` | Search + NewsAPI + AI briefing |
| POST | `/api/summarize/{id}` | AI summary for one article |
| GET | `/api/topics` | List custom watchlists |
| POST | `/api/topics` | Add watchlist |
| DELETE | `/api/topics/{id}` | Remove watchlist |
| POST | `/api/refresh` | Trigger immediate refresh |
| GET | `/api/status` | Stats and last refresh time |

## Environment Variables

See `.env.example` for all options. Minimum required:
- `ANTHROPIC_API_KEY` — for AI summaries and developing stories
- `NEWS_API_KEY` — for on-demand topic search (optional but recommended)
- `*_COOKIES` — for premium feed access (optional, falls back to public RSS)
