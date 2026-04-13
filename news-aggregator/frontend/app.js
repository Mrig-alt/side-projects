/* ============================================================
   Personal Intelligence Feed — Frontend Logic v2
   Classification badges · Follow-up tracking · Perplexity live search
   ============================================================ */

const API = "";

// ── Classification config ─────────────────────────────────────
const CLF_LABELS = {
  breaking:     { text: "Breaking",     cls: "clf-breaking" },
  political:    { text: "Political",    cls: "clf-political" },
  financial:    { text: "Financial",    cls: "clf-financial" },
  supply_chain: { text: "Supply Chain", cls: "clf-supply_chain" },
  developing:   { text: "Developing",   cls: "clf-developing" },
  watchlist:    { text: "Watchlist",    cls: "clf-watchlist" },
  search:       { text: "Search",       cls: "clf-search" },
  general:      { text: "General",      cls: "clf-general" },
};

// ── State ────────────────────────────────────────────────────
let allArticles = {};
let activeCategory = "india_political";
let openArticle = null;
let followedIds = new Set();

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

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function clfBadge(classification) {
  const cfg = CLF_LABELS[classification] || CLF_LABELS.general;
  return `<span class="classification-badge ${cfg.cls}">${cfg.text}</span>`;
}

function setLastRefresh(isoStr) {
  if (isoStr) document.getElementById("last-refresh").textContent = `Last refresh: ${relativeTime(isoStr)}`;
}

// ── Article Card ─────────────────────────────────────────────
function renderArticleCard(art) {
  const premium = art.is_premium ? " premium" : "";
  const isFollowing = followedIds.has(art.id);
  const followBtnCls = isFollowing ? " following" : "";
  const followBtnText = isFollowing ? "📬 Following" : "📬 Follow";
  const summary = art.summary
    ? `<p class="article-summary">${esc(art.summary)}</p>` : "";

  return `
    <div class="article-card" data-id="${art.id}" onclick="openModal('${art.id}')">
      <div class="article-card-top">
        <span class="article-source${premium}">${esc(art.source)}</span>
        <button class="card-followup-btn${followBtnCls}"
          onclick="event.stopPropagation(); toggleFollowCard('${art.id}')"
          data-follow-btn="${art.id}">${followBtnText}</button>
      </div>
      <p class="article-title">${esc(art.title)}</p>
      ${summary}
      <div class="article-footer">
        <span class="article-meta">${relativeTime(art.published)}</span>
        ${clfBadge(art.classification || "general")}
      </div>
    </div>`;
}

async function toggleFollowCard(articleId) {
  if (followedIds.has(articleId)) {
    await fetch(`${API}/api/follow/${articleId}`, { method: "DELETE" });
    followedIds.delete(articleId);
  } else {
    // Find article in allArticles
    let art = null;
    for (const cat of Object.values(allArticles)) {
      art = (cat.articles || []).find(a => a.id === articleId);
      if (art) break;
    }
    if (art) await followArticle(art);
  }
  // Update all buttons with this id
  document.querySelectorAll(`[data-follow-btn="${articleId}"]`).forEach(btn => {
    const isF = followedIds.has(articleId);
    btn.textContent = isF ? "📬 Following" : "📬 Follow";
    btn.classList.toggle("following", isF);
  });
  await refreshFollowupBadge();
}

// ── Hero Section ─────────────────────────────────────────────
async function loadHero() {
  try {
    const data = await fetch(`${API}/api/hero`).then(r => r.json());
    setLastRefresh(data.last_refresh);
    const grid = document.getElementById("hero-grid");
    if (!data.stories?.length) {
      grid.innerHTML = `<p class="placeholder-text">No stories in the last 6 hours yet.</p>`;
      return;
    }
    grid.innerHTML = data.stories.map((art, i) => `
      <div class="hero-card" onclick="openModal('${art.id}')">
        <div class="hero-card-top">
          <div class="hero-rank">${["01","02","03"][i]}</div>
          ${clfBadge(art.classification || "general")}
        </div>
        <p class="hero-title">${esc(art.title)}</p>
        <p class="hero-meta"><span class="hero-source">${esc(art.source)}</span> · ${relativeTime(art.published)}</p>
      </div>`).join("");
  } catch (err) { console.error("Hero load failed", err); }
}

