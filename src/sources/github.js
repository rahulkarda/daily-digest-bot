'use strict';

const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function fetchGitHubTrending(limit = 6) {
  try {
    const res = await fetch('https://github.com/trending?since=daily&spoken_language_code=en', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DailyDigestBot/1.0)',
        'Accept': 'text/html',
      },
      timeout: 12000,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const repos = [];

    $('article.Box-row').each((i, el) => {
      if (i >= limit) return false;

      const nameEl = $(el).find('h2 a');
      const fullName = nameEl.attr('href')?.replace(/^\//, '') || '';
      const [owner, name] = fullName.split('/');

      const description = $(el).find('p').text().trim() || 'No description provided.';
      const language = $(el).find('[itemprop="programmingLanguage"]').text().trim() || null;

      const starsText = $(el)
        .find('a[href$="/stargazers"]')
        .last()
        .text()
        .trim()
        .replace(/,/g, '');
      const totalStars = parseInt(starsText) || 0;

      const starsToday = $(el)
        .find('span.d-inline-block.float-sm-right')
        .text()
        .trim()
        .replace(/\s+/g, ' ');

      repos.push({
        title: `${owner}/${name}`,
        url: `https://github.com/${fullName}`,
        score: totalStars,
        starsToday: starsToday || null,
        language,
        excerpt: description,
        source: 'GitHub Trending',
        section: 'github',
      });
    });

    console.log(`[github] Fetched ${repos.length} trending repos`);
    return repos;
  } catch (err) {
    console.warn('[github] Failed to scrape trending:', err.message);
    return [];
  }
}

module.exports = { fetchGitHubTrending };
