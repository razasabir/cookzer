const RESTAURANTS = [
  { id: 'r-old', name: 'Old Standby', created_at: '2026-01-01T00:00:00Z', is_verified: false, featured_until: null },
  { id: 'r-verified', name: 'Trusted Kitchen', created_at: '2026-06-01T00:00:00Z', is_verified: true, featured_until: null },
  { id: 'r-expired-feature', name: 'Once Featured', created_at: '2026-07-01T00:00:00Z', is_verified: false, featured_until: '2020-01-01T00:00:00Z' },
  { id: 'r-featured', name: 'Boosted Bistro', created_at: '2026-02-01T00:00:00Z', is_verified: false, featured_until: '2099-01-01T00:00:00Z' },
];

const RATINGS = [
  { restaurant_id: 'r-old', rating: 4 },
  { restaurant_id: 'r-old', rating: 5 },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    order() { return builder; },
    in() { return builder; },
    ilike() { return builder; },
    limit() { return builder; },
    then(resolve) {
      let result = [];
      if (table === 'restaurants') {
        result = RESTAURANTS;
      } else if (table === 'restaurant_ratings') {
        result = RATINGS;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token', user: { id: 'me-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'me-1', email: 'me@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: 'https://example.com/' + bucket + '/' + path } }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
