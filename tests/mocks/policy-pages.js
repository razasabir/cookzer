// Mock for cookzer-privacy.html / cookzer-terms.html's live-override
// fetch from policy_documents (migration 057). window.__POLICY__ is set
// by the test before navigating: null means "nothing published yet" (the
// page's static fallback should stay showing); an object means a version
// exists and should replace the fallback.
window.__POLICY__ = null;
window.__CONSENT_CALLS__ = [];

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: window.__SIGNED_IN__ ? { user: { id: 'me-1' } } : null } }),
      getUser: () => Promise.resolve({ data: { user: window.__SIGNED_IN__ ? { id: 'me-1' } : null } }),
      onAuthStateChange: () => {},
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: table === 'policy_documents' ? window.__POLICY__ : null, error: null }),
          }),
        }),
      }),
    }),
    rpc: (fn, args) => {
      if (fn === 'record_policy_consent') { window.__CONSENT_CALLS__.push(args); return Promise.resolve({ data: null, error: null }); }
      return Promise.resolve({ data: null, error: null });
    },
  }),
};
