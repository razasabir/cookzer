const RESTAURANTS = [
  { id: 'r-old', name: 'Old Standby', created_at: '2026-01-01T00:00:00Z', is_verified: false, featured_until: null, google_rating: 4.5 },
  { id: 'r-verified', name: 'Trusted Kitchen', created_at: '2026-06-01T00:00:00Z', is_verified: true, featured_until: null, google_rating: 4.0 },
  { id: 'r-expired-feature', name: 'Once Featured', created_at: '2026-07-01T00:00:00Z', is_verified: false, featured_until: '2020-01-01T00:00:00Z', google_rating: null },
  { id: 'r-featured', name: 'Boosted Bistro', created_at: '2026-02-01T00:00:00Z', is_verified: false, featured_until: '2099-01-01T00:00:00Z', google_rating: 4.9 },
];

// r-old's ratings are years old (no recent activity, excluded from
// Trending). r-verified has three recent ratings (highest recent-rating
// count). r-featured has one recent rating but rates well below its
// Google score (avg 3.0 vs Google 4.9 — the biggest Cookzer-vs-Google
// divergence, testing that "compare" sorts by |delta| regardless of
// which restaurant is otherwise trending or featured).
const RATINGS = [
  { restaurant_id: 'r-old', rating: 4, created_at: '2020-01-01T00:00:00Z' },
  { restaurant_id: 'r-old', rating: 5, created_at: '2020-01-02T00:00:00Z' },
  { restaurant_id: 'r-verified', rating: 5, created_at: '2026-09-15T00:00:00Z' },
  { restaurant_id: 'r-verified', rating: 5, created_at: '2026-09-10T00:00:00Z' },
  { restaurant_id: 'r-verified', rating: 5, created_at: '2026-09-05T00:00:00Z' },
  { restaurant_id: 'r-featured', rating: 3, created_at: '2026-09-18T00:00:00Z' },
];

// Recent Dining Out tags, contributing to Trending alongside ratings.
const POSTS = [
  { restaurant_id: 'r-verified', created_at: '2026-09-19T00:00:00Z' },
  { restaurant_id: 'r-featured', created_at: '2026-09-20T00:00:00Z' },
  { restaurant_id: 'r-featured', created_at: '2026-09-19T00:00:00Z' },
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
    gte() { return builder; },
    then(resolve) {
      let result = [];
      if (table === 'restaurants') {
        result = RESTAURANTS;
      } else if (table === 'restaurant_ratings') {
        result = RATINGS;
      } else if (table === 'posts') {
        result = POSTS;
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
