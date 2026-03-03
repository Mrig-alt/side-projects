"""
FastAPI application — entry point.

Endpoints:
  GET  /api/hero            → top 3 stories from last 6h (landing hero)
  GET  /api/articles        → all articles grouped by category
  GET  /api/articles/{cat}  → articles for one category
  GET  /api/developing      → developing stories (AI analysis)
  GET  /api/search          → full-text + NewsAPI search
  POST /api/summarize/{id}  → on-demand AI summary for one article
  GET  /api/topics          → list custom topic watchlists
  POST /api/topics          → add a custom topic
  DEL  /api/topics/{id}     → remove a custom topic
  POST /api/refresh         → trigger immediate full refresh
  GET  /api/status          → store stats + last refresh time

Static frontend served from ./frontend/
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import CATEGORIES
from fetcher import newsapi_search
from scheduler import (
    get_last_refresh,
    get_top_stories_cache,
    refresh_all,
    start_scheduler,
)
from storage import store
from summarizer import summarize_article, summarize_search_results

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")


# ---------------------------------------------------------------------------
# Lifespan: initial fetch + scheduler start
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — running initial fetch...")
    await refresh_all()
    start_scheduler()
    yield
    logger.info("Shutting down scheduler...")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Personal News Aggregator",
    description="Live news + data tracker with AI summaries and developing story analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/hero")
async def get_hero():
    """Top 3 most important stories from the last 6 hours."""
    return {
        "stories": get_top_stories_cache(),
        "last_refresh": get_last_refresh(),
    }


@app.get("/api/articles")
async def get_all_articles():
    """All articles grouped by category, newest first, with category metadata."""
    grouped = store.get_all_articles(limit_per_category=30)
    result = {}
    for cat_id, articles in grouped.items():
        meta = CATEGORIES.get(cat_id, {})
        result[cat_id] = {
            "label": meta.get("label", cat_id),
            "icon": meta.get("icon", "📰"),
            "articles": [a.to_dict() for a in articles],
        }
    return result


@app.get("/api/articles/{category_id}")
async def get_category_articles(category_id: str):
    """Articles for a specific category."""
    meta = CATEGORIES.get(category_id)
    if meta is None:
        # Check if it's a custom topic
        topic_key = category_id.removeprefix("topic_")
        topics = store.get_custom_topics()
        if topic_key not in topics:
            raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")
        articles = store.get_by_topic(topic_key)
        topic = topics[topic_key]
        return {
            "label": topic.get("label", topic_key),
            "icon": topic.get("icon", "📌"),
            "articles": [a.to_dict() for a in articles],
        }

    articles = store.get_by_category(category_id)
    return {
        "label": meta["label"],
        "icon": meta["icon"],
        "articles": [a.to_dict() for a in articles],
    }


@app.get("/api/developing")
async def get_developing_stories():
    """AI-identified developing stories spanning multiple regions/topics."""
    stories = store.get_developing_stories()
    return {"stories": [s.to_dict() for s in stories]}


@app.get("/api/search")
async def search(q: str, include_newsapi: bool = True):
    """
    Search across stored articles (full-text) and optionally NewsAPI.
    Returns matched articles + an AI briefing on the topic.
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query 'q' must not be empty")

    # Local search across stored articles
    local_results = store.search(q)

    # On-demand NewsAPI search (if configured + requested)
    news_results = []
    if include_newsapi:
        news_results = await newsapi_search(q, category_id="search", page_size=15)
        # Store for later reference
        if news_results:
            await store.upsert_articles(news_results)

    all_results = local_results + [a for a in news_results if a.id not in {r.id for r in local_results}]
    all_results.sort(key=lambda a: a.published, reverse=True)

    # AI briefing on the topic
    ai_briefing = await summarize_search_results(q, all_results)

    return {
        "query": q,
        "count": len(all_results),
        "ai_briefing": ai_briefing,
        "articles": [a.to_dict() for a in all_results[:50]],
    }


@app.post("/api/summarize/{article_id}")
async def get_ai_summary(article_id: str):
    """Generate (or return cached) AI summary for a single article."""
    article = store.get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.ai_summary:
        return {"article_id": article_id, "summary": article.ai_summary, "cached": True}

    summary = await summarize_article(article)
    await store.set_ai_summary(article_id, summary)
    return {"article_id": article_id, "summary": summary, "cached": False}


# ---------------------------------------------------------------------------
# Custom topic watchlist
# ---------------------------------------------------------------------------

class TopicCreate(BaseModel):
    label: str
    icon: str = "📌"
    keywords: list[str] = []
    feed_urls: list[str] = []      # plain URLs — stored as Feed objects


@app.get("/api/topics")
async def list_topics():
    return {"topics": list(store.get_custom_topics().values())}


@app.post("/api/topics", status_code=201)
async def create_topic(body: TopicCreate):
    from config import Feed

    topic_id = body.label.lower().replace(" ", "_").replace("/", "_") + "_" + uuid.uuid4().hex[:4]
    feeds = [Feed(name=url, url=url) for url in body.feed_urls]
    topic = {
        "id": topic_id,
        "label": body.label,
        "icon": body.icon,
        "keywords": body.keywords,
        "feeds": feeds,
    }
    await store.upsert_custom_topic(topic)
    logger.info("Custom topic created: %s", topic_id)
    return {"topic_id": topic_id, "topic": {k: v for k, v in topic.items() if k != "feeds"}}


@app.delete("/api/topics/{topic_id}")
async def delete_topic(topic_id: str):
    deleted = await store.delete_custom_topic(topic_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"deleted": topic_id}


# ---------------------------------------------------------------------------
# Control
# ---------------------------------------------------------------------------

@app.post("/api/refresh")
async def trigger_refresh():
    """Manually trigger a full data refresh."""
    await refresh_all()
    return {"status": "ok", "last_refresh": get_last_refresh()}


@app.get("/api/status")
async def status():
    return {
        "stats": store.stats(),
        "last_refresh": get_last_refresh(),
        "categories": {
            cat_id: {"label": cfg["label"], "icon": cfg["icon"]}
            for cat_id, cfg in CATEGORIES.items()
        },
    }


# ---------------------------------------------------------------------------
# Serve frontend
# ---------------------------------------------------------------------------

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/{path:path}")
async def catch_all(path: str):
    # For SPA routing — serve index.html for unknown paths
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
