// Vercel serverless function. Cookzer+ AI Assistant — real Haiku 4.5
// backend for Pantry Challenge, Leftovers, and Health chat.
//
// Requires this Vercel environment variable (server-side only, never
// exposed to the client):
//   ANTHROPIC_API_KEY  - console.anthropic.com -> API Keys
//
// No payment processor exists on this platform yet, so access isn't
// gated by payment status — every logged-in user can use it, protected
// only by the same 500-messages/month cap the $5/mo Cookzer+ tier is
// priced against. The message count is derived by counting this
// month's role='user' rows (migration 022) rather than kept in a
// separate counter, so it can never drift from the real history.

const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

const MONTHLY_MESSAGE_LIMIT = 500;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;

// Replies render as plain text in a chat bubble, not through a markdown
// renderer — without this, Haiku's **bold**/bullet-star formatting shows
// up as literal asterisks in the UI.
const NO_MARKDOWN =
  ' Write in plain text only — no markdown (no **asterisks** for bold/italic, ' +
  'no # headings). For a list, use plain numbers like "1." on their own line, not stars or dashes.';

const SYSTEM_PROMPTS = {
  pantry:
    "You are Cookzer's Pantry Challenge assistant, inside a home-cooking app. " +
    'The user will describe ingredients they already have. Suggest 1-3 concrete, ' +
    'specific dishes they could make, favoring options that use what they listed ' +
    'and need little or no extra shopping. Ask a quick follow-up only if their ' +
    'message is too vague to suggest anything useful. Keep replies short, warm, ' +
    "and practical — this is a chat bubble, not an essay. If asked something " +
    'unrelated to cooking or their kitchen, gently steer back to pantry help.' +
    NO_MARKDOWN,
  leftovers:
    "You are Cookzer's Leftovers assistant, inside a home-cooking app. The user " +
    'will describe leftover food or ingredients on hand. Suggest creative, ' +
    'realistic ways to turn them into a new meal, including a simple substitution ' +
    'if something obvious is missing. Keep replies short, warm, and practical — ' +
    "this is a chat bubble, not an essay. If asked something unrelated to " +
    'cooking, gently steer back to leftovers help.' +
    NO_MARKDOWN,
  health:
    "You are Cookzer's Health & Nutrition assistant, inside a home-cooking app. " +
    'Answer questions about nutrition, calories, macros, and healthy home cooking. ' +
    'Be encouraging and practical, never preachy or alarmist about food choices. ' +
    'You are not a medical professional — for anything symptom-related or a ' +
    'medical concern, say so plainly and suggest a doctor or registered dietitian. ' +
    'Keep replies concise — this is a chat bubble, not an essay.' +
    NO_MARKDOWN,
};

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

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
  const user = await userResp.json();

  const feature = req.body && req.body.feature;
  if (!SYSTEM_PROMPTS[feature]) {
    res.status(400).json({ error: 'Unknown feature.' });
    return;
  }

  const message = (req.body && req.body.message || '').trim();
  if (!message) {
    res.status(400).json({ error: 'Message is empty.' });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
    return;
  }

  const rawHistory = Array.isArray(req.body && req.body.history) ? req.body.history : [];
  const history = rawHistory
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  // Count this month's user-sent messages, scoped by the caller's own
  // token so RLS enforces it's really their own count.
  const countUrl =
    `${SUPABASE_URL}/rest/v1/ai_assistant_messages?select=id&user_id=eq.${user.id}` +
    `&role=eq.user&created_at=gte.${encodeURIComponent(monthStartIso())}`;
  const countResp = await fetch(countUrl, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!countResp.ok) {
    res.status(502).json({ error: 'Could not check your message usage right now.' });
    return;
  }
  const contentRange = countResp.headers.get('content-range') || '';
  const usedThisMonth = parseInt(contentRange.split('/')[1], 10) || 0;

  if (usedThisMonth >= MONTHLY_MESSAGE_LIMIT) {
    res.status(402).json({
      error: `You've used all ${MONTHLY_MESSAGE_LIMIT} Cookzer+ messages this month. It resets on the 1st.`,
      usageCount: usedThisMonth,
      limit: MONTHLY_MESSAGE_LIMIT,
    });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'The AI Assistant is not configured yet.' });
    return;
  }

  const anthropic = new Anthropic({ apiKey });
  let completion;
  try {
    completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: SYSTEM_PROMPTS[feature],
      messages: [...history, { role: 'user', content: message }],
    });
  } catch (e) {
    res.status(502).json({ error: 'The AI Assistant could not respond just now. Please try again.' });
    return;
  }

  const textBlock = (completion.content || []).find((b) => b.type === 'text');
  const reply = textBlock ? textBlock.text : "Sorry, I couldn't come up with a reply for that.";

  res.status(200).json({
    reply,
    usageCount: usedThisMonth + 1,
    limit: MONTHLY_MESSAGE_LIMIT,
  });
};
