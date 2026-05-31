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
const timezone = process.env.SEND_TIMEZONE || 'UTC';

async function main() {
  // Validate credentials before attempting any send (even --now without --dry)
  if (!dryRun) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('Error: GMAIL_USER and GMAIL_APP_PASSWORD must both be set in .env');
      process.exit(1);
    }
  }

  if (runNow || dryRun) {
    console.log(`Running digest immediately (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    await runDigest({ dryRun, saveHtml: saveHtml || dryRun });
    if (!cron.validate(cronExpr)) process.exit(0);
    // Fall through to also start the scheduler if desired
    const keepAlive = args.includes('--keep');
    if (!keepAlive) process.exit(0);
  }

  console.log(`Daily Digest Bot started. Will send every day at ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} (timezone: ${timezone}).`);
  console.log(`Cron: ${cronExpr}`);
  console.log('Press Ctrl+C to stop.\n');

  const task = cron.schedule(cronExpr, async () => {
    console.log(`[cron] Triggered at ${new Date().toLocaleTimeString()}`);
    try {
      await runDigest({ dryRun: false, saveHtml: false });
    } catch (err) {
      console.error('[cron] Digest run failed:', err.message);
    }
  }, { timezone });

  // Graceful shutdown
  function shutdown() {
    console.log('\n[bot] Shutting down gracefully...');
    task.stop();
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
