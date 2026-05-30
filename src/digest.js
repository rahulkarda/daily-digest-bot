'use strict';

const { fetchReddit } = require('./sources/reddit');
const { fetchHackerNews } = require('./sources/hackernews');
const { fetchGitHubTrending } = require('./sources/github');
const { summarizeAll } = require('./summarize');
const { renderEmail } = require('./template');
const { sendDigest } = require('./mailer');
const fs = require('fs');
const path = require('path');

async function runDigest({ dryRun = false, saveHtml = false } = {}) {
  const startTime = Date.now();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Daily Digest Bot — Starting run');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Fetch all sources in parallel
  console.log('[digest] Fetching all sources...');
  const [redditData, hnStories, githubRepos] = await Promise.all([
    fetchReddit(),
    fetchHackerNews(8),
    fetchGitHubTrending(6),
  ]);

  // 2. Merge HN into tech section (HN is tech-focused)
  const rawSections = {
    tech: [...hnStories, ...(redditData.tech || [])].slice(0, 10),
    ai: (redditData.ai || []).slice(0, 8),
    curiosity: (redditData.curiosity || []).slice(0, 8),
    github: githubRepos,
  };

  const totalRaw = Object.values(rawSections).reduce((s, arr) => s + arr.length, 0);
  console.log(`\n[digest] Raw items — Tech:${rawSections.tech.length} AI:${rawSections.ai.length} Curiosity:${rawSections.curiosity.length} GitHub:${rawSections.github.length}`);

  // 3. Summarize with Gemini (skip if no API key — use fallback summaries)
  let sections;
  if (process.env.GEMINI_API_KEY) {
    sections = await summarizeAll(rawSections);
  } else {
    console.warn('[digest] No GEMINI_API_KEY — using excerpts as summaries');
    sections = {
      tech: rawSections.tech.map((i) => ({ ...i, summary: i.excerpt || i.title })),
      ai: rawSections.ai.map((i) => ({ ...i, summary: i.excerpt || i.title })),
      curiosity: rawSections.curiosity.map((i) => ({ ...i, summary: i.excerpt || i.title })),
      github: rawSections.github.map((i) => ({ ...i, summary: i.excerpt || i.title })),
    };
  }

  const totalItems = Object.values(sections).reduce((s, arr) => s + arr.length, 0);

  // 4. Render HTML
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const html = renderEmail({ ...sections, date, totalItems });

  // 5. Optionally save HTML preview to disk
  if (saveHtml || process.env.SAVE_HTML === 'true') {
    const outPath = path.join(__dirname, '..', 'digest-preview.html');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[digest] HTML preview saved → ${outPath}`);
  }

  // 6. Send email (skip in dry run)
  if (dryRun) {
    console.log('\n[digest] DRY RUN — email not sent. Use SAVE_HTML=true to preview.');
  } else {
    await sendDigest(html, { date });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[digest] Done in ${elapsed}s — ${totalItems} items across ${Object.keys(sections).length} sections\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { totalItems, elapsed };
}

module.exports = { runDigest };