// ── Developing Stories ───────────────────────────────────────
async function loadDeveloping() {
  try {
    const data = await fetch(`${API}/api/developing`).then(r => r.json());
    const grid = document.getElementById("developing-grid");
    if (!data.stories?.length) {
      grid.innerHTML = `<p class="placeholder-text">Developing story analysis runs after first full refresh.</p>`;
      return;
    }
    grid.innerHTML = data.stories.map(s => {
      const regions = s.regions.map(r => `<span class="tag">${esc(r)}</span>`).join("");
      const actors = s.key_actors.slice(0, 4).map(a => `<span class="tag">${esc(a)}</span>`).join("");
      const isF = followedIds.has(s.id);
      return `
        <div class="developing-card">
          <div class="developing-card-header">
            <p class="developing-headline">${esc(s.headline)}</p>
            <button class="btn-follow-developing${isF ? " following" : ""}"
              data-follow-btn="${s.id}"
              onclick="toggleFollowDeveloping(${JSON.stringify(s)})">
              ${isF ? "📬 Following" : "📬 Follow Up"}
            </button>
          </div>
          <p class="developing-desc">${esc(s.description)}</p>
          <div class="developing-meta">${clfBadge("developing")} ${regions}${actors}</div>
          <p class="developing-watch">${esc(s.what_to_watch)}</p>
        </div>`;
    }).join("");
  } catch (err) { console.error("Developing stories load failed", err); }
}

async function toggleFollowDeveloping(story) {
  if (followedIds.has(story.id)) {
    await fetch(`${API}/api/follow/${story.id}`, { method: "DELETE" });
    followedIds.delete(story.id);
  } else {
    await fetch(`${API}/api/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        article_id: story.id,
        headline: story.headline,
        url: "",
        source: "Developing Story",
        category_id: "developing",
        classification: "developing",
        keywords: [...(story.regions || []), ...(story.key_actors || [])].slice(0, 5),
      }),
    });
    followedIds.add(story.id);
  }
  document.querySelectorAll(`[data-follow-btn="${story.id}"]`).forEach(btn => {
    const isF = followedIds.has(story.id);
    btn.textContent = isF ? "📬 Following" : "📬 Follow Up";
    btn.classList.toggle("following", isF);
  });
  await refreshFollowupBadge();
}

// ── Category Articles ────────────────────────────────────────
async function loadAllCategories() {
  try {
    const data = await fetch(`${API}/api/articles`).then(r => r.json());
    allArticles = data;
    renderActiveCategory();
  } catch (err) { console.error("Categories load failed", err); }
}

function renderActiveCategory() {
  const grid = document.getElementById("articles-grid");
  const cat = allArticles[activeCategory];
  if (!cat?.articles?.length) {
    grid.innerHTML = `<p class="placeholder-text">No articles yet. Try refreshing.</p>`;
    return;
  }
  grid.innerHTML = cat.articles.map(renderArticleCard).join("");
}

document.getElementById("tab-bar").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  activeCategory = tab.dataset.cat;
  renderActiveCategory();
});

// ── Custom Topics ─────────────────────────────────────────────
async function loadTopics() {
  const data = await fetch(`${API}/api/topics`).then(r => r.json());
  const topics = data.topics || [];
  const tabBar = document.getElementById("topic-tab-bar");
  const list = document.getElementById("topics-list");

  tabBar.innerHTML = topics.map(t => `
    <button class="tab topic-tab" data-topic-id="${t.id}" onclick="viewTopic('${t.id}')">
      ${esc(t.icon || "📌")} ${esc(t.label)}
      <span class="remove-tab" onclick="deleteTopic(event,'${t.id}')">✕</span>
    </button>`).join("");

  if (!topics.length) {
    list.innerHTML = `<p class="placeholder-text">No watchlists yet.</p>`;
    return;
  }
  list.innerHTML = topics.map(t => `
    <div class="topic-row">
      <div>
        <div class="topic-row-label">${esc(t.icon||"📌")} ${esc(t.label)}</div>
        ${t.keywords?.length ? `<div class="topic-row-keywords">${t.keywords.map(esc).join(", ")}</div>` : ""}
      </div>
      <div class="topic-row-actions">
        <button class="btn-view" onclick="viewTopic('${t.id}')">View</button>
        <button class="btn-del" onclick="deleteTopic(event,'${t.id}')">Remove</button>
      </div>
    </div>`).join("");
}

async function viewTopic(topicId) {
  activeCategory = null;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`[data-topic-id="${topicId}"]`)?.classList.add("active");
  const data = await fetch(`${API}/api/articles/topic_${topicId}`).then(r => r.json());
  const grid = document.getElementById("articles-grid");
  const articles = data.articles || [];
  grid.innerHTML = articles.length
    ? articles.map(renderArticleCard).join("")
    : `<p class="placeholder-text">No articles yet. Wait for next refresh.</p>`;
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
  const keywords = document.getElementById("new-topic-keywords").value.split(",").map(k=>k.trim()).filter(Boolean);
  const feedUrls = document.getElementById("new-topic-feeds").value.split(",").map(u=>u.trim()).filter(Boolean);
  const btn = document.getElementById("add-topic-btn");
  btn.textContent = "Adding..."; btn.disabled = true;
  try {
    await fetch(`${API}/api/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, keywords, feed_urls: feedUrls }),
    });
    ["new-topic-label","new-topic-keywords","new-topic-feeds"].forEach(id => document.getElementById(id).value = "");
    await loadTopics();
  } finally { btn.textContent = "+ Add Watchlist"; btn.disabled = false; }
});

