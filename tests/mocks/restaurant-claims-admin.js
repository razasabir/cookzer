window.__REVIEW_CLAIM_RPCS__ = [];

const ADMIN_PROFILE = { is_platform_admin: true };

let CLAIMS = [
  {
    id: 'claim-1',
    restaurant_id: 'rest-1',
    user_id: 'u1',
    business_email: 'owner@marfabowl.com',
    business_phone: '512-555-0100',
    proof_photo_path: 'u1/proof1.jpg',
    created_at: '2026-09-19T12:00:00Z',
    restaurants: { name: 'Marfa Bowl Co.', address: '1108 S Congress Ave, Austin, TX' },
    profiles: { display_name: 'Jordan C.', initials: 'JC' },
  },
  {
    id: 'claim-2',
    restaurant_id: 'rest-2',
    user_id: 'u2',
    business_email: 'owner@owned-eats.com',
    business_phone: null,
    proof_photo_path: 'u2/proof2.jpg',
    created_at: '2026-09-20T12:00:00Z',
    restaurants: { name: 'Owned Eats', address: '200 Main St, Austin, TX' },
    profiles: { display_name: 'Rae H.', initials: 'RH' },
  },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    order() { return builder; },
    single() {
      if (table === 'profiles') {
        return Promise.resolve({ data: ADMIN_PROFILE, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'restaurant_claim_requests') {
        const statusFilter = eqArgs.find((a) => a[0] === 'status');
        result = CLAIMS.filter((c) => !statusFilter || c.status !== 'resolved');
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token', user: { id: 'admin-1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'admin-1', email: 'razasabir@gmail.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    rpc: (fn, args) => {
      if (fn === 'review_restaurant_claim') {
        window.__REVIEW_CLAIM_RPCS__.push(args);
        CLAIMS = CLAIMS.map((c) => (c.id === args.p_claim_id ? { ...c, status: 'resolved' } : c));
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: (bucket) => ({
        createSignedUrl: (path, expiresIn) => Promise.resolve({ data: { signedUrl: 'https://example.com/' + bucket + '/' + path + '?signed=1' }, error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
