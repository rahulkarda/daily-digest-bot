'use strict';

const fetch = require('node-fetch');

async function fetchGitHubTrending(limit = 6) {
  try {
    // Use the GitHub Search API instead of scraping github.com/trending
    // (the trending page uses CSS selectors that break silently on HTML changes;
    // the search API is stable, versioned, and documented)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    const url = `https://api.github.com/search/repositories?q=created:>${cutoff}&sort=stars&order=desc&per_page=${limit}`;

    const headers = {
      'User-Agent': 'digest-bot/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers, timeout: 12000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON but got content-type: ${contentType}`);
    }

    const data = await res.json();
    const items = (data.items || []).slice(0, limit);

    const repos = items.map((repo) => ({
      title: repo.full_name,
      url: repo.html_url,
      score: repo.stargazers_count,
      starsToday: null, // Search API does not expose today-only stars
      language: repo.language || null,
      excerpt: repo.description || 'No description provided.',
      source: 'GitHub Trending',
      section: 'github',
    }));

    console.log(`[github] Fetched ${repos.length} trending repos`);
    return repos;
  } catch (err) {
    console.warn('[github] Failed to fetch trending:', err.message);
    return [];
  }
}

module.exports = { fetchGitHubTrending };
