window.__INSERTED_POSTS__ = [];
window.__RESTAURANT_UPSERTS__ = [];
window.__PLACES_FETCH_BODIES__ = [];

const ME = { display_name: 'Me Cook', initials: 'MC', avatar_url: null };
const POSTS = [];

// Geolocation isn't reliably mockable for a file:// page via Playwright's
// context permissions API, so it's stubbed directly here instead.
window.__GEO_MODE__ = 'success'; // 'success' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'
const GEO_ERROR_CODES = { denied: 1, unavailable: 2, timeout: 3 };
if (window.__GEO_MODE__ !== 'unsupported') {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success, error) => {
        if (window.__GEO_MODE__ === 'success') {
          success({ coords: { latitude: 30.27, longitude: -97.74 } });
        } else {
          error({ code: GEO_ERROR_CODES[window.__GEO_MODE__] || 1, message: window.__GEO_MODE__ });
        }
      },
    },
  });
}

// One existing restaurant already linked to a Google place, to exercise
// the "reuse, don't re-create" branch.
let RESTAURANTS = [
  { id: 'rest-existing', name: 'Casa Elote', google_place_id: 'gp-casa-elote' },
];

window.__PLACES_FETCH_MODE__ = 'success'; // 'success' | 'server-error'
const REAL_FETCH = window.fetch.bind(window);
window.fetch = (url, opts) => {
  if (typeof url === 'string' && url.indexOf('/api/places-nearby') !== -1) {
    window.__PLACES_FETCH_BODIES__.push(JSON.parse(opts.body));
    if (window.__PLACES_FETCH_MODE__ === 'server-error') {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Google Maps lookup is not configured yet.' }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        places: [
          { googlePlaceId: 'gp-casa-elote', name: 'Casa Elote', address: '1 Main St', lat: 30.271, lng: -97.741, rating: 4.7 },
          { googlePlaceId: 'gp-marfa-bowl', name: 'Marfa Bowl Co.', address: '2 Main St', lat: 30.269, lng: -97.739, rating: 4.6 },
        ],
      }),
    });
  }
  return REAL_FETCH(url, opts);
};

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    range() { return builder; },
    not() { return builder; },
    single() {
      if (table === 'profiles') return Promise.resolve({ data: ME, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'restaurants') {
        const placeIdFilter = eqArgs.find((a) => a[0] === 'google_place_id');
        const match = placeIdFilter ? RESTAURANTS.find((r) => r.google_place_id === placeIdFilter[1]) : null;
        return Promise.resolve({ data: match || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'posts') result = POSTS;
      else if (table === 'hearts' || table === 'post_bookmarks' || table === 'comments' || table === 'challenge_entries' || table === 'follows') result = [];
      else if (table === 'profiles') result = [ME];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
    update() { return builder; },
    upsert(payload, options) {
      window.__RESTAURANT_UPSERTS__.push(payload);
      const row = { id: 'rest-new-1', ...payload };
      RESTAURANTS = RESTAURANTS.concat([row]);
      return {
        select() {
          return { single: () => Promise.resolve({ data: { id: row.id }, error: null }) };
        },
      };
    },
    insert(payload) {
      if (table === 'posts') {
        window.__INSERTED_POSTS__.push(payload);
        return { select() { return { single: () => Promise.resolve({ data: { id: 'new-post-1' }, error: null }) }; } };
      }
      return { select() { return { single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }; } };
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
