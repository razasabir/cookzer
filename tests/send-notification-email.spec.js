const { test, expect } = require('@playwright/test');

// Pure Node test for api/send-notification-email.js — mocks global.fetch
// (the outbound Resend call) and fake req/res objects, same style as
// testing any other Vercel serverless function in this repo.
function loadHandler() {
  delete require.cache[require.resolve('../api/send-notification-email.js')];
  return require('../api/send-notification-email.js');
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test.describe('send-notification-email webhook handler', () => {
  let originalFetch;
  let originalEnv;

  test.beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.NOTIFICATION_WEBHOOK_SECRET = 'test-secret';
    process.env.RESEND_API_KEY = 'test-resend-key';
  });

  test.afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  test('rejects a request with the wrong webhook secret', async () => {
    const handler = loadHandler();
    const req = { method: 'POST', headers: { 'x-webhook-secret': 'wrong' }, body: {} };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects non-POST requests', async () => {
    const handler = loadHandler();
    const req = { method: 'GET', headers: {}, body: {} };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  test('skips (200, not an error) when should_email is false', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_email: false, recipient_email: 'a@b.com', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fetchCalled).toBe(false);
  });

  test('skips when there is no recipient_email', async () => {
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_email: true, recipient_email: null, message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.skipped).toBe(true);
  });

  test('ignores events for a different table or type (still 200, no send)', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'UPDATE', table: 'notifications', record: { should_email: true, recipient_email: 'a@b.com' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fetchCalled).toBe(false);
  });

  test('sends an email via Resend for a valid, email-eligible notification', async () => {
    let capturedUrl, capturedOptions;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, json: async () => ({ id: 'email-1' }) };
    };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        type: 'INSERT',
        table: 'notifications',
        record: {
          should_email: true,
          recipient_email: 'cook@example.com',
          type: 'heart',
          message: 'Sarah K. hearted your post',
          link_url: 'cookzer-feed.html?post=abc',
        },
      },
    };
    const res = fakeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(capturedUrl).toBe('https://api.resend.com/emails');
    expect(capturedOptions.headers.Authorization).toBe('Bearer test-resend-key');
    const sentBody = JSON.parse(capturedOptions.body);
    expect(sentBody.to).toBe('cook@example.com');
    expect(sentBody.subject).toBe('Someone hearted your post');
    expect(sentBody.html).toContain('Sarah K. hearted your post');
    expect(sentBody.html).toContain('https://cookzer.com/cookzer-feed.html?post=abc');
  });

  test('escapes HTML in the notification message', async () => {
    let capturedOptions;
    global.fetch = async (url, options) => { capturedOptions = options; return { ok: true, json: async () => ({}) }; };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        type: 'INSERT',
        table: 'notifications',
        record: { should_email: true, recipient_email: 'a@b.com', type: 'comment', message: 'Alex commented: "<script>alert(1)</script>"' },
      },
    };
    await handler(req, fakeRes());
    const sentBody = JSON.parse(capturedOptions.body);
    expect(sentBody.html).not.toContain('<script>');
    expect(sentBody.html).toContain('&lt;script&gt;');
  });

  test('returns 500 when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_email: true, recipient_email: 'a@b.com', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('returns 502 with detail when Resend rejects the send', async () => {
    global.fetch = async () => ({ ok: false, text: async () => 'invalid domain' });
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_email: true, recipient_email: 'a@b.com', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.detail).toBe('invalid domain');
  });
});
