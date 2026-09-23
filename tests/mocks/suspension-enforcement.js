// Minimal mock for verifying auth-guard.js's suspension lockout end to
// end: a suspended user gets redirected off an ordinary page and off the
// mock page with no rpc() at all is covered separately (see the "fails
// open" test in this same spec, using a client with no rpc method).
window.__SUSPENSION__ = null; // set by the test before navigating

function chain(table) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    single() {
      if (table === 'profiles') return Promise.resolve({ data: { display_name: 'Bob', initials: 'BO', avatar_url: null, is_platform_admin: false }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'bob-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'bob-1', email: 'bob@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    rpc: (fn) => {
      if (fn === 'my_active_suspension') {
        return Promise.resolve({ data: window.__SUSPENSION__ ? [window.__SUSPENSION__] : [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
