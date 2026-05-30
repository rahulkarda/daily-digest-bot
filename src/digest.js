'use strict';

const { fetchReddit } = require('./sources/reddit');
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

  // 1. Fetch Reddit only
  console.log('[digest] Fetching Reddit sources...');
  const redditData = await fetchReddit();

  const rawSections = {
    ai_models: (redditData.ai_models || []).slice(0, 3),
    ai_news:   (redditData.ai_news   || []).slice(0, 3),
    til:       (redditData.til       || []).slice(0, 3),
  };

  const totalRaw = Object.values(rawSections).reduce((s, arr) => s + arr.length, 0);
  console.log(`\n[digest] Raw items — AI Models:${rawSections.ai_models.length} AI News:${rawSections.ai_news.length} TIL:${rawSections.til.length} (total ${totalRaw})`);

  // 2. Summarize with Gemini
  let sections;
  if (process.env.GEMINI_API_KEY) {
    sections = await summarizeAll(rawSections);
  } else {
    console.warn('[digest] No GEMINI_API_KEY — using excerpts as summaries');
    sections = {
      ai_models: rawSections.ai_models.map((i) => ({ ...i, summary: i.excerpt || i.title })),
      ai_news:   rawSections.ai_news.map((i)   => ({ ...i, summary: i.excerpt || i.title })),
      til:       rawSections.til.map((i)       => ({ ...i, summary: i.excerpt || i.title })),
    };
  }

  const totalItems = Object.values(sections).reduce((s, arr) => s + arr.length, 0);

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

  // 5. Send email
  if (dryRun) {
    console.log('\n[digest] DRY RUN — email not sent.');
  } else {
    await sendDigest(html, { date });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[digest] Done in ${elapsed}s — ${totalItems} items across 3 sections\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { totalItems, elapsed };
}

module.exports = { runDigest };
