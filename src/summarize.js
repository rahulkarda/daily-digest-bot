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

// Sanitize a string for safe interpolation into a prompt:
// strip newlines and bare quotes that could break delimiter boundaries
function sanitizeForPrompt(str) {
  if (!str) return '';
  return String(str).replace(/[\r\n]+/g, ' ').replace(/"/g, "'");
}

// Summarize a batch of items from one section in a single API call
async function summarizeBatch(items, sectionLabel) {
  if (!items.length) return items;

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const itemList = items
      .map((item, i) => `${i + 1}. TITLE: "${sanitizeForPrompt(item.title)}"\n   EXCERPT: "${sanitizeForPrompt(item.excerpt || 'No excerpt')}"`)
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

    if (summaries.length !== items.length) {
      console.warn(`[summarize] Length mismatch for ${sectionLabel}: expected ${items.length}, got ${summaries.length}. Falling back for missing items.`);
    }

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
      .map((r, i) => `${i + 1}. REPO: "${sanitizeForPrompt(r.title)}"\n   DESCRIPTION: "${sanitizeForPrompt(r.excerpt || 'No description')}"`)
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

    if (summaries.length !== repos.length) {
      console.warn(`[summarize] Length mismatch for GitHub: expected ${repos.length}, got ${summaries.length}. Falling back for missing items.`);
    }

    return repos.map((repo, i) => ({
      ...repo,
      summary: summaries[i] || repo.excerpt?.slice(0, 120) || repo.title,
    }));
  } catch (err) {
    console.warn('[summarize] Gemini failed for GitHub:', err.message);
    return repos.map((r) => ({ ...r, summary: r.excerpt?.slice(0, 150) || r.title }));
  }
}

// Generate a top-3 TL;DR across all sections
async function generateTldr(sections) {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const allItems = [
      ...sections.ai_models,
      ...sections.ai_news,
      ...sections.til,
    ];

    const itemList = allItems
      .map((item, i) => `${i + 1}. [${item.source}] "${sanitizeForPrompt(item.title)}" — ${sanitizeForPrompt(item.summary || item.excerpt || '')}`)
      .join('\n');

    const prompt = `You are an editor writing a quick TL;DR for a daily digest email.

From these ${allItems.length} stories, pick the 3 most interesting and write a punchy one-sentence highlight for each. Lead with what makes it exciting. Be specific, not generic.

${itemList}

Respond with ONLY a JSON array of exactly 3 strings. Example:
["Highlight 1.", "Highlight 2.", "Highlight 3."]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const picks = JSON.parse(match[0]);
    return picks.slice(0, 3);
  } catch (err) {
    console.warn('[summarize] TL;DR generation failed:', err.message);
    return null;
  }
}

// Main: summarize all sections sequentially with delays between calls to
// enforce minimum inter-call gaps (staggered Promise.allSettled only controls
// start time, not completion gaps)
async function summarizeAll(sections) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('[summarize] Calling Gemini Flash...');

  const ai_modelsResult = await summarizeBatch(
    sections.ai_models,
    'AI Models & Research (r/LocalLLaMA, r/MachineLearning)',
  );
  await delay(500);

  const ai_newsResult = await summarizeBatch(
    sections.ai_news,
    'AI News & Lab Updates (r/singularity, r/OpenAI, r/ClaudeAI, r/Gemini)',
  );
  await delay(500);

  const tilResult = await summarizeBatch(
    sections.til,
    'Today I Learned & Fascinating Discoveries',
  );

  await delay(500);
  const tldr = await generateTldr({ ai_models: ai_modelsResult, ai_news: ai_newsResult, til: tilResult });

  return {
    ai_models: ai_modelsResult,
    ai_news: ai_newsResult,
    til: tilResult,
    tldr,
  };
}

module.exports = { summarizeAll, generateTldr };
