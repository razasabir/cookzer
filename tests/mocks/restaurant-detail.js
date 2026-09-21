window.__RATING_UPSERTS__ = [];
window.__RECEIPT_UPLOADS__ = [];
window.__CLAIM_INSERTS__ = [];
window.__CLAIM_PROOF_UPLOADS__ = [];
window.__CLAIMED_DETAILS_RPCS__ = [];
window.__VERIFIED_RPCS__ = [];
window.__FEATURED_RPCS__ = [];

const ME = { display_name: 'Me Cook', initials: 'MC', avatar_url: null };

const RESTAURANTS = [
  {
    id: 'rest-1',
    name: 'Marfa Bowl Co.',
    address: '1108 S Congress Ave, Austin, TX',
    lat: 30.24,
    lng: -97.75,
    google_place_id: 'gp-marfa-bowl',
    google_rating: 4.6,
    tag_count: 3,
    claimed_by: null,
    claim_status: 'unclaimed',
    phone: null,
    website: null,
    menu_url: null,
    is_verified: false,
    featured_until: null,
  },
  {
    id: 'rest-2',
    name: 'Owned Eats',
    address: '200 Main St, Austin, TX',
    lat: 30.27,
    lng: -97.74,
    google_place_id: 'gp-owned-eats',
    google_rating: 4.2,
    tag_count: 1,
    claimed_by: 'me-1',
    claim_status: 'approved',
    phone: '512-555-0100',
    website: 'https://ownedeats.example',
    menu_url: 'https://ownedeats.example/menu',
    is_verified: false,
    featured_until: null,
  },
  {
    id: 'rest-3',
    name: 'Someone Elses Place',
    address: '300 Side St, Austin, TX',
    lat: 30.28,
    lng: -97.73,
    google_place_id: 'gp-someone-else',
    google_rating: 4.0,
    tag_count: 0,
    claimed_by: null,
    claim_status: 'pending',
    phone: null,
    website: null,
    menu_url: null,
    is_verified: false,
    featured_until: null,
  },
  {
    id: 'rest-4',
    name: 'My Pending Claim Spot',
    address: '400 Claim Ave, Austin, TX',
    lat: 30.29,
    lng: -97.72,
    google_place_id: 'gp-my-pending',
    google_rating: 3.9,
    tag_count: 0,
    claimed_by: null,
    claim_status: 'pending',
    phone: null,
    website: null,
    menu_url: null,
    is_verified: false,
    featured_until: null,
  },
  {
    id: 'rest-5',
    name: 'Trusted Spot',
    address: '500 Verified Way, Austin, TX',
    lat: 30.3,
    lng: -97.71,
    google_place_id: 'gp-trusted-spot',
    google_rating: 4.8,
    tag_count: 2,
    claimed_by: null,
    claim_status: 'unclaimed',
    phone: null,
    website: null,
    menu_url: null,
    is_verified: true,
    featured_until: '2026-12-31T00:00:00Z',
  },
];

const POSTS = [
  { id: 'post-1', author_id: 'u1', caption: 'Sunday reset bowl', photo_path: 'u1/photo1.jpg', created_at: '2026-09-18T12:00:00Z', profiles: { display_name: 'Jordan C.', initials: 'JC', avatar_url: null } },
  { id: 'post-2', author_id: 'u2', caption: 'Back again for the 4th time', photo_path: 'u2/photo2.jpg', created_at: '2026-09-17T12:00:00Z', profiles: { display_name: 'Rae H.', initials: 'RH', avatar_url: null } },
  { id: 'post-3', author_id: 'u1', caption: 'No photo this time', photo_path: null, created_at: '2026-09-16T12:00:00Z', profiles: { display_name: 'Jordan C.', initials: 'JC', avatar_url: null } },
];

const RATINGS = [
  { id: 'rating-1', user_id: 'u2', rating: 5, review: 'Best grain bowl in South Austin.', dish_name: 'Sunset Grain Bowl', receipt_photo_path: 'u2/receipt1.jpg', created_at: '2026-09-15T12:00:00Z', profiles: { display_name: 'Rae H.', initials: 'RH' } },
  { id: 'rating-2', user_id: 'u1', rating: 4, review: '', dish_name: 'Sunset Grain Bowl', receipt_photo_path: 'u1/receipt2.jpg', created_at: '2026-09-10T12:00:00Z', profiles: { display_name: 'Jordan C.', initials: 'JC' } },
];