// ── Search ───────────────────────────────────────────────────
async function doSearch(query) {
  if (!query.trim()) return;
  const panel = document.getElementById("search-panel");
  const resultsEl = document.getElementById("search-results");
  const briefingEl = document.getElementById("search-briefing");
  const pplxEl = document.getElementById("perplexity-briefing");
  const labelEl = document.getElementById("search-query-label");

  panel.style.display = "block";
  labelEl.textContent = query;
  resultsEl.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div>`;
  briefingEl.style.display = "none";
  pplxEl.style.display = "none";
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`).then(r => r.json());

    if (data.ai_briefing) {
      document.getElementById("search-briefing-text").textContent = data.ai_briefing;
      briefingEl.style.display = "block";
    }
    if (data.perplexity_live) {
      document.getElementById("perplexity-briefing-text").textContent = data.perplexity_live;
      pplxEl.style.display = "block";
    }

    resultsEl.innerHTML = data.articles?.length
      ? data.articles.map(renderArticleCard).join("")
      : `<p class="placeholder-text">No results for "${esc(query)}".</p>`;
  } catch (err) {
    resultsEl.innerHTML = `<p class="placeholder-text">Search failed. Please try again.</p>`;
  }
}

document.getElementById("search-btn").addEventListener("click", () => doSearch(document.getElementById("search-input").value));
document.getElementById("search-input").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });
document.getElementById("close-search").addEventListener("click", () => {
  document.getElementById("search-panel").style.display = "none";
  document.getElementById("search-input").value = "";
});

// ── Follow-up Panel ───────────────────────────────────────────
document.getElementById("followups-nav-btn").addEventListener("click", () => {
  const section = document.getElementById("followups-section");
  const isVisible = section.style.display !== "none";
  section.style.display = isVisible ? "none" : "block";
  if (!isVisible) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    loadFollowups();
  }
});
document.getElementById("close-followups").addEventListener("click", () => {
  document.getElementById("followups-section").style.display = "none";
});

