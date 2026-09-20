const { test, expect } = require('@playwright/test');

// Pure Node test for api/places-nearby.js — mocks global.fetch (both the
// Supabase token-check call and the outbound Google Places call) and fake
// req/res objects, same style as testing any other Vercel serverless
// function in this repo.
function loadHandler() {
  delete require.cache[require.resolve('../api/places-nearby.js')];
  return require('../api/places-nearby.js');
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test.describe('places-nearby serverless handler', () => {
  let originalFetch;
  let originalEnv;

  test.beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
  });

  test.afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  test('rejects non-POST requests', async () => {
    const handler = loadHandler();
    const req = { method: 'GET', headers: {}, body: {} };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  test('rejects a request with no auth token', async () => {
    const handler = loadHandler();
    const req = { method: 'POST', headers: {}, body: { lat: 1, lng: 2 } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects an expired/invalid Supabase session', async () => {
    global.fetch = async () => ({ ok: false });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { lat: 1, lng: 2 } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('returns 500 when GOOGLE_MAPS_API_KEY is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { lat: 1, lng: 2 } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('rejects a request missing lat/lng', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: {} };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('calls Google Places Nearby Search with the given coordinates and returns a flattened place list', async () => {
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) {
        return { ok: true, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          places: [
            { id: 'gp-1', displayName: { text: 'Casa Elote' }, formattedAddress: '1 Main St', location: { latitude: 30.1, longitude: -97.1 }, rating: 4.7 },
            { id: 'gp-2', displayName: { text: 'No Rating Cafe' }, formattedAddress: '2 Main St', location: { latitude: 30.2, longitude: -97.2 } },
          ],
        }),
      };
    };
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { lat: 30.27, lng: -97.74 } };
    const res = fakeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.places).toEqual([
      { googlePlaceId: 'gp-1', name: 'Casa Elote', address: '1 Main St', lat: 30.1, lng: -97.1, rating: 4.7 },
      { googlePlaceId: 'gp-2', name: 'No Rating Cafe', address: '2 Main St', lat: 30.2, lng: -97.2, rating: null },
    ]);

    const placesCall = calls.find((c) => typeof c.url === 'string' && c.url.indexOf('places.googleapis.com') !== -1);
    expect(placesCall).toBeTruthy();
    expect(placesCall.opts.headers['X-Goog-Api-Key']).toBe('test-maps-key');
    const sentBody = JSON.parse(placesCall.opts.body);
    expect(sentBody.locationRestriction.circle.center).toEqual({ latitude: 30.27, longitude: -97.74 });
    expect(sentBody.locationRestriction.circle.radius).toBe(1000); // default when the client sends no radiusMeters
  });

  test('clamps an out-of-range radiusMeters to the 50-2000 bounds', async () => {
    let sentBody = null;
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ places: [] }) };
    };
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { lat: 1, lng: 2, radiusMeters: 50000 } };
    const res = fakeRes();
    await handler(req, res);
    expect(sentBody.locationRestriction.circle.radius).toBe(2000);
  });

  test('returns 502 with detail when Google Places rejects the request', async () => {
    global.fetch = async (url) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      return { ok: false, text: async () => 'quota exceeded' };
    };
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { lat: 1, lng: 2 } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.detail).toBe('quota exceeded');
  });

  // Nothing in the handler used to be wrapped in try/catch, so an
  // unexpected failure (a network error reaching Supabase or Google, here
  // simulated as fetch itself throwing) fell through as an unhandled
  // rejection — Vercel would return a raw response with no JSON body,
  // which the client's resp.json() would then also fail to parse.
  test('returns a clean 500 instead of an unhandled rejection when fetch itself throws', async () => {
    global.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { lat: 1, lng: 2 } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Unexpected server error looking up nearby places.');
  });
});
