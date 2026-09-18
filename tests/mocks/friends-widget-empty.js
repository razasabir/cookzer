window.__CALLS__ = [];

function chain(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
    order() { return builder; }, limit() { return builder; }, not() { return builder; }, gte() { return builder; }, lte() { return builder; }, range() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table });
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert() { return Promise.resolve({ data: null, error: null }); },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'me-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'me-1', email: 'me@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
