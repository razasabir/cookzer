// Vercel serverless function. Fired by a pg_net trigger on every INSERT
// into public.notifications (see supabase/migrations/027_push_notifications.sql
// — same reason this isn't a Supabase Database Webhook as send-notification-email.js:
// this project's Database Webhooks dashboard feature is broken, see 026's comment).
//
// Sends a push notification via Firebase Cloud Messaging's HTTP v1 API.
// One FCM call reaches both the native Android app and any browser
// subscribed to web push — Firebase unifies delivery across platforms
// from a single registration token.
//
// The trigger that inserts each notification row already looked up the
// recipient's push_token and notify_push preference (should_push /
// push_token columns) — this function just trusts those, so it needs no
// privileged Supabase access of its own (no service-role key), same
// pattern as the email channel.
//
// Requires these Vercel environment variables:
//   NOTIFICATION_WEBHOOK_SECRET   - the same shared secret already set up
//                                   for the email channel's trigger.
//   FIREBASE_SERVICE_ACCOUNT_JSON - the full JSON key downloaded from
//                                   Firebase Console -> Project Settings ->
//                                   Service Accounts -> Generate new
//                                   private key, base64-encoded (its
//                                   project_id field is used directly, no
//                                   separate project ID var needed).
//                                   Base64, not raw JSON: private_key's
//                                   embedded \n newline escapes kept
//                                   getting mangled differently on every
//                                   attempt to paste raw JSON through a
//                                   clipboard and Vercel's env-var text
//                                   field (each attempt produced a
//                                   different variant of
//                                   "error:1E08010C:DECODER
//                                   routines::unsupported" /
//                                   ERR_OSSL_UNSUPPORTED from OpenSSL
//                                   failing to parse the resulting PEM).
//                                   Base64 has no newlines or special
//                                   characters for any of those hops to
//                                   corrupt. Raw JSON is still accepted
//                                   as a fallback for compatibility.
//
// Known limitation: an expired/invalid token isn't cleared from
// notification_prefs here (would need service-role write access this
// function deliberately avoids) — it just fails that one send. Re-toggling
// push in Settings registers a fresh token.

const { GoogleAuth } = require('google-auth-library');

function parseServiceAccount(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch (e) {
    return JSON.parse(trimmed);
  }
}

const TYPE_TITLES = {
  follow: 'New follower',
  heart: 'Someone hearted your post',
  comment: 'New comment',
  remake: 'Someone remade your recipe',
  challenge_join: 'Someone joined your challenge',
  message: 'New message',
  review: 'New review',
  group_join: 'Someone joined your group',
};

let cachedAuth = null;
function getAuth(credentials) {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }
  return cachedAuth;
}

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
    res.status(200).json({ skipped: true });
    return;
  }

  if (!record.should_push || !record.push_token) {
    res.status(200).json({ skipped: true, reason: 'push disabled or no token' });
    return;
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountRaw) {
    res.status(500).json({ error: 'Push is not configured yet (missing FIREBASE_SERVICE_ACCOUNT_JSON).' });
    return;
  }

  let projectId;
  let accessToken;
  try {
    const credentials = parseServiceAccount(serviceAccountRaw);
    // Cheap extra safety net for the raw-JSON fallback path — a no-op
    // against a base64-sourced key, which never has literal \n sequences
    // to begin with.
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    projectId = credentials.project_id;
    const client = await getAuth(credentials).getClient();
    const tokenResponse = await client.getAccessToken();
    accessToken = tokenResponse.token;
  } catch (err) {
    console.error('send-notification-push: Firebase auth failed:', err);
    res.status(500).json({ error: 'Could not authenticate with Firebase', detail: String(err) });
    return;
  }

  const title = TYPE_TITLES[record.type] || 'Cookzer';
  const link = record.link_url ? 'https://www.cookzer.com/' + record.link_url : 'https://www.cookzer.com/cookzer-feed.html';

  const sendResp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: record.push_token,
        notification: {
          title,
          body: record.message,
        },
        data: {
          link,
          type: record.type || '',
        },
        webpush: {
          fcm_options: { link },
          notification: { icon: 'https://www.cookzer.com/icon-192.png' },
        },
      },
    }),
  });

  if (!sendResp.ok) {
    const detail = await sendResp.text();
    console.error('send-notification-push: FCM send failed:', sendResp.status, detail);
    res.status(502).json({ error: 'Could not send push', detail });
    return;
  }

  res.status(200).json({ sent: true });
};