document.getElementById("check-all-followups-btn").addEventListener("click", async () => {
  const btn = document.getElementById("check-all-followups-btn");
  btn.textContent = "Checking..."; btn.disabled = true;
  // Check each one (no bulk endpoint needed — just reload)
  const data = await fetch(`${API}/api/follow`).then(r => r.json());
  for (const story of (data.stories || [])) {
    await fetch(`${API}/api/follow/${story.id}/check`, { method: "POST" });
  }
  await loadFollowups();
  await refreshFollowupBadge();
  btn.textContent = "↻ Check All Now"; btn.disabled = false;
});

async function loadFollowups() {
  const data = await fetch(`${API}/api/follow`).then(r => r.json());
  const stories = data.stories || [];
  followedIds = new Set(stories.map(s => s.id));

  const list = document.getElementById("followups-list");
  if (!stories.length) {
    list.innerHTML = `<p class="placeholder-text">No followed stories yet. Click "Follow Up" on any article or developing story.</p>`;
    return;
  }

  list.innerHTML = stories.map(s => {
    const hasUnread = s.unread_count > 0;
    const updatesHtml = s.updates.length
      ? s.updates.slice().reverse().map(u => `
          <div class="followup-update${u.is_read ? "" : " unread"}">
            <div style="white-space:pre-wrap">${esc(u.summary)}</div>
            <div class="followup-update-time">${relativeTime(u.found_at)}</div>
          </div>`).join("")
      : `<p class="no-updates-yet">No updates yet. Daily check runs at 09:00 UTC via Perplexity.</p>`;

    return `
      <div class="followup-card${hasUnread ? " has-unread" : ""}" data-story-id="${s.id}">
        <div class="followup-card-header">
          <div>
            <p class="followup-headline">${esc(s.headline)}</p>
            <div class="followup-meta">
              <span>${esc(s.source)}</span>
              ${clfBadge(s.classification)}
              <span>Following since ${relativeTime(s.followed_at)}</span>
              ${s.last_checked ? `<span>Checked ${relativeTime(s.last_checked)}</span>` : ""}
              ${hasUnread ? `<span class="unread-badge">${s.unread_count} new</span>` : ""}
            </div>
          </div>
          <div class="followup-card-actions">
            <button class="btn-check-now" onclick="checkStoryNow('${s.id}', this)">↻ Check Now</button>
            ${s.url ? `<a href="${esc(s.url)}" class="btn-sm" target="_blank" rel="noopener">Open ↗</a>` : ""}
            <button class="btn-unfollow" onclick="unfollowStory('${s.id}')">Unfollow</button>
          </div>
        </div>
        <div class="followup-updates">${updatesHtml}</div>
      </div>`;
  }).join("");

  // Mark read when panel opened
  for (const s of stories) {
    if (s.unread_count > 0) {
      await fetch(`${API}/api/follow/${s.id}/read`, { method: "POST" });
    }
  }
  await refreshFollowupBadge();
}

async function checkStoryNow(storyId, btn) {
  btn.textContent = "Checking..."; btn.disabled = true;
  try {
    await fetch(`${API}/api/follow/${storyId}/check`, { method: "POST" });
    await loadFollowups();
  } finally { btn.textContent = "↻ Check Now"; btn.disabled = false; }
}

async function unfollowStory(storyId) {
  if (!confirm("Stop following this story?")) return;
  await fetch(`${API}/api/follow/${storyId}`, { method: "DELETE" });
  followedIds.delete(storyId);
  await loadFollowups();
  await refreshFollowupBadge();
  // Update any follow buttons in articles grid
  document.querySelectorAll(`[data-follow-btn="${storyId}"]`).forEach(btn => {
    btn.textContent = "📬 Follow";
    btn.classList.remove("following");
  });
}