const FOLLOWS = [{ followee_id: 'u2' }];
const CREDIBILITY = [
  { user_id: 'u2', foodie_score: 18 },
];

// One pre-existing pending claim on rest-3, made by someone other than
// the logged-in test user ("me-1") — used to test the generic "an
// ownership claim is under review" message a bystander sees. rest-4's
// pending claim belongs to "me-1" itself, to test the "your claim" text.
const CLAIM_REQUESTS = [
  { id: 'claim-1', restaurant_id: 'rest-3', user_id: 'u2', status: 'pending' },
  { id: 'claim-2', restaurant_id: 'rest-4', user_id: 'me-1', status: 'pending' },
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
        const match = idFilter ? RESTAURANTS.find((r) => r.id === idFilter[1]) : null;
        return Promise.resolve({ data: match || null, error: match ? null : { message: 'not found' } });
      }
      if (table === 'profiles') {
        return Promise.resolve({ data: { is_platform_admin: !!window.__IS_ADMIN__ }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'restaurant_claim_requests') {
        const restFilter = eqArgs.find((a) => a[0] === 'restaurant_id');
        const userFilter = eqArgs.find((a) => a[0] === 'user_id');
        const statusFilter = eqArgs.find((a) => a[0] === 'status');
        const match = CLAIM_REQUESTS.find((c) =>
          (!restFilter || c.restaurant_id === restFilter[1]) &&
          (!userFilter || c.user_id === userFilter[1]) &&
          (!statusFilter || c.status === statusFilter[1])
        );
        return Promise.resolve({ data: match || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'posts') {
        const restFilter = eqArgs.find((a) => a[0] === 'restaurant_id');
        result = restFilter && restFilter[1] === 'rest-1' ? POSTS : [];
      } else if (table === 'restaurant_ratings') {
        const restFilter = eqArgs.find((a) => a[0] === 'restaurant_id');
        result = restFilter && restFilter[1] === 'rest-1' ? RATINGS : [];
      } else if (table === 'profiles') {
        result = ME;
      } else if (table === 'follows') {
        result = FOLLOWS;
      } else if (table === 'reviewer_credibility') {
        result = CREDIBILITY;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    upsert(payload) {
      window.__RATING_UPSERTS__.push(payload);
      return Promise.resolve({ data: null, error: null });
    },
    insert(payload) {
      if (table === 'restaurant_claim_requests') {
        window.__CLAIM_INSERTS__.push(payload);
      }
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
    rpc: (fn, args) => {
      if (fn === 'update_restaurant_claimed_details') {
        window.__CLAIMED_DETAILS_RPCS__.push(args);
        const restaurant = RESTAURANTS.find((r) => r.id === args.p_restaurant_id);
        if (restaurant && restaurant.claimed_by === 'me-1' && restaurant.claim_status === 'approved') {
          restaurant.phone = args.p_phone;
          restaurant.website = args.p_website;
          restaurant.menu_url = args.p_menu_url;
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'You do not have an approved claim on this restaurant' } });
      }
      if (fn === 'set_restaurant_verified') {
        window.__VERIFIED_RPCS__.push(args);
        const restaurant = RESTAURANTS.find((r) => r.id === args.p_restaurant_id);
        if (restaurant) restaurant.is_verified = args.p_verified;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'set_restaurant_featured') {
        window.__FEATURED_RPCS__.push(args);
        const restaurant = RESTAURANTS.find((r) => r.id === args.p_restaurant_id);
        if (restaurant) {
          restaurant.featured_until = (args.p_days == null || args.p_days <= 0)
            ? null
            : new Date(Date.now() + args.p_days * 86400000).toISOString();
        }
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: 'https://example.com/' + bucket + '/' + path } }),
        upload: (path, file) => {
          if (bucket === 'restaurant-claim-proofs') {
            window.__CLAIM_PROOF_UPLOADS__.push({ bucket, path });
          } else {
            window.__RECEIPT_UPLOADS__.push({ bucket, path });
          }
          return Promise.resolve({ data: {}, error: null });
        },
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
