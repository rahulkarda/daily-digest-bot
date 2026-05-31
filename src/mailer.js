'use strict';

const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env');
    }
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendDigest(html, { subject, date } = {}) {
  const { GMAIL_USER, DIGEST_TO } = process.env;
  const to = DIGEST_TO || GMAIL_USER;
  const dateStr = date || new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const mailOptions = {
    from: `"Daily Digest" <${GMAIL_USER}>`,
    to,
    subject: subject || `Your Daily Digest — ${dateStr}`,
    html,
    // Plain text fallback
    text: 'Your daily digest is ready. Please view this email in an HTML-capable client.',
  };

  const transport = getTransporter();
  let info;
  try {
    info = await transport.sendMail(mailOptions);
  } catch (err) {
    // Invalidate the cached transporter so the next run re-creates it
    // (prevents a bad-credentials failure from persisting across cron runs)
    transporter = null;
    throw err;
  }
  // Log message ID only — avoid writing the recipient address to stdout
  console.log(`[mailer] Email sent — Message ID: ${info.messageId}`);
  return info;
}

module.exports = { sendDigest };
