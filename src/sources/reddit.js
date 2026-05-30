'use strict';

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const SUBREDDITS = [
  // AI & Models — technical, local models, research
  { name: 'LocalLLaMA',      section: 'ai_models',  label: 'r/LocalLLaMA' },
  { name: 'MachineLearning', section: 'ai_models',  label: 'r/MachineLearning' },
  { name: 'artificial',      section: 'ai_models',  label: 'r/artificial' },

  // AI News & Labs — announcements, releases, trending discussions
  { name: 'singularity',     section: 'ai_news',    label: 'r/singularity' },
  { name: 'AINews',          section: 'ai_news',    label: 'r/AINews' },
  { name: 'OpenAI',          section: 'ai_news',    label: 'r/OpenAI' },
  { name: 'ClaudeAI',        section: 'ai_news',    label: 'r/ClaudeAI' },
  { name: 'Gemini',          section: 'ai_news',    label: 'r/Gemini' },

  // TIL & Curiosity — fascinating daily discoveries
  { name: 'todayilearned',          section: 'til', label: 'r/todayilearned' },
  { name: 'Damnthatsinteresting',   section: 'til', label: 'r/Damnthatsinteresting' },
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSubredditJSON(subreddit) {
  const url = `https://old.reddit.com/r/${subreddit.name}/top.json?t=day&limit=10`;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, timeout: 12000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    return json.data.children
      .map((c) => c.data)
      .filter((p) => !p.stickied && p.score > 20)
      .slice(0, 6)
      .map((p) => ({
        title: p.title,
        url: p.url?.startsWith('/r/') ? `https://reddit.com${p.url}` : (p.url || `https://reddit.com${p.permalink}`),
        permalink: `https://reddit.com${p.permalink}`,
        score: p.score,
        comments: p.num_comments,
        excerpt: (p.selftext || '').slice(0, 250).trim() || null,
        source: subreddit.label,
        section: subreddit.section,
      }));
  } catch (err) {
    console.warn(`[reddit] JSON failed for r/${subreddit.name} (${err.message}), trying RSS...`);
    return fetchSubredditRSS(subreddit);
  }
}

async function fetchSubredditRSS(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit.name}/top.rss?t=day&limit=8`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DailyDigestBot/1.0' },
      timeout: 10000,
    });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const items = [];
    $('entry').each((i, el) => {
      if (i >= 6) return false;
      const title = $(el).find('title').first().text().trim();
      const link = $(el).find('link').attr('href') || '';
      const content = $(el).find('content').text();
      const scoreMatch = content.match(/(\d+)\s+point/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

      if (title && link) {
        items.push({
          title,
          url: link,
          permalink: link,
          score,
          comments: 0,
          excerpt: null,
          source: subreddit.label,
          section: subreddit.section,
        });
      }
    });

    return items;
  } catch (err) {
    console.warn(`[reddit] RSS also failed for r/${subreddit.name}:`, err.message);
    return [];
  }
}

async function fetchReddit() {
  const results = [];

  for (const subreddit of SUBREDDITS) {
    const posts = await fetchSubredditJSON(subreddit);
    results.push(...posts);
    await delay(300);
  }

  const bySection = { ai_models: [], ai_news: [], til: [] };
  for (const item of results) {
    if (bySection[item.section]) bySection[item.section].push(item);
  }

  // Sort by score descending, cap each section
  for (const key of Object.keys(bySection)) {
    bySection[key] = bySection[key]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  const total = Object.values(bySection).reduce((s, a) => s + a.length, 0);
  console.log(`[reddit] Fetched ${total} posts across ${SUBREDDITS.length} subreddits`);
  return bySection;
}

module.exports = { fetchReddit };
