# Daily Digest Bot

A free, automated daily email digest that pulls top content from Reddit, Hacker News, and GitHub Trending — summarized by Gemini Flash AI — and sends a beautiful HTML email every morning.

**100% free.** No paid services required.

---

## What You Get

A daily email with:
- **⚡ Tech & Dev** — Top stories from Hacker News + r/programming + r/webdev
- **🤖 AI & ML** — Best from r/MachineLearning + r/artificial
- **🔬 Curiosity & Science** — r/todayilearned + r/science + r/explainlikeimfive
- **⭐ GitHub Trending** — Today's hottest repos with language + star count

Each story gets a 1-sentence AI summary powered by Gemini 1.5 Flash.

---

## Free Stack

| What | Service | Cost |
|------|---------|------|
| Reddit | Public JSON API (no auth) | Free |
| Hacker News | Firebase API | Free |
| GitHub Trending | HTML scrape | Free |
| AI summaries | Gemini 1.5 Flash | Free (1M tokens/day) |
| Email | Gmail + App Password | Free |
| Scheduling | node-cron (local) or GitHub Actions | Free |

---

## Setup (5 minutes)

### 1. Get a Gemini API Key (free)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy it — you'll need it in step 3

### 2. Get a Gmail App Password
1. Go to your [Google Account → Security](https://myaccount.google.com/security)
2. Make sure 2-Step Verification is **ON**
3. Search for **App passwords** → create one named "Digest Bot"
4. Copy the 16-character password (spaces don't matter)

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your keys
```

Fill in:
```
GEMINI_API_KEY=your_key_here
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
DIGEST_TO=you@gmail.com     # Can be same as GMAIL_USER
SEND_TIME=08:00             # When to send daily (local time)
```

### 4. Install and run
```bash
npm install

# Test immediately (saves HTML preview, doesn't send email)
node index.js --now --dry

# Send a real test email right now
node index.js --now

# Start the scheduler (runs daily at your SEND_TIME)
node index.js
```

---

## CLI Flags

| Flag | What it does |
|------|-------------|
| `--now` | Run immediately instead of waiting for cron |
| `--dry` or `--dry-run` | Fetch + summarize but don't send email |
| `--html` | Save `digest-preview.html` to disk |
| `--now --html` | Fetch + save HTML preview (great for testing the template) |

**Preview the email without any API keys:**
```bash
# No keys needed for preview — uses fallback data
node index.js --now --dry --html
open digest-preview.html
```

---

## Run in the Cloud (GitHub Actions)

For the digest to arrive even when your computer is off:

1. Push this repo to GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Add these secrets:
   - `GEMINI_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `DIGEST_TO`
4. Go to **Actions → Daily Digest → Run workflow** to test it

The workflow runs daily at 2:30am UTC (= 8am IST). Edit `.github/workflows/digest.yml` to change the time:
- 8am EST = `0 13 * * *`
- 8am PST = `0 16 * * *`
- 8am GMT = `0 8 * * *`
- 8am IST = `30 2 * * *`

GitHub Actions is free for public repos (and has 2000 free minutes/month for private repos — this uses ~2 min/day).

---

## Keep it Running Locally (optional)

Use `pm2` to keep the scheduler alive across reboots:
```bash
npm install -g pm2
pm2 start index.js --name digest-bot
pm2 startup   # auto-start on reboot
pm2 save
```

---

## Project Structure

```
digest-bot/
├── src/
│   ├── sources/
│   │   ├── reddit.js       # Reddit JSON API fetcher
│   │   ├── hackernews.js   # HN Firebase API fetcher
│   │   └── github.js       # GitHub Trending HTML scraper
│   ├── summarize.js        # Gemini Flash batch summarizer
│   ├── template.js         # HTML email renderer
│   ├── mailer.js           # Nodemailer Gmail sender
│   └── digest.js           # Main orchestrator
├── index.js                # Cron scheduler + CLI entry
├── .env.example            # Config template
└── .github/workflows/
    └── digest.yml          # GitHub Actions schedule
```
