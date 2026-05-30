'use strict';

const SECTIONS_CONFIG = {
  tech: { label: 'Tech & Dev', emoji: '⚡', color: '#3B82F6', light: '#EFF6FF', border: '#BFDBFE' },
  ai: { label: 'AI & Machine Learning', emoji: '🤖', color: '#8B5CF6', light: '#F5F3FF', border: '#DDD6FE' },
  curiosity: { label: 'Curiosity & Science', emoji: '🔬', color: '#10B981', light: '#ECFDF5', border: '#A7F3D0' },
  github: { label: 'GitHub Trending', emoji: '⭐', color: '#F59E0B', light: '#FFFBEB', border: '#FDE68A' },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatScore(item) {
  if (item.section === 'github') {
    return item.starsToday ? `★ ${item.starsToday}` : `★ ${item.score.toLocaleString()} total`;
  }
  return `↑ ${item.score.toLocaleString()}${item.comments ? ` · ${item.comments} comments` : ''}`;
}

function renderItem(item, cfg) {
  const score = formatScore(item);
  const langBadge = item.language
    ? `<span style="background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:6px;">${escapeHtml(item.language)}</span>`
    : '';

  return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#FFFFFF;border:1px solid #F0F0F0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;">
              <!-- Title -->
              <a href="${escapeHtml(item.url)}"
                style="color:#111827;font-size:15px;font-weight:600;text-decoration:none;line-height:1.4;display:block;margin-bottom:6px;">
                ${escapeHtml(item.title)}
              </a>
              <!-- Summary -->
              <p style="color:#4B5563;font-size:13px;line-height:1.6;margin:0 0 10px 0;">
                ${escapeHtml(item.summary || item.excerpt || '')}
              </p>
              <!-- Meta row -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="background:${cfg.light};color:${cfg.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid ${cfg.border};">
                      ${escapeHtml(item.source)}
                    </span>
                    ${langBadge}
                  </td>
                  <td align="right" style="color:#9CA3AF;font-size:11px;white-space:nowrap;">
                    ${escapeHtml(score)}
                    ${item.section !== 'github' ? `&nbsp;·&nbsp;<a href="${escapeHtml(item.permalink || item.url)}" style="color:#9CA3AF;text-decoration:none;">discuss</a>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderSection(items, sectionKey) {
  if (!items || items.length === 0) return '';
  const cfg = SECTIONS_CONFIG[sectionKey];

  const itemRows = items.map((item) => renderItem(item, cfg)).join('');

  return `
    <!-- Section: ${cfg.label} -->
    <tr>
      <td style="padding:8px 0 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:12px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${cfg.color};width:4px;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:12px;">
                    <span style="font-size:18px;font-weight:700;color:#111827;">
                      ${cfg.emoji} ${cfg.label}
                    </span>
                    <span style="color:#9CA3AF;font-size:13px;margin-left:8px;">${items.length} stories</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${itemRows}
        </table>
      </td>
    </tr>
    <!-- Divider -->
    <tr><td style="border-top:1px solid #F3F4F6;padding-bottom:24px;"></td></tr>`;
}

function renderEmail({ tech = [], ai = [], curiosity = [], github = [], date, totalItems }) {
  const dateStr = date || new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const techSection = renderSection(tech, 'tech');
  const aiSection = renderSection(ai, 'ai');
  const curiositySection = renderSection(curiosity, 'curiosity');
  const githubSection = renderSection(github, 'github');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Daily Digest — ${dateStr}</title>
  <style>
    body { margin:0; padding:0; background:#F9FAFB; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    a { color: inherit; }
    @media (max-width: 600px) {
      .container { width: 100% !important; padding: 0 12px !important; }
      .header-pad { padding: 28px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F9FAFB">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Container -->
        <table class="container" width="620" cellpadding="0" cellspacing="0" border="0"
          style="max-width:620px;width:100%;">

          <!-- Header -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#1E3A5F 100%);border-radius:16px;overflow:hidden;margin-bottom:20px;">
                <tr>
                  <td class="header-pad" style="padding:36px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <p style="color:rgba(255,255,255,0.6);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px 0;">
                            DAILY DIGEST
                          </p>
                          <h1 style="color:#FFFFFF;font-size:28px;font-weight:800;margin:0 0 6px 0;line-height:1.2;">
                            Your Morning Briefing
                          </h1>
                          <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">
                            ${dateStr}
                          </p>
                        </td>
                        <td align="right" valign="top">
                          <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;text-align:center;display:inline-block;">
                            <p style="color:#FFFFFF;font-size:28px;font-weight:800;margin:0;line-height:1;">${totalItems || 0}</p>
                            <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:4px 0 0 0;font-weight:500;">STORIES</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <!-- Section pills -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                      <tr>
                        ${tech.length ? '<td style="padding-right:8px;"><span style="background:rgba(59,130,246,0.3);color:#93C5FD;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(59,130,246,0.4);">⚡ Tech</span></td>' : ''}
                        ${ai.length ? '<td style="padding-right:8px;"><span style="background:rgba(139,92,246,0.3);color:#C4B5FD;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(139,92,246,0.4);">🤖 AI/ML</span></td>' : ''}
                        ${curiosity.length ? '<td style="padding-right:8px;"><span style="background:rgba(16,185,129,0.3);color:#6EE7B7;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(16,185,129,0.4);">🔬 Curiosity</span></td>' : ''}
                        ${github.length ? '<td><span style="background:rgba(245,158,11,0.3);color:#FCD34D;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(245,158,11,0.4);">⭐ GitHub</span></td>' : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <tr>
                  <td style="padding:28px 28px 12px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">

                      ${techSection}
                      ${aiSection}
                      ${curiositySection}
                      ${githubSection}

                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 8px 0;text-align:center;">
              <p style="color:#9CA3AF;font-size:12px;margin:0 0 4px 0;">
                Your Daily Digest · Powered by Gemini Flash + Reddit + HN + GitHub
              </p>
              <p style="color:#D1D5DB;font-size:11px;margin:0;">
                Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                · This is an automated digest
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail };
