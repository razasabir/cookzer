// cookzer-convert.html makes no Supabase queries of its own (conversion is
// pure client-side) — this mock only needs to satisfy auth-guard.js with a
// signed-in session so the page doesn't redirect to cookzer-auth.html.
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'me-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'me-1', email: 'me@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: () => ({
      select() { return this; }, eq() { return this; }, neq() { return this; }, in() { return this; },
      order() { return this; }, limit() { return this; },
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
