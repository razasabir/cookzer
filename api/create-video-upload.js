// Vercel serverless function. Mints a short-lived, signed TUS upload
// credential for Bunny Stream so a logged-in user's browser can upload a
// video directly to Bunny (no relay through this function, no size/time
// limit imposed by a serverless function's payload/duration limits).
//
// Requires these Vercel environment variables (server-side only, never
// exposed to the client):
//   BUNNY_STREAM_API_KEY  - the video library's API key (bunny.net
//                            dashboard -> Stream -> your library -> API)
//   BUNNY_LIBRARY_ID      - same numeric library ID as bunny-config.js
//
// Docs: https://docs.bunny.net/stream/tus-resumable-uploads

const crypto = require('crypto');

const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }

  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    res.status(500).json({ error: 'Video uploads are not configured yet.' });
    return;
  }

  const title = (req.body && req.body.title) || 'Cookzer video';

  const createResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!createResp.ok) {
    const detail = await createResp.text();
    res.status(502).json({ error: 'Could not create video on Bunny Stream', detail });
    return;
  }
  const created = await createResp.json();
  const videoId = created.guid;

  const expire = Math.floor(Date.now() / 1000) + 3600; // 1 hour, per Bunny's docs
  const signature = crypto
    .createHash('sha256')
    .update(libraryId + apiKey + expire + videoId)
    .digest('hex');

  res.status(200).json({
    videoId,
    libraryId,
    authorizationSignature: signature,
    authorizationExpire: expire,
  });
};
