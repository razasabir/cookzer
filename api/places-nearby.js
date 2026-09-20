// Vercel serverless function. Looks up nearby restaurants/cafes/bars via
// Google's Places API (New) "Nearby Search" so the feed composer's "Dining
// Out" check-in can suggest real places instead of relying on
// OpenStreetMap's much sparser community-mapped data. Kept server-side
// (rather than calling Places directly from the browser) so the API key
// never has to be shipped to the client and billed against an
// unrestricted-by-referrer key.
//
// Requires this Vercel environment variable (server-side only, never
// exposed to the client):
//   GOOGLE_MAPS_API_KEY  - from a Google Cloud project with the "Places API
//                           (New)" enabled and billing set up (Nearby
//                           Search isn't on the always-free tier, but
//                           Google's ~$200/mo credit comfortably covers
//                           this app's scale)
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search

const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

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

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Google Maps lookup is not configured yet.' });
      return;
    }

    const { lat, lng, radiusMeters } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng (numbers) are required' });
      return;
    }

    const placesResp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Only the fields the composer actually uses — Places bills partly
        // by field mask breadth, so keep this list minimal.
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
        ].join(','),
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe', 'bar', 'bakery'],
        maxResultCount: 10,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(Math.max(radiusMeters || 1000, 50), 2000),
          },
        },
      }),
    });

    if (!placesResp.ok) {
      const detail = await placesResp.text();
      // The specific reason (bad/restricted API key, API not enabled on
      // this project, quota exceeded, etc.) only ever showed up here —
      // logged so it's visible in Vercel's Function Logs instead of only
      // the generic "Could not reach Google Places" the client sees.
      console.error('places-nearby: Google Places request failed', placesResp.status, detail);
      res.status(502).json({ error: 'Could not reach Google Places', detail });
      return;
    }

    const data = await placesResp.json();
    const places = (data.places || []).map((p) => ({
      googlePlaceId: p.id,
      name: p.displayName && p.displayName.text,
      address: p.formattedAddress || null,
      lat: p.location ? p.location.latitude : null,
      lng: p.location ? p.location.longitude : null,
      rating: typeof p.rating === 'number' ? p.rating : null,
    })).filter((p) => p.googlePlaceId && p.name);

    res.status(200).json({ places });
  } catch (err) {
    // Nothing above was wrapped before, so any unexpected failure (a
    // network error reaching Supabase or Google, malformed JSON, etc.)
    // fell through as an unhandled rejection — Vercel would return a raw
    // 500 with no JSON body, which the client's `resp.json()` would then
    // also fail to parse, masking the real cause behind a second, unrelated
    // error. Logged and returned as a clean JSON error instead.
    console.error('places-nearby: unexpected error', err);
    res.status(500).json({ error: 'Unexpected server error looking up nearby places.' });
  }
};
