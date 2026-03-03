/* ============================================================
   Personal Intelligence Feed — Frontend Logic
   ============================================================ */

const API = "";  // same-origin

// ── State ────────────────────────────────────────────────────
let allArticles = {};   // category_id → { label, icon, articles[] }
let activeCategory = "india_political";
let activeTopicId = null;
let openArticle = null;

// ── Utilities ────────────────────────────────────────────────
function relativeTime(isoStr) {
  const ms = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setLastRefresh(isoStr) {
  if (!isoStr) return;
  document.getElementById("last-refresh").textContent =
    `Last refresh: ${relativeTime(isoStr)}`;
}

// ── Article Card ─────────────────────────────────────────────
function renderArticleCard(art) {
  const premiumClass = art.is_premium ? " premium" : "";
  const summary = art.summary
    ? `<p class="article-summary">${escHtml(art.summary)}</p>`
    : "";
  return `
    <div class="article-card" data-id="${art.id}" onclick="openModal('${art.id}')">
      <span class="article-source${premiumClass}">${escHtml(art.source)}</span>
      <p class="article-title">${escHtml(art.title)}</p>
      ${summary}
      <span class="article-meta">${relativeTime(art.published)}</span>
    </div>`;
}

// ── Hero Section ─────────────────────────────────────────────
async function loadHero() {
  try {
    const data = await fetch(`${API}/api/hero`).then(r => r.json());
    setLastRefresh(data.last_refresh);

    const grid = document.getElementById("hero-grid");
    if (!data.stories || data.stories.length === 0) {
      grid.innerHTML = `<p class="placeholder-text">No stories in the last 6 hours yet. Refresh to fetch latest.</p>`;
      return;
    }
    grid.innerHTML = data.stories.map((art, i) => `
      <div class="hero-card" onclick="openModal('${art.id}')">
        <div class="hero-rank">${["01", "02", "03"][i]}</div>
        <p class="hero-title">${escHtml(art.title)}</p>
        <p class="hero-meta">
          <span class="hero-source">${escHtml(art.source)}</span>
          · ${relativeTime(art.published)}
        </p>
      </div>`).join("");
  } catch (err) {
    console.error("Hero load failed", err);
  }
}

// ── Developing Stories ───────────────────────────────────────
async function loadDeveloping() {
  try {
    const data = await fetch(`${API}/api/developing`).then(r => r.json());
    const grid = document.getElementById("developing-grid");

    if (!data.stories || data.stories.length === 0) {
      grid.innerHTML = `<p class="placeholder-text">Developing story analysis runs after the first full refresh cycle.</p>`;
      return;
    }
    grid.innerHTML = data.stories.map(s => {
      const regions = s.regions.map(r => `<span class="tag">${escHtml(r)}</span>`).join(" ");
      const actors = s.key_actors.slice(0, 4).map(a => `<span class="tag">${escHtml(a)}</span>`).join(" ");
      return `
        <div class="developing-card">
          <p class="developing-headline">${escHtml(s.headline)}</p>
          <p class="developing-desc">${escHtml(s.description)}</p>
          <div class="developing-meta">${regions}${actors}</div>
          <p class="developing-watch">${escHtml(s.what_to_watch)}</p>
        </div>`;
    }).join("");
  } catch (err) {
    console.error("Developing stories load failed", err);
  }
}

// ── Category Articles ────────────────────────────────────────
async function loadAllCategories() {
  try {
    const data = await fetch(`${API}/api/articles`).then(r => r.json());
    allArticles = data;
    renderActiveCategory();
  } catch (err) {
    console.error("Categories load failed", err);
  }
}

function renderActiveCategory() {
  const grid = document.getElementById("articles-grid");
  const cat = allArticles[activeCategory];
  if (!cat) {
    grid.innerHTML = `<p class="placeholder-text">No articles yet for this category.</p>`;
    return;
  }
  if (cat.articles.length === 0) {
    grid.innerHTML = `<p class="placeholder-text">No articles yet. Try refreshing.</p>`;
    return;
  }
  grid.innerHTML = cat.articles.map(renderArticleCard).join("");
}

function renderTopicArticles(articles) {
  const grid = document.getElementById("articles-grid");
  if (!articles || articles.length === 0) {
    grid.innerHTML = `<p class="placeholder-text">No articles yet for this watchlist. Wait for next refresh.</p>`;
    return;
  }
  grid.innerHTML = articles.map(renderArticleCard).join("");
}

// ── Tab Navigation ───────────────────────────────────────────
document.getElementById("tab-bar").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll("#tab-bar .tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll("#topic-tab-bar .tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  activeCategory = tab.dataset.cat;
  activeTopicId = null;
  renderActiveCategory();
});

