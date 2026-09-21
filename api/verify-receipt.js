// Vercel serverless function. A soft trust check on restaurant-rating
// receipt uploads — before a photo gets treated as "proof", ask Haiku
// 4.5 (vision) whether it actually looks like a receipt or invoice at
// all, so an obviously-wrong upload (a selfie, a screenshot, a random
// photo) gets caught before it's stored and shown as "Receipt
// verified." This is a soft gate, not a hard one: any failure here
// (missing config, a network error, an ambiguous answer) is treated by
// the client as "can't tell" and the rating still goes through — a
// broken or uncertain check must never block a legitimate rating.
//
// Requires the same ANTHROPIC_API_KEY Vercel environment variable the
// Cookzer+ AI Assistant (api/ai-chat.js) already uses — no new key
// needed if that feature is already configured.

const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Base64 inflates payload size by ~33%; this caps the source image
// around 6MB, comfortably inside Vercel's request body limit even
// before the client-side downscale this endpoint expects upstream.
const MAX_BASE64_LENGTH = 8_000_000;

const PROMPT =
  'Look at this photo. Is it a photo of a restaurant receipt or invoice ' +
  '(an itemized purchase, a total amount, ideally a business name or date)? ' +
  'Respond with ONLY a single-line JSON object, no other text, no markdown: ' +
  '{"is_receipt": true or false, "confidence": "high", "medium", or "low", "reason": "a few words, only when is_receipt is false"}';

module.exports = async function handler(req, res) {
  try {
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

    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'imageBase64 is required' });
      return;
    }
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      res.status(400).json({ error: 'Unsupported or missing mediaType' });
      return;
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      res.status(400).json({ error: 'Image is too large — please attach a smaller photo.' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(200).json({ configured: false });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    let completion;
    try {
      completion = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      });
    } catch (e) {
      // A model failure shouldn't block a legitimate rating — the
      // client treats this the same as "inconclusive".
      res.status(200).json({ configured: true, isReceipt: null, confidence: 'low', reason: null });
      return;
    }

    const textBlock = (completion.content || []).find((b) => b.type === 'text');
    let parsed = null;
    try {
      const match = textBlock && textBlock.text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (e) {
      parsed = null;
    }

    if (!parsed || typeof parsed.is_receipt !== 'boolean') {
      res.status(200).json({ configured: true, isReceipt: null, confidence: 'low', reason: null });
      return;
    }

    res.status(200).json({
      configured: true,
      isReceipt: parsed.is_receipt,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : null,
    });
  } catch (err) {
    console.error('verify-receipt: unexpected error', err);
    res.status(200).json({ configured: true, isReceipt: null, confidence: 'low', reason: null });
  }
};
