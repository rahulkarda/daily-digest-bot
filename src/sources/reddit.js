'use strict';

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const SUBREDDITS = [
  { name: 'programming', section: 'tech', label: 'r/programming' },
  { name: 'MachineLearning', section: 'ai', label: 'r/MachineLearning' },
  { name: 'artificial', section: 'ai', label: 'r/artificial' },
  { name: 'todayilearned', section: 'curiosity', label: 'r/todayilearned' },
  { name: 'science', section: 'curiosity', label: 'r/science' },
  { name: 'ExplainBothSides', section: 'curiosity', label: 'r/ExplainBothSides' },
];

// Mimic a real browser to avoid 403 blocks
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch top posts via old.reddit.com JSON (more lenient than www.reddit.com)
async function fetchSubredditJSON(subreddit) {
  const url = `https://old.reddit.com/r/${subreddit.name}/top.json?t=day&limit=10`;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, timeout: 12000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    return json.data.children
      .map((c) => c.data)
      .filter((p) => !p.stickied && p.score > 30)
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

// RSS fallback — no auth, more reliable
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
      // Extract score from content HTML if available
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

  // Sequential with small delay to be polite and avoid rate limits
  for (const subreddit of SUBREDDITS) {
    const posts = await fetchSubredditJSON(subreddit);
    results.push(...posts);
    await delay(400);
  }

  // Group by section
  const bySection = { tech: [], ai: [], curiosity: [] };
  for (const item of results) {
    if (bySection[item.section]) bySection[item.section].push(item);
  }

  // Cap each section
  for (const key of Object.keys(bySection)) {
    bySection[key] = bySection[key].slice(0, 8);
  }

  const total = Object.values(bySection).reduce((s, a) => s + a.length, 0);
  console.log(`[reddit] Fetched ${total} posts across ${SUBREDDITS.length} subreddits`);
  return bySection;
}

module.exports = { fetchReddit };