// ── Custom Topics ─────────────────────────────────────────────
async function loadTopics() {
  const data = await fetch(`${API}/api/topics`).then(r => r.json());
  const topics = data.topics || [];

  const tabBar = document.getElementById("topic-tab-bar");
  const list = document.getElementById("topics-list");

  if (topics.length === 0) {
    tabBar.innerHTML = "";
    list.innerHTML = `<p class="placeholder-text">No watchlists yet. Add a topic above to start tracking.</p>`;
    return;
  }

  tabBar.innerHTML = topics.map(t => `
    <button class="tab topic-tab" data-topic-id="${t.id}" onclick="viewTopic('${t.id}')">
      ${escHtml(t.icon || "📌")} ${escHtml(t.label)}
      <span class="remove-tab" onclick="deleteTopic(event, '${t.id}')">✕</span>
    </button>`).join("");

  list.innerHTML = topics.map(t => `
    <div class="topic-row">
      <div>
        <div class="topic-row-label">${escHtml(t.icon || "📌")} ${escHtml(t.label)}</div>
        ${t.keywords && t.keywords.length
          ? `<div class="topic-row-keywords">${t.keywords.map(escHtml).join(", ")}</div>`
          : ""}
      </div>
      <div class="topic-row-actions">
        <button class="btn-view" onclick="viewTopic('${t.id}')">View</button>
        <button class="btn-del" onclick="deleteTopic(event, '${t.id}')">Remove</button>
      </div>
    </div>`).join("");
}

async function viewTopic(topicId) {
  activeTopicId = topicId;
  activeCategory = null;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const topicTab = document.querySelector(`[data-topic-id="${topicId}"]`);
  if (topicTab) topicTab.classList.add("active");

  const data = await fetch(`${API}/api/articles/topic_${topicId}`).then(r => r.json());
  renderTopicArticles(data.articles || []);
}

async function deleteTopic(evt, topicId) {
  evt.stopPropagation();
  if (!confirm("Remove this watchlist?")) return;
  await fetch(`${API}/api/topics/${topicId}`, { method: "DELETE" });
  await loadTopics();
}

