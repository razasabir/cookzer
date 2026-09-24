// Vercel serverless function. Lets a platform admin "log in as" another
// user for support purposes, by minting a real Supabase magic-link sign-in
// for the target account.
//
// Requires this Vercel environment variable (server-side only, never
// exposed to the client):
//   SUPABASE_SERVICE_ROLE_KEY - the project's service_role key (Supabase
//                               dashboard -> Project Settings -> API)
//
// Security model: the caller's own session JWT is verified against
// Supabase Auth, then independently re-checked against is_platform_admin()
// via a normal RLS-respecting RPC call (never trusted from the client) —
// only once that comes back true does this function touch the service-
// role key. The service role is used for exactly two things: looking up
// the target user's email, and generating their magic link. Every
// impersonation is logged to admin_actions via the caller's own JWT (so
// it's attributed to the admin who did it, not to this function).

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

  const targetUserId = req.body && req.body.targetUserId;
  if (!targetUserId) {
    res.status(400).json({ error: 'targetUserId is required' });
    return;
  }

  const callerResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!callerResp.ok) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  const caller = await callerResp.json();

  if (caller.id === targetUserId) {
    res.status(400).json({ error: 'You cannot impersonate your own account' });
    return;
  }

  // Re-check admin status server-side via the real RLS-backed RPC — never
  // trust a client-supplied "I'm an admin" claim for something this
  // sensitive.
  const permResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_platform_admin`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const isAdmin = permResp.ok && (await permResp.json()) === true;
  if (!isAdmin) {
    res.status(403).json({ error: 'Only a platform admin can impersonate a user' });
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    res.status(500).json({ error: 'Impersonation is not configured yet.' });
    return;
  }

  const targetResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!targetResp.ok) {
    res.status(404).json({ error: 'Target user not found' });
    return;
  }
  const target = await targetResp.json();
  if (!target.email) {
    res.status(400).json({ error: 'Target user has no email on file' });
    return;
  }

  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: target.email }),
  });
  if (!linkResp.ok) {
    const detail = await linkResp.text();
    res.status(502).json({ error: 'Could not generate a sign-in link', detail });
    return;
  }
  const link = await linkResp.json();

  // Attribute the action to the calling admin, not this function — the
  // caller's own JWT, not the service role, signs this insert.
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_admin_action`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_action_type: 'user_impersonated',
      p_target_type: 'user',
      p_target_id: targetUserId,
      p_target_label: null,
      p_reason: 'Support impersonation session started',
    }),
  });

  res.status(200).json({ actionLink: link.properties && link.properties.action_link });
};
