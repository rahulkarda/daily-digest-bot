'use strict';

const https = require('https');

const BRANCH = 'gh-pages';
const REPO_OWNER = process.env.GH_PAGES_OWNER || process.env.GITHUB_REPOSITORY_OWNER || '';
const REPO_NAME = process.env.GH_PAGES_REPO || (process.env.GITHUB_REPOSITORY || '').split('/')[1] || 'daily-digest-bot';
const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'daily-digest-bot/1.0',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`GitHub API ${method} ${path} → ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getFileSha(filePath) {
  const owner = REPO_OWNER;
  const repo = REPO_NAME;
  const result = await ghRequest('GET', `/repos/${owner}/${repo}/contents/${filePath}?ref=${BRANCH}`);
  return result ? result.sha : null;
}

async function putFile(filePath, content, message, sha) {
  const owner = REPO_OWNER;
  const repo = REPO_NAME;
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  return ghRequest('PUT', `/repos/${owner}/${repo}/contents/${filePath}`, body);
}

// Returns ISO date string YYYY-MM-DD in the machine's local timezone
function todaySlug() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function loadArchiveIndex() {
  const owner = REPO_OWNER;
  const repo = REPO_NAME;
  const result = await ghRequest('GET', `/repos/${owner}/${repo}/contents/archive-index.json?ref=${BRANCH}`);
  if (!result) return { entries: [], sha: null };
  const content = Buffer.from(result.content, 'base64').toString('utf8');
  return { entries: JSON.parse(content), sha: result.sha };
}

async function saveArchiveIndex(entries, sha) {
  const content = JSON.stringify(entries, null, 2);
  await putFile('archive-index.json', content, 'chore: update digest archive index', sha);
}

function buildIndexPage(entries) {
  const rows = entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => `
      <li class="entry" data-title="${e.title.toLowerCase()}" data-date="${e.date}">
        <a href="${e.file}" class="entry-link">
          <span class="entry-date">${e.date}</span>
          <span class="entry-title">${e.title}</span>
          <span class="entry-meta">${e.items} stories</span>
        </a>
      </li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest Archive</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #F9FAFB;
      color: #111827;
      min-height: 100vh;
    }
    header {
      background: linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5F 100%);
      padding: 48px 24px;
      text-align: center;
    }
    header h1 {
      color: #fff;
      font-size: 2.2rem;
      font-weight: 800;
      margin-bottom: 8px;
    }
    header p { color: rgba(255,255,255,0.65); font-size: 1rem; }
    .search-bar {
      max-width: 600px;
      margin: -28px auto 0;
      padding: 0 16px;
      position: relative;
      z-index: 10;
    }
    .search-bar input {
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      border: none;
      font-size: 1rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      outline: none;
    }
    .search-bar input:focus { box-shadow: 0 4px 16px rgba(99,102,241,0.3); }
    main { max-width: 700px; margin: 40px auto; padding: 0 16px 64px; }
    .count { color: #6B7280; font-size: 0.85rem; margin-bottom: 16px; }
    ul { list-style: none; }
    .entry { margin-bottom: 10px; }
    .entry-link {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #fff;
      border-radius: 12px;
      padding: 16px 20px;
      text-decoration: none;
      color: inherit;
      border: 1px solid #E5E7EB;
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .entry-link:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #C7D2FE; }
    .entry-date {
      font-size: 0.8rem;
      color: #6B7280;
      white-space: nowrap;
      min-width: 90px;
    }
    .entry-title { flex: 1; font-size: 0.95rem; font-weight: 600; }
    .entry-meta {
      font-size: 0.75rem;
      color: #9CA3AF;
      white-space: nowrap;
      background: #F3F4F6;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .hidden { display: none !important; }
    .no-results { text-align: center; color: #9CA3AF; padding: 48px 0; font-size: 1rem; }
  </style>
</head>
<body>
  <header>
    <h1>Daily Digest Archive</h1>
    <p>Your searchable history — every digest, all in one place.</p>
  </header>
  <div class="search-bar">
    <input type="search" id="search" placeholder="Search digests by date or keyword..." autocomplete="off">
  </div>
  <main>
    <p class="count" id="count">${entries.length} digest${entries.length !== 1 ? 's' : ''}</p>
    <ul id="list">
      ${rows}
    </ul>
    <p class="no-results hidden" id="no-results">No digests match your search.</p>
  </main>
  <script>
    const input = document.getElementById('search');
    const list = document.getElementById('list');
    const countEl = document.getElementById('count');
    const noResults = document.getElementById('no-results');
    const items = Array.from(list.querySelectorAll('.entry'));
    const total = items.length;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      items.forEach((li) => {
        const match = !q || li.dataset.title.includes(q) || li.dataset.date.includes(q);
        li.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      countEl.textContent = q
        ? visible + ' result' + (visible !== 1 ? 's' : '') + ' for "' + input.value.trim() + '"'
        : total + ' digest' + (total !== 1 ? 's' : '');
      noResults.classList.toggle('hidden', visible > 0);
    });
  </script>
</body>
</html>`;
}

function buildDigestPage(html, dateStr) {
  // The existing email HTML is self-contained — wrap it in a minimal page shell
  // that adds a back-to-archive nav bar and ensures web-browser rendering.
  return html.replace(
    '</body>',
    `
  <div style="position:fixed;bottom:20px;right:20px;z-index:999;">
    <a href="index.html"
      style="display:inline-flex;align-items:center;gap:8px;background:#312E81;color:#fff;
             padding:10px 18px;border-radius:24px;text-decoration:none;font-size:13px;
             font-weight:600;box-shadow:0 4px 12px rgba(49,46,129,0.4);">
      ← Archive
    </a>
  </div>
</body>`
  );
}

async function archiveDigest({ html, dateStr, totalItems }) {
  if (!GH_TOKEN) {
    console.warn('[archiver] No GITHUB_TOKEN / GH_TOKEN — skipping archive push.');
    return;
  }
  if (!REPO_OWNER || !REPO_NAME) {
    console.warn('[archiver] Cannot determine repo owner/name — set GH_PAGES_OWNER / GH_PAGES_REPO or run inside GitHub Actions.');
    return;
  }

  const slug = todaySlug();
  const filePath = `digests/${slug}.html`;
  const pageHtml = buildDigestPage(html, dateStr);

  console.log(`[archiver] Pushing digest → ${BRANCH}:${filePath}`);

  // Check if file already exists (idempotent — update it if so)
  const existingSha = await getFileSha(filePath);
  await putFile(filePath, pageHtml, `feat: add digest ${slug}`, existingSha);

  // Update archive index
  const { entries, sha: indexSha } = await loadArchiveIndex();
  const existing = entries.findIndex((e) => e.date === slug);
  const entry = { date: slug, file: filePath, title: `Daily Digest — ${dateStr}`, items: totalItems };
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  await saveArchiveIndex(entries, indexSha);

  // Rebuild and push the index page
  const indexHtml = buildIndexPage(entries);
  const idxSha = await getFileSha('index.html');
  await putFile('index.html', indexHtml, `chore: rebuild archive index for ${slug}`, idxSha);

  console.log(`[archiver] Done. Archive updated with ${entries.length} total digest(s).`);
}

module.exports = { archiveDigest };