document.getElementById("add-topic-btn").addEventListener("click", async () => {
  const label = document.getElementById("new-topic-label").value.trim();
  if (!label) { alert("Please enter a topic label."); return; }

  const keywords = document.getElementById("new-topic-keywords").value
    .split(",").map(k => k.trim()).filter(Boolean);
  const feedUrls = document.getElementById("new-topic-feeds").value
    .split(",").map(u => u.trim()).filter(Boolean);

  const btn = document.getElementById("add-topic-btn");
  btn.textContent = "Adding...";
  btn.disabled = true;

  try {
    await fetch(`${API}/api/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, keywords, feed_urls: feedUrls }),
    });
    document.getElementById("new-topic-label").value = "";
    document.getElementById("new-topic-keywords").value = "";
    document.getElementById("new-topic-feeds").value = "";
    await loadTopics();
  } finally {
    btn.textContent = "+ Add Watchlist";
    btn.disabled = false;
  }
});

// ── Search ───────────────────────────────────────────────────
async function doSearch(query) {
  if (!query.trim()) return;

  const panel = document.getElementById("search-panel");
  const resultsEl = document.getElementById("search-results");
  const briefingEl = document.getElementById("search-briefing");
  const labelEl = document.getElementById("search-query-label");

  panel.style.display = "block";
  labelEl.textContent = query;
  resultsEl.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>`;
  briefingEl.style.display = "none";

  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`).then(r => r.json());

    if (data.ai_briefing) {
      briefingEl.textContent = data.ai_briefing;
      briefingEl.style.display = "block";
    }

    if (!data.articles || data.articles.length === 0) {
      resultsEl.innerHTML = `<p class="placeholder-text">No results found for "${escHtml(query)}".</p>`;
      return;
    }
    resultsEl.innerHTML = data.articles.map(renderArticleCard).join("");
  } catch (err) {
    resultsEl.innerHTML = `<p class="placeholder-text">Search failed. Please try again.</p>`;
    console.error("Search error", err);
  }
}

document.getElementById("search-btn").addEventListener("click", () => {
  const q = document.getElementById("search-input").value;
  doSearch(q);
});
document.getElementById("search-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch(e.target.value);
});
document.getElementById("close-search").addEventListener("click", () => {
  document.getElementById("search-panel").style.display = "none";
  document.getElementById("search-input").value = "";
});

// ── Modal ────────────────────────────────────────────────────
function openModal(articleId) {
  // Find article in allArticles or search results
  let art = null;
  for (const cat of Object.values(allArticles)) {
    art = (cat.articles || []).find(a => a.id === articleId);
    if (art) break;
  }
  // Also check search results grid
  if (!art) {
    const card = document.querySelector(`[data-id="${articleId}"]`);
    if (card) {
      // Reconstruct minimal object from DOM (fallback)
      art = { id: articleId, title: card.querySelector(".article-title")?.textContent || "" };
    }
  }

  if (!art) return;
  openArticle = art;

  document.getElementById("modal-source").textContent = art.source || "";
  document.getElementById("modal-title").textContent = art.title || "";
  document.getElementById("modal-meta").textContent =
    art.published ? relativeTime(art.published) : "";
  document.getElementById("modal-summary").textContent = art.summary || "";
  document.getElementById("modal-link").href = art.url || "#";

  const aiSection = document.getElementById("modal-ai-summary");
  const aiText = document.getElementById("modal-ai-text");
  const aiBtn = document.getElementById("modal-ai-btn");

  if (art.ai_summary) {
    aiText.textContent = art.ai_summary;
    aiSection.style.display = "flex";
    aiBtn.textContent = "✦ Regenerate Summary";
  } else {
    aiSection.style.display = "none";
    aiBtn.textContent = "✦ Get AI Summary";
    aiBtn.disabled = false;
  }

  document.getElementById("modal").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.body.style.overflow = "";
  openArticle = null;
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("click", e => {
  if (e.target === document.getElementById("modal")) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

document.getElementById("modal-ai-btn").addEventListener("click", async () => {
  if (!openArticle) return;
  const btn = document.getElementById("modal-ai-btn");
  const aiSection = document.getElementById("modal-ai-summary");
  const aiText = document.getElementById("modal-ai-text");

  btn.textContent = "⏳ Summarizing...";
  btn.disabled = true;

  try {
    const data = await fetch(`${API}/api/summarize/${openArticle.id}`, {
      method: "POST",
    }).then(r => r.json());

    aiText.textContent = data.summary;
    aiSection.style.display = "flex";
    openArticle.ai_summary = data.summary;
    btn.textContent = "✦ Regenerate Summary";
  } catch (err) {
    aiText.textContent = "Failed to generate summary. Check ANTHROPIC_API_KEY.";
    aiSection.style.display = "flex";
    btn.textContent = "✦ Get AI Summary";
  } finally {
    btn.disabled = false;
  }
});

// ── Refresh Button ───────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = `<span class="spinning">↻</span> Refreshing...`;
  btn.disabled = true;
  try {
    await fetch(`${API}/api/refresh`, { method: "POST" });
    await Promise.all([loadHero(), loadDeveloping(), loadAllCategories()]);
    setLastRefresh(new Date().toISOString());
  } finally {
    btn.innerHTML = "↻ Refresh";
    btn.disabled = false;
  }
});

// ── Auto-refresh every 30 minutes ────────────────────────────
setInterval(async () => {
  await Promise.all([loadHero(), loadDeveloping(), loadAllCategories()]);
  setLastRefresh(new Date().toISOString());
}, 30 * 60 * 1000);

// ── Init ─────────────────────────────────────────────────────
(async () => {
  await Promise.all([
    loadHero(),
    loadDeveloping(),
    loadAllCategories(),
    loadTopics(),
  ]);
})();
