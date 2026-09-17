window.__CALLS__ = [];
window.__OAUTH_CALLS__ = [];
window.__BROWSER_OPEN_CALLS__ = [];
window.__EXCHANGE_CALLS__ = [];

const seed = window.__AUTH_OAUTH_SEED__ || {};

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signUp: () => Promise.resolve({ data: {}, error: null }),
      signInWithOAuth: (args) => {
        window.__OAUTH_CALLS__.push(args);
        if (seed.oauthError) {
          return Promise.resolve({ data: null, error: { message: seed.oauthError } });
        }
        return Promise.resolve({ data: { url: 'https://accounts.google.com/o/oauth2/fake-auth-url' }, error: null });
      },
      exchangeCodeForSession: (code) => {
        window.__EXCHANGE_CALLS__.push(code);
        // A successful exchange navigates the page away right after this
        // resolves, destroying window.__EXCHANGE_CALLS__ before a test can
        // read it — also report it through a Playwright binding, which
        // survives navigation, so tests can assert on it either way.
        if (window.__logExchange) window.__logExchange(code);
        if (seed.exchangeError) {
          return Promise.resolve({ data: null, error: { message: seed.exchangeError } });
        }
        return Promise.resolve({ data: { session: {} }, error: null });
      },
    },
    from: () => ({
      select() { return this; }, eq() { return this; }, single() { return Promise.resolve({ data: null, error: null }); },
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  }),
};

// Minimal stand-in for the real Capacitor bridge, present only inside the
// packaged app (never on the real website). appUrlOpenHandler captures the
// listener cookzer-auth.html registers, so tests can simulate the OS
// reopening the app via the custom-scheme deep link.
let appUrlOpenHandler = null;
window.Capacitor = {
  isNativePlatform: () => true,
  Plugins: {
    Browser: {
      open: (opts) => { window.__BROWSER_OPEN_CALLS__.push(opts); return Promise.resolve(); },
      close: () => Promise.resolve(),
    },
    App: {
      addListener: (event, cb) => { if (event === 'appUrlOpen') appUrlOpenHandler = cb; },
    },
  },
};

window.__simulateAppUrlOpen = (url) => { if (appUrlOpenHandler) appUrlOpenHandler({ url }); };