async function refreshFollowupBadge() {
  try {
    const data = await fetch(`${API}/api/status`).then(r => r.json());
    const unread = data.followups?.unread || 0;
    const badge = document.getElementById("nav-unread-badge");
    if (unread > 0) {
      badge.textContent = unread;
      badge.style.display = "inline";
    } else {
      badge.style.display = "none";
    }
  } catch {}
}

// ── Follow article helper ─────────────────────────────────────
async function followArticle(art) {
  await fetch(`${API}/api/follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      article_id: art.id,
      headline: art.title,
      url: art.url,
      source: art.source,
      category_id: art.category_id,
      classification: art.classification || "general",
      keywords: art.title.split(/\s+/).filter(w => w.length > 4).slice(0, 8),
    }),
  });
  followedIds.add(art.id);
}

// ── Modal ────────────────────────────────────────────────────
function openModal(articleId) {
  let art = null;
  for (const cat of Object.values(allArticles)) {
    art = (cat.articles || []).find(a => a.id === articleId);
    if (art) break;
  }
  if (!art) {
    // Try search results in DOM
    const card = document.querySelector(`[data-id="${articleId}"]`);
    if (!card) return;
    art = { id: articleId, title: card.querySelector(".article-title")?.textContent || "" };
  }

  openArticle = art;

  document.getElementById("modal-source").textContent = art.source || "";
  document.getElementById("modal-classification").className = `classification-badge ${(CLF_LABELS[art.classification] || CLF_LABELS.general).cls}`;
  document.getElementById("modal-classification").textContent = (CLF_LABELS[art.classification] || CLF_LABELS.general).text;
  document.getElementById("modal-title").textContent = art.title || "";
  document.getElementById("modal-meta").textContent = art.published ? relativeTime(art.published) : "";
  document.getElementById("modal-summary").textContent = art.summary || "";
  document.getElementById("modal-link").href = art.url || "#";

  const claudeSection = document.getElementById("modal-claude-summary");
  const aiBtn = document.getElementById("modal-ai-btn");
  claudeSection.style.display = "none";
  document.getElementById("modal-openai-summary").style.display = "none";

  if (art.ai_summary) {
    document.getElementById("modal-claude-text").textContent = art.ai_summary;
    claudeSection.style.display = "flex";
    aiBtn.textContent = "✦ Regenerate Summary";
  } else {
    aiBtn.textContent = "✦ Get AI Summary";
    aiBtn.disabled = false;
  }

  // Follow button state
  const followBtn = document.getElementById("modal-followup-btn");
  const isFollowing = followedIds.has(art.id);
  followBtn.textContent = isFollowing ? "📬 Following" : "📬 Follow Up";
  followBtn.classList.toggle("following", isFollowing);

  document.getElementById("modal").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.body.style.overflow = "";
  openArticle = null;
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("click", e => { if (e.target === document.getElementById("modal")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

document.getElementById("modal-ai-btn").addEventListener("click", async () => {
  if (!openArticle) return;
  const btn = document.getElementById("modal-ai-btn");
  const claudeSection = document.getElementById("modal-claude-summary");
  const claudeText = document.getElementById("modal-claude-text");
  btn.textContent = "⏳ Summarizing..."; btn.disabled = true;
  try {
    const data = await fetch(`${API}/api/summarize/${openArticle.id}`, { method: "POST" }).then(r => r.json());
    claudeText.textContent = data.summary;
    claudeSection.style.display = "flex";
    openArticle.ai_summary = data.summary;
    btn.textContent = "✦ Regenerate Summary";
  } catch {
    claudeText.textContent = "Failed to generate summary. Check ANTHROPIC_API_KEY.";
    claudeSection.style.display = "flex";
    btn.textContent = "✦ Get AI Summary";
  } finally { btn.disabled = false; }
});

document.getElementById("modal-followup-btn").addEventListener("click", async () => {
  if (!openArticle) return;
  const btn = document.getElementById("modal-followup-btn");
  if (followedIds.has(openArticle.id)) {
    await fetch(`${API}/api/follow/${openArticle.id}`, { method: "DELETE" });
    followedIds.delete(openArticle.id);
    btn.textContent = "📬 Follow Up";
    btn.classList.remove("following");
  } else {
    await followArticle(openArticle);
    btn.textContent = "📬 Following";
    btn.classList.add("following");
  }
  // Sync card button
  document.querySelectorAll(`[data-follow-btn="${openArticle.id}"]`).forEach(b => {
    b.textContent = followedIds.has(openArticle.id) ? "📬 Following" : "📬 Follow";
    b.classList.toggle("following", followedIds.has(openArticle.id));
  });
  await refreshFollowupBadge();
});

// ── Toast notifications ──────────────────────────────────────
const TOAST_DURATIONS = { high: 15000, medium: 9000 };
const CATEGORY_ICONS = {
  political: "🏛", financial: "📊", supply_chain: "🚢",
  breaking: "⚡", controversial: "🔥", general: "📰",
};

function showToast(alert) {
  const container = document.getElementById("toast-container");
  const icon = CATEGORY_ICONS[alert.category] || "📰";
  const severityLabel = alert.severity === "high" ? "⚡ Breaking Alert" : "📍 Notable Story";

  const toast = document.createElement("div");
  toast.className = `toast toast-${alert.severity}`;
  toast.setAttribute("data-alert-id", alert.id);
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-label">${severityLabel}</div>
      <div class="toast-title">${esc(alert.headline)}</div>
      <div class="toast-reason">${esc(alert.reason)}</div>
    </div>
    <button class="toast-dismiss" onclick="dismissToast(this.closest('.toast'))">✕</button>`;

  // Click toast body → open article if available
  toast.addEventListener("click", e => {
    if (e.target.classList.contains("toast-dismiss")) return;
    if (alert.article_id) openModal(alert.article_id);
    dismissToast(toast);
  });

  container.prepend(toast);

  const dur = TOAST_DURATIONS[alert.severity] || 9000;
  setTimeout(() => dismissToast(toast), dur);
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains("toast-out")) return;
  toast.classList.add("toast-out");
  setTimeout(() => toast.remove(), 280);
}

