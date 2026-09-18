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
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="font-size: 20px; font-weight: 600; color: #009C4A; margin-bottom: 16px;">Cookzer</div>
      <p style="font-size: 15px; color: #2B2620;">${escapeHtml(record.message)}</p>
      <a href="${link}" style="display: inline-block; margin-top: 12px; background: #009C4A; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Open on Cookzer</a>
      <p style="font-size: 12px; color: #6B6255; margin-top: 28px;">You're getting this because email notifications are on for your Cookzer account. Turn them off anytime in Settings.</p>
    </div>
  `;

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
