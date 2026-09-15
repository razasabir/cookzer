window.__CALLS__ = [];
let joined = false;

function chain(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
    order() { return builder; }, limit() { return builder; }, not() { return builder; }, gte() { return builder; }, lte() { return builder; }, range() { return builder; },
    maybeSingle() {
      if (table === 'ai_assistant_waitlist') {
        return Promise.resolve({ data: joined ? { feature: 'pantry' } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    single() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table });
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert(row) {
      window.__CALLS__.push({ table, op: 'insert', row });
      if (table === 'ai_assistant_waitlist') joined = true;
      return Promise.resolve({ data: null, error: null });
    },
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
