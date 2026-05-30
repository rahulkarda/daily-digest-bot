'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { runDigest } = require('./src/digest');

const args = process.argv.slice(2);
const runNow = args.includes('--now');
const dryRun = args.includes('--dry') || args.includes('--dry-run');
const saveHtml = args.includes('--html');

// Parse send time from env (default 8:00am)
function parseSendTime(timeStr = '08:00') {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return { hour: 8, minute: 0 };
  return { hour: h, minute: m };
}

const { hour, minute } = parseSendTime(process.env.SEND_TIME);
const cronExpr = `${minute} ${hour} * * *`;

async function main() {
  if (runNow || dryRun) {
    console.log(`Running digest immediately (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    await runDigest({ dryRun, saveHtml: saveHtml || dryRun });
    if (!cron.validate(cronExpr)) process.exit(0);
    // Fall through to also start the scheduler if desired
    const keepAlive = args.includes('--keep');
    if (!keepAlive) process.exit(0);
  }

  if (!process.env.GMAIL_USER && !dryRun) {
    console.error('Error: GMAIL_USER not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  console.log(`Daily Digest Bot started. Will send every day at ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} local time.`);
  console.log(`Cron: ${cronExpr}`);
  console.log('Press Ctrl+C to stop.\n');

  cron.schedule(cronExpr, async () => {
    console.log(`[cron] Triggered at ${new Date().toLocaleTimeString()}`);
    try {
      await runDigest({ dryRun: false, saveHtml: false });
    } catch (err) {
      console.error('[cron] Digest run failed:', err.message);
    }
  });
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