// ── Alerts bell + history panel ──────────────────────────────
let alertBellCount = 0;

function updateAlertBell(delta = 1) {
  alertBellCount += delta;
  const badge = document.getElementById("alert-bell-count");
  const bell = document.getElementById("alerts-bell-btn");
  badge.textContent = alertBellCount;
  badge.style.display = alertBellCount > 0 ? "block" : "none";
  bell.classList.add("ringing");
  setTimeout(() => bell.classList.remove("ringing"), 1100);
}

document.getElementById("alerts-bell-btn").addEventListener("click", async () => {
  const panel = document.getElementById("alerts-panel");
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "flex";
  if (!isOpen) {
    await renderAlertsPanel();
    alertBellCount = 0;
    const badge = document.getElementById("alert-bell-count");
    badge.style.display = "none";
  }
});

document.getElementById("close-alerts-panel").addEventListener("click", () => {
  document.getElementById("alerts-panel").style.display = "none";
});

async function renderAlertsPanel() {
  const data = await fetch(`${API}/api/alerts`).then(r => r.json());
  const alerts = data.alerts || [];
  const list = document.getElementById("alerts-list");
  if (!alerts.length) {
    list.innerHTML = `<p class="placeholder-text">No alerts yet. Claude will flag important stories on the next refresh.</p>`;
    return;
  }
  list.innerHTML = alerts.map(a => `
    <div class="alert-card severity-${a.severity}"
         onclick="${a.article_id ? `openModal('${a.article_id}'); document.getElementById('alerts-panel').style.display='none'` : ""}">
      <div class="alert-card-header">
        <span class="alert-severity-badge sev-${a.severity}">${a.severity === "high" ? "⚡ High" : "📍 Medium"}</span>
        ${clfBadge(a.category)}
        <span class="alert-meta">${relativeTime(a.created_at)}</span>
      </div>
      <p class="alert-headline">${esc(a.headline)}</p>
      <p class="alert-reason">${esc(a.reason)}</p>
      ${a.source ? `<p class="alert-meta">${esc(a.source)}</p>` : ""}
    </div>`).join("");
}

