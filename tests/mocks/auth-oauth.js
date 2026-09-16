window.__CALLS__ = [];
window.__OAUTH_CALLS__ = [];

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
        // Real behavior never resolves here — the browser navigates away.
        return new Promise(() => {});
      },
    },
    from: () => ({
      select() { return this; }, eq() { return this; }, single() { return Promise.resolve({ data: null, error: null }); },
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  }),
};
