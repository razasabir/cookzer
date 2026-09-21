const NONADMIN_PROFILE = { is_platform_admin: false };

function chain(table) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    single() {
      if (table === 'profiles') {
        return Promise.resolve({ data: NONADMIN_PROFILE, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token', user: { id: 'rando-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'rando-1', email: 'rando@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
