// Vercel serverless function. Receives a Supabase Database Webhook fired
// on every INSERT into public.notifications (see
// supabase/migrations/025_real_notifications.sql) and emails the
// recipient a copy of it, if they've turned email notifications on.
//
// The trigger that inserts each notification row already looked up the
// recipient's notify_email preference and their address (should_email /
// recipient_email columns) — this function just trusts those, so it
// needs no privileged Supabase access of its own (no service-role key).
//
// Requires these Vercel environment variables:
//   NOTIFICATION_WEBHOOK_SECRET  - a random string you generate once;
//                                  set the same value as a custom header
//                                  when creating the webhook in Supabase
//                                  Dashboard -> Database -> Webhooks, so
//                                  this endpoint can trust the request
//                                  actually came from Supabase.
//   RESEND_API_KEY               - resend.com -> API Keys
//   NOTIFICATION_FROM_EMAIL      - optional, defaults to Resend's
//                                  no-setup sandbox sender, which only
//                                  delivers to the Resend account's own
//                                  email. Verify cookzer.com as a domain
//                                  in Resend and set this to something
//                                  like "Cookzer <notifications@cookzer.com>"
//                                  before real users' emails will arrive.

const DEFAULT_FROM = 'Cookzer <onboarding@resend.dev>';

const TYPE_SUBJECTS = {
  follow: 'You have a new follower on Cookzer',
  heart: 'Someone hearted your post',
  comment: 'New comment on your post',
  remake: 'Someone remade your recipe',
  challenge_join: 'Someone joined your challenge',
  message: 'New message on Cookzer',
  review: 'New review on your recipe',
  group_join: 'Someone joined your group',
};

// Mirrors the TYPE_EMOJI map in cookzer-notifications.html, so the email
// and the in-app notification list read as the same visual language.
const TYPE_EMOJI = {
  follow: '👋',
  heart: '❤️',
  comment: '💬',
  remake: '🍳',
  challenge_join: '🏆',
  message: '✉️',
  review: '⭐',
  group_join: '👥',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expectedSecret = process.env.NOTIFICATION_WEBHOOK_SECRET;
  const providedSecret = req.headers['x-webhook-secret'];
  if (!expectedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }

  const payload = req.body || {};
  const record = payload.record;
  if (payload.table !== 'notifications' || payload.type !== 'INSERT' || !record) {
    // Not an event we care about — acknowledge so Supabase doesn't retry.
    res.status(200).json({ skipped: true });
    return;
  }

  if (!record.should_email || !record.recipient_email) {
    res.status(200).json({ skipped: true, reason: 'email disabled or no address' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Email is not configured yet (missing RESEND_API_KEY).' });
    return;
  }

  const subject = TYPE_SUBJECTS[record.type] || 'New activity on Cookzer';
  const link = record.link_url ? 'https://cookzer.com/' + record.link_url : 'https://cookzer.com/cookzer-feed.html';
  const emoji = TYPE_EMOJI[record.type] || '🔔';
  const message = escapeHtml(record.message);

  // Table-based layout with inline styles throughout — Gmail/Outlook strip
  // <style> blocks and don't reliably support flex/grid, so this sticks to
  // the lowest-common-denominator approach real transactional email needs.
  // Colors match the site's own palette (styles.css / master-plan.html).
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Cookzer</title>
</head>
<body style="margin:0; padding:0; background-color:#F7F2E9;">
<span style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${message}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F2E9;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border:1px solid #E7DFCF; border-radius:16px;">
<tr><td style="padding:28px 32px 20px 32px; font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:700;">
<span style="color:#00733A;">Cook</span><span style="color:#CE2B37;">zer</span>
</td></tr>
<tr><td style="padding:0 32px;"><div style="height:1px; line-height:1px; font-size:1px; background-color:#E7DFCF;">&nbsp;</div></td></tr>
<tr><td style="padding:24px 32px 0 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="44" height="44" align="center" valign="middle" style="width:44px; height:44px; background-color:#F7F2E9; border-radius:22px; font-size:20px;">${emoji}</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; line-height:1.55; color:#2B2620;">
${message}
</td></tr>
<tr><td style="padding:22px 32px 32px 32px;">
<a href="${link}" style="display:inline-block; background-color:#009246; color:#FFFFFF; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; font-weight:600; text-decoration:none; padding:12px 26px; border-radius:10px;">Open on Cookzer</a>
</td></tr>
</table>
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; width:100%;">
<tr><td align="center" style="padding:20px 32px 0 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.7; color:#A69C89;">
You're getting this because email notifications are on for your Cookzer account.<br>
<a href="https://cookzer.com/cookzer-settings.html" style="color:#A69C89; text-decoration:underline;">Turn them off anytime in Settings</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${record.message}\n\nOpen on Cookzer: ${link}\n\nTurn off email notifications anytime in Settings: https://cookzer.com/cookzer-settings.html`;

  const sendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL || DEFAULT_FROM,
      to: record.recipient_email,
      subject,
      html,
      text,
    }),
  });

  if (!sendResp.ok) {
    const detail = await sendResp.text();
    res.status(502).json({ error: 'Could not send email', detail });
    return;
  }

  res.status(200).json({ sent: true });
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
