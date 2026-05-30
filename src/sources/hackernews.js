'use strict';

const fetch = require('node-fetch');

const HN_API = 'https://hacker-news.firebaseio.com/v0';

async function fetchItem(id) {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`, { timeout: 8000 });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchHackerNews(topN = 8) {
  try {
    const res = await fetch(`${HN_API}/topstories.json`, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ids = await res.json();

    // Fetch top 20 items in parallel, filter down to topN best stories
    const items = await Promise.all(ids.slice(0, 20).map(fetchItem));

    const stories = items
      .filter((item) => item && item.type === 'story' && item.score > 80 && item.url)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((item) => ({
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        permalink: `https://news.ycombinator.com/item?id=${item.id}`,
        score: item.score,
        comments: item.descendants || 0,
        excerpt: null,
        source: 'Hacker News',
        section: 'tech',
      }));

    console.log(`[hackernews] Fetched ${stories.length} stories`);
    return stories;
  } catch (err) {
    console.warn('[hackernews] Failed:', err.message);
    return [];
  }
}

module.exports = { fetchHackerNews };
