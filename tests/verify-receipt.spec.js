const { test, expect } = require('@playwright/test');

// Pure Node test for api/verify-receipt.js — same style as places-nearby.spec.js.
function loadHandler() {
  delete require.cache[require.resolve('../api/verify-receipt.js')];
  return require('../api/verify-receipt.js');
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// The SDK assigns `this.messages = new Messages(this)` per-instance in the
// client constructor, so patching Anthropic.prototype.messages has no
// effect — the instance's own property always shadows it. `create` itself
// IS a real Messages.prototype method, so patch that instead.
function getMessagesPrototype() {
  const Anthropic = require('@anthropic-ai/sdk');
  const probe = new Anthropic({ apiKey: 'probe' });
  return Object.getPrototypeOf(probe.messages);
}

test.describe('verify-receipt serverless handler', () => {
  let originalFetch;
  let originalEnv;

  test.beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
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
    const req = { method: 'POST', headers: {}, body: { imageBase64: 'x', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects an expired/invalid Supabase session', async () => {
    global.fetch = async () => ({ ok: false });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { imageBase64: 'x', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects a request missing imageBase64', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects an unsupported mediaType', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'x', mediaType: 'application/pdf' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects an oversized image', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'x'.repeat(9_000_000), mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('returns configured: false (not an error) when ANTHROPIC_API_KEY is missing — the client treats this as skip-the-check', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'x', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });

  test('a clear non-receipt photo (e.g. a face) returns isReceipt: false with a reason', async () => {
    global.fetch = async (url) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      throw new Error('should not call Google here');
    };
    const MessagesProto = getMessagesPrototype();
    const originalCreate = MessagesProto.create;
    MessagesProto.create = async () => ({ content: [{ type: 'text', text: '{"is_receipt": false, "confidence": "high", "reason": "This looks like a photo of a person, not a receipt."}' }] });

    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'ZmFrZQ==', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);

    MessagesProto.create = originalCreate;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: true, isReceipt: false, confidence: 'high', reason: 'This looks like a photo of a person, not a receipt.' });
  });

  test('a real receipt photo returns isReceipt: true', async () => {
    global.fetch = async (url) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      throw new Error('should not call Google here');
    };
    const MessagesProto = getMessagesPrototype();
    const originalCreate = MessagesProto.create;
    MessagesProto.create = async () => ({ content: [{ type: 'text', text: '{"is_receipt": true, "confidence": "high"}' }] });

    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'ZmFrZQ==', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);

    MessagesProto.create = originalCreate;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: true, isReceipt: true, confidence: 'high', reason: null });
  });

  test('an unparseable model response is treated as inconclusive, not an error', async () => {
    global.fetch = async (url) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      throw new Error('should not call Google here');
    };
    const MessagesProto = getMessagesPrototype();
    const originalCreate = MessagesProto.create;
    MessagesProto.create = async () => ({ content: [{ type: 'text', text: 'I am not sure what this is.' }] });

    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'ZmFrZQ==', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);

    MessagesProto.create = originalCreate;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: true, isReceipt: null, confidence: 'low', reason: null });
  });

  test('a Claude API failure is treated as inconclusive (200), not a 502 — never blocks a legitimate rating', async () => {
    global.fetch = async (url) => {
      if (typeof url === 'string' && url.indexOf('supabase.co') !== -1) return { ok: true, json: async () => ({}) };
      throw new Error('should not call Google here');
    };
    const MessagesProto = getMessagesPrototype();
    const originalCreate = MessagesProto.create;
    MessagesProto.create = async () => { throw new Error('rate limited'); };

    const handler = loadHandler();
    const req = { method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { imageBase64: 'ZmFrZQ==', mediaType: 'image/jpeg' } };
    const res = fakeRes();
    await handler(req, res);

    MessagesProto.create = originalCreate;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: true, isReceipt: null, confidence: 'low', reason: null });
  });
});