// ── SSE connection (alerts stream) ───────────────────────────
function connectAlertStream() {
  const es = new EventSource(`${API}/api/alerts/stream`);

  es.onopen = () => console.log("[alerts] SSE connected");

  es.onmessage = (event) => {
    try {
      const alert = JSON.parse(event.data);
      // Show toast
      showToast(alert);
      // Update bell count (unless panel is open)
      const panelOpen = document.getElementById("alerts-panel").style.display !== "none";
      if (!panelOpen) updateAlertBell(1);
      else renderAlertsPanel();
      // OS-level browser notification (if granted)
      if (Notification.permission === "granted") {
        const notif = new Notification(
          alert.severity === "high" ? "⚡ Breaking Alert" : "📍 Intel Feed",
          {
            body: `${alert.headline}\n${alert.reason}`,
            icon: "/static/favicon.png",
            tag: alert.id,
            renotify: true,
          }
        );
        notif.onclick = () => {
          window.focus();
          if (alert.article_id) openModal(alert.article_id);
          notif.close();
        };
      }
    } catch (err) {
      console.warn("[alerts] Failed to parse SSE event", err);
    }
  };

  es.onerror = () => {
    console.warn("[alerts] SSE disconnected — reconnecting in 10s");
    es.close();
    setTimeout(connectAlertStream, 10000);
  };
}

// ── Service worker + Web Push ─────────────────────────────────

function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("[SW] Registration failed:", err);
    return null;
  }
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const { vapid_public_key } = await fetch(`${API}/api/config`).then(r => r.json());
    if (!vapid_public_key) return; // VAPID not configured on server

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid_public_key),
    });
    await fetch(`${API}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    console.log("[Push] Subscribed — alerts will arrive even when tab is closed");
  } catch (err) {
    console.warn("[Push] Subscribe failed:", err);
  }
}

// ── Browser notification permission ──────────────────────────
async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    // Already granted — just ensure push subscription is active
    await subscribeToPush();
  } else if (Notification.permission === "default") {
    // Wait for first user interaction, then ask
    const handler = async () => {
      const result = await Notification.requestPermission();
      if (result === "granted") await subscribeToPush();
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler, { once: true });
  }
}

// ── Refresh button ───────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = `<span class="spinning">↻</span> Refreshing...`; btn.disabled = true;
  try {
    await fetch(`${API}/api/refresh`, { method: "POST" });
    await Promise.all([loadHero(), loadDeveloping(), loadAllCategories()]);
    setLastRefresh(new Date().toISOString());
  } finally { btn.innerHTML = "↻ Refresh"; btn.disabled = false; }
});

// ── Auto-refresh every 30 min ────────────────────────────────
setInterval(async () => {
  await Promise.all([loadHero(), loadDeveloping(), loadAllCategories()]);
  setLastRefresh(new Date().toISOString());
  await refreshFollowupBadge();
}, 30 * 60 * 1000);

// ── Init ─────────────────────────────────────────────────────
(async () => {
  // Register service worker early so it's ready when we subscribe to push
  await registerServiceWorker();

  // Load follow state first so cards render correctly
  const followData = await fetch(`${API}/api/follow`).then(r => r.json()).catch(() => ({ stories: [] }));
  followedIds = new Set((followData.stories || []).map(s => s.id));

  await Promise.all([
    loadHero(),
    loadDeveloping(),
    loadAllCategories(),
    loadTopics(),
    refreshFollowupBadge(),
  ]);

  // Connect to live alert stream
  connectAlertStream();

  // Request browser notification permission (on first click)
  await requestNotificationPermission();
})();
