window.__RATING_UPSERTS__ = [];
window.__RECEIPT_UPLOADS__ = [];

const ME = { display_name: 'Me Cook', initials: 'MC', avatar_url: null };

const RESTAURANT = {
  id: 'rest-1',
  name: 'Marfa Bowl Co.',
  address: '1108 S Congress Ave, Austin, TX',
  lat: 30.24,
  lng: -97.75,
  google_place_id: 'gp-marfa-bowl',
  google_rating: 4.6,
  tag_count: 3,
};

const POSTS = [
  { id: 'post-1', author_id: 'u1', caption: 'Sunday reset bowl', photo_path: 'u1/photo1.jpg', created_at: '2026-09-18T12:00:00Z', profiles: { display_name: 'Jordan C.', initials: 'JC', avatar_url: null } },
  { id: 'post-2', author_id: 'u2', caption: 'Back again for the 4th time', photo_path: 'u2/photo2.jpg', created_at: '2026-09-17T12:00:00Z', profiles: { display_name: 'Rae H.', initials: 'RH', avatar_url: null } },
  { id: 'post-3', author_id: 'u1', caption: 'No photo this time', photo_path: null, created_at: '2026-09-16T12:00:00Z', profiles: { display_name: 'Jordan C.', initials: 'JC', avatar_url: null } },
];

const RATINGS = [
  { id: 'rating-1', user_id: 'u2', rating: 5, review: 'Best grain bowl in South Austin.', receipt_photo_path: 'u2/receipt1.jpg', created_at: '2026-09-15T12:00:00Z', profiles: { display_name: 'Rae H.', initials: 'RH' } },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    single() {
      if (table === 'restaurants') {
        const idFilter = eqArgs.find((a) => a[0] === 'id');
        const match = idFilter && idFilter[1] === RESTAURANT.id ? RESTAURANT : null;
        return Promise.resolve({ data: match, error: match ? null : { message: 'not found' } });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'posts') {
        const restFilter = eqArgs.find((a) => a[0] === 'restaurant_id');
        result = restFilter && restFilter[1] === RESTAURANT.id ? POSTS : [];
      } else if (table === 'restaurant_ratings') {
        const restFilter = eqArgs.find((a) => a[0] === 'restaurant_id');
        result = restFilter && restFilter[1] === RESTAURANT.id ? RATINGS : [];
      } else if (table === 'profiles') {
        result = ME;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    upsert(payload) {
      window.__RATING_UPSERTS__.push(payload);
      return Promise.resolve({ data: null, error: null });
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
        upload: (path, file) => {
          window.__RECEIPT_UPLOADS__.push({ bucket, path });
          return Promise.resolve({ data: {}, error: null });
        },
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
