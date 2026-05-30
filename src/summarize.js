'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;

function getClient() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Summarize a batch of items from one section in a single API call
async function summarizeBatch(items, sectionLabel) {
  if (!items.length) return items;

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const itemList = items
      .map((item, i) => `${i + 1}. TITLE: "${item.title}"\n   EXCERPT: "${item.excerpt || 'No excerpt'}"`)
      .join('\n\n');

    const prompt = `You are summarizing top stories for a daily digest email.

Below are ${items.length} posts from ${sectionLabel}. For EACH item, write a single engaging sentence (max 25 words) that captures the key insight or why it matters. Be direct and informative — no filler words.

${itemList}

Respond with ONLY a JSON array of strings, one summary per item, in the same order. Example:
["Summary for item 1.", "Summary for item 2.", "Summary for item 3."]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const summaries = JSON.parse(match[0]);

    return items.map((item, i) => ({
      ...item,
      summary: summaries[i] || item.excerpt?.slice(0, 120) || item.title,
    }));
  } catch (err) {
    console.warn(`[summarize] Gemini failed for ${sectionLabel}:`, err.message);
    // Graceful fallback: use excerpt or title
    return items.map((item) => ({
      ...item,
      summary: item.excerpt?.slice(0, 150) || item.title,
    }));
  }
}

// Summarize for GitHub repos (different prompt tone)
async function summarizeGitHub(repos) {
  if (!repos.length) return repos;

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const itemList = repos
      .map((r, i) => `${i + 1}. REPO: "${r.title}"\n   DESCRIPTION: "${r.excerpt || 'No description'}"`)
      .join('\n\n');

    const prompt = `Summarize these GitHub trending repos for developers in a daily digest.

For each repo, write one sentence (max 20 words) explaining what it does and why devs should care.

${itemList}

Respond with ONLY a JSON array of strings in the same order.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const summaries = JSON.parse(match[0]);
    return repos.map((repo, i) => ({
      ...repo,
      summary: summaries[i] || repo.excerpt?.slice(0, 120) || repo.title,
    }));
  } catch (err) {
    console.warn('[summarize] Gemini failed for GitHub:', err.message);
    return repos.map((r) => ({ ...r, summary: r.excerpt?.slice(0, 150) || r.title }));
  }
}

// Main: summarize all sections with a small delay between calls to respect RPM
async function summarizeAll(sections) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('[summarize] Calling Gemini Flash...');

  const [ai_models, ai_news, til] = await Promise.allSettled([
    summarizeBatch(sections.ai_models, 'AI Models & Research (r/LocalLLaMA, r/MachineLearning)'),
    (async () => { await delay(500); return summarizeBatch(sections.ai_news, 'AI News & Lab Updates (r/singularity, r/OpenAI, r/ClaudeAI, r/Gemini)'); })(),
    (async () => { await delay(1000); return summarizeBatch(sections.til, 'Today I Learned & Fascinating Discoveries'); })(),
  ]);

  return {
    ai_models: ai_models.status === 'fulfilled' ? ai_models.value : sections.ai_models,
    ai_news: ai_news.status === 'fulfilled' ? ai_news.value : sections.ai_news,
    til: til.status === 'fulfilled' ? til.value : sections.til,
  };
}

module.exports = { summarizeAll };
