'use strict';

const { fetchReddit } = require('./sources/reddit');
const { fetchHackerNews } = require('./sources/hackernews');
const { fetchGitHubTrending } = require('./sources/github');
const { summarizeAll } = require('./summarize');
const { renderEmail } = require('./template');
const { sendDigest } = require('./mailer');
const { archiveDigest } = require('./archiver');
const fs = require('fs');
const path = require('path');

async function runDigest({ dryRun = false, saveHtml = false } = {}) {
  const startTime = Date.now();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Daily Digest Bot — Starting run');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Fetch all sources in parallel; Reddit 403/429 is expected — HN + GitHub are the fallback
  console.log('[digest] Fetching all sources...');
  const [redditData, hnItems, ghItems] = await Promise.all([
    fetchReddit(),
    fetchHackerNews(8),
    fetchGitHubTrending(6),
  ]);

  // Reddit fills ai_models/ai_news/til; HN fills tech if Reddit is empty; GitHub fills github section
  const ai_models = (redditData.ai_models || []).slice(0, 4);
  const ai_news   = (redditData.ai_news   || []).slice(0, 4);
  const til       = (redditData.til       || []).slice(0, 4);

  // If Reddit is fully blocked, fall back to HN for tech stories
  const tech = ai_models.length === 0 && ai_news.length === 0
    ? hnItems.slice(0, 6)
    : hnItems.slice(0, 3);

  const github = ghItems.slice(0, 4);

  const rawSections = { ai_models, ai_news, til, tech, github };

  const totalRaw = Object.values(rawSections).reduce((s, arr) => s + arr.length, 0);
  console.log(
    `\n[digest] Raw items — AI Models:${ai_models.length} AI News:${ai_news.length} TIL:${til.length} HN:${tech.length} GitHub:${github.length} (total ${totalRaw})`,
  );

  // 2. Summarize with Gemini
  let sections;
  if (process.env.GEMINI_API_KEY) {
    sections = await summarizeAll(rawSections);
  } else {
    console.warn('[digest] No GEMINI_API_KEY — using excerpts as summaries');
    sections = {
      ai_models: ai_models.map((i) => ({ ...i, summary: i.excerpt || i.title })),
      ai_news:   ai_news.map((i)   => ({ ...i, summary: i.excerpt || i.title })),
      til:       til.map((i)       => ({ ...i, summary: i.excerpt || i.title })),
      tech:      tech.map((i)      => ({ ...i, summary: i.excerpt || i.title })),
      github:    github.map((i)    => ({ ...i, summary: i.excerpt || i.title })),
      tldr:      null,
    };
  }

  const totalItems = [sections.ai_models, sections.ai_news, sections.til, sections.tech, sections.github]
    .reduce((s, arr) => s + (arr || []).length, 0);

  // Guard: skip send if all sources returned nothing
  if (totalItems === 0) {
    console.error('[digest] All sources returned 0 items — skipping send to avoid blank email.');
    return { totalItems: 0, elapsed: ((Date.now() - startTime) / 1000).toFixed(1) };
  }

  // 3. Render HTML
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const html = renderEmail({ ...sections, date, totalItems });

  // 4. Optionally save HTML preview
  if (saveHtml || process.env.SAVE_HTML === 'true') {
    const outPath = path.join(__dirname, '..', 'digest-preview.html');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[digest] HTML preview saved → ${outPath}`);
  }

  // 5. Push to GitHub Pages archive (best-effort; failures don't abort the email send)
  if (!dryRun) {
    try {
      await archiveDigest({ html, dateStr: date, totalItems });
    } catch (err) {
      console.error('[digest] Archive push failed (non-fatal):', err.message);
    }
  }

  // 6. Send email
  if (dryRun) {
    console.log('\n[digest] DRY RUN — email not sent.');
  } else {
    await sendDigest(html, { date });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[digest] Done in ${elapsed}s — ${totalItems} items across sections\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { totalItems, elapsed };
}

module.exports = { runDigest };
