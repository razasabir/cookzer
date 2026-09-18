window.__CALLS__ = [];
window.__MARKED_READ__ = [];

window.__SEED_NOTIFICATIONS__ = window.__SEED_NOTIFICATIONS__ || [
  { id: 'n1', type: 'heart', message: 'Sarah K. hearted your post', link_url: 'cookzer-feed.html?post=p1', actor_id: 'u1', read_at: null, created_at: new Date().toISOString() },
  { id: 'n2', type: 'comment', message: 'Alex commented: "looks great!"', link_url: 'cookzer-feed.html?post=p2', actor_id: 'u2', read_at: new Date().toISOString(), created_at: new Date(Date.now() - 60000).toISOString() },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    is() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    single() { return Promise.resolve({ data: { display_name: 'Test Cook', initials: 'TC', avatar_url: null }, error: null }); },
    update(payload) {
      window.__MARKED_READ__.push(payload);
      return builder;
    },
    then(resolve) {
      window.__CALLS__.push({ table, eqArgs });
      const result = table === 'notifications' ? { data: window.__SEED_NOTIFICATIONS__, count: window.__SEED_NOTIFICATIONS__.filter((n) => !n.read_at).length } : { data: [], count: 0 };
      return Promise.resolve({ ...result, error: null }).then(resolve);
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
