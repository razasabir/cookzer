const { test, expect } = require('@playwright/test');

// Pure Node test for api/send-notification-push.js — same style as
// send-notification-email.spec.js, mocking global.fetch for the outbound
// FCM call and fake req/res objects. google-auth-library additionally
// needs stubbing (it does its own network calls to mint an access token),
// done by pre-populating require.cache so the handler's own require()
// picks up the fake module instead of the real package.
function stubGoogleAuthLibrary(getAccessTokenImpl, onConstruct) {
  const modulePath = require.resolve('google-auth-library');
  class FakeGoogleAuth {
    constructor(opts) {
      if (onConstruct) onConstruct(opts);
    }
    async getClient() {
      return { getAccessToken: getAccessTokenImpl };
    }
  }
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: { GoogleAuth: FakeGoogleAuth },
  };
}

function loadHandler() {
  delete require.cache[require.resolve('../api/send-notification-push.js')];
  return require('../api/send-notification-push.js');
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test.describe('send-notification-push webhook handler', () => {
  let originalFetch;
  let originalEnv;

  test.beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.NOTIFICATION_WEBHOOK_SECRET = 'test-secret';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'cookzer-test',
      client_email: 'fake@cookzer-test.iam.gserviceaccount.com',
      private_key: 'fake-key',
    });
    stubGoogleAuthLibrary(async () => ({ token: 'fake-access-token' }));
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

  test('skips (200, not an error) when should_push is false', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: false, push_token: 'tok-1', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fetchCalled).toBe(false);
  });

  test('skips when there is no push_token', async () => {
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: null, message: 'hi' } },
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
      body: { type: 'UPDATE', table: 'notifications', record: { should_push: true, push_token: 'tok-1' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fetchCalled).toBe(false);
  });

  test('normalizes a double-escaped private_key before handing it to GoogleAuth', async () => {
    // Reproduces a real production failure: pasting the service account
    // JSON through a clipboard and Vercel's env-var field left the
    // private_key's newlines as literal \n two-char sequences instead of
    // real line breaks — valid JSON either way, but OpenSSL then rejects
    // it ("DECODER routines::unsupported" / ERR_OSSL_UNSUPPORTED).
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'cookzer-test',
      client_email: 'fake@cookzer-test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nMIIabc\\n-----END PRIVATE KEY-----\\n',
    });
    let capturedCredentials;
    global.fetch = async () => ({ ok: true, json: async () => ({}) });
    stubGoogleAuthLibrary(async () => ({ token: 'fake-access-token' }), (opts) => {
      capturedCredentials = opts.credentials;
    });
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: 'tok-1', message: 'hi' } },
    };
    await handler(req, fakeRes());
    expect(capturedCredentials.private_key).toBe('-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----\n');
  });

  test('reads a base64-encoded FIREBASE_SERVICE_ACCOUNT_JSON', async () => {
    // The actually-shipped configuration: base64 avoids the whole class of
    // clipboard/env-var-field newline corruption the two tests above and
    // above it exist because of.
    const realJson = JSON.stringify({
      project_id: 'cookzer-b64',
      client_email: 'fake@cookzer-b64.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIreal\n-----END PRIVATE KEY-----\n',
    });
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = Buffer.from(realJson, 'utf8').toString('base64');
    let capturedCredentials, capturedUrl;
    global.fetch = async (url) => { capturedUrl = url; return { ok: true, json: async () => ({}) }; };
    stubGoogleAuthLibrary(async () => ({ token: 'fake-access-token' }), (opts) => {
      capturedCredentials = opts.credentials;
    });
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: 'tok-1', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(capturedCredentials.project_id).toBe('cookzer-b64');
    expect(capturedCredentials.private_key).toBe('-----BEGIN PRIVATE KEY-----\nMIIreal\n-----END PRIVATE KEY-----\n');
    expect(capturedUrl).toBe('https://fcm.googleapis.com/v1/projects/cookzer-b64/messages:send');
  });

  test('sends a push via FCM for a valid, push-eligible notification', async () => {
    let capturedUrl, capturedOptions;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, json: async () => ({ name: 'projects/cookzer-test/messages/1' }) };
    };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        type: 'INSERT',
        table: 'notifications',
        record: {
          should_push: true,
          push_token: 'tok-abc',
          type: 'heart',
          message: 'Sarah K. hearted your post',
          link_url: 'cookzer-feed.html?post=abc',
        },
      },
    };
    const res = fakeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(capturedUrl).toBe('https://fcm.googleapis.com/v1/projects/cookzer-test/messages:send');
    expect(capturedOptions.headers.Authorization).toBe('Bearer fake-access-token');
    const sentBody = JSON.parse(capturedOptions.body);
    expect(sentBody.message.token).toBe('tok-abc');
    expect(sentBody.message.notification.title).toBe('Someone hearted your post');
    expect(sentBody.message.notification.body).toBe('Sarah K. hearted your post');
    expect(sentBody.message.webpush.fcm_options.link).toBe('https://www.cookzer.com/cookzer-feed.html?post=abc');
  });

  test('falls back to a generic title for an unknown notification type', async () => {
    let capturedOptions;
    global.fetch = async (url, options) => { capturedOptions = options; return { ok: true, json: async () => ({}) }; };
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: 'tok-1', type: 'something_new', message: 'hi' } },
    };
    await handler(req, fakeRes());
    const sentBody = JSON.parse(capturedOptions.body);
    expect(sentBody.message.notification.title).toBe('Cookzer');
  });

  test('returns 500 when FIREBASE_SERVICE_ACCOUNT_JSON is missing', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: 'tok-1', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('returns 502 with detail when FCM rejects the send', async () => {
    global.fetch = async () => ({ ok: false, text: async () => 'invalid registration token' });
    const handler = loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { type: 'INSERT', table: 'notifications', record: { should_push: true, push_token: 'tok-1', message: 'hi' } },
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.detail).toBe('invalid registration token');
  });
});
