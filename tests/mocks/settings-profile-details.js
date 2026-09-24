// Focused mock for the Settings page's Privacy/Profile-details section
// (profile_visibility toggle, social links, dietary tags — migration 053),
// also reused for the self-service DSAR buttons (migration 057) since it
// already has a working auth/profile init flow.
window.__PROFILE_UPDATES__ = [];
window.__RPC_CALLS__ = [];

const PROFILE = {
  id: 'me-1',
  display_name: 'Test Cook',
  profile_visibility: 'public',
  social_links: { instagram: 'https://instagram.com/testcook' },
  dietary_tags: ['Vegan'],
};
const HOUSEHOLD = { id: 'household-1', name: null, household_size: 4 };

function chain(table) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    not() { return builder; },
    maybeSingle() {
      if (table === 'profiles') return Promise.resolve({ data: PROFILE, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      if (table === 'households') return Promise.resolve({ data: HOUSEHOLD, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'family_profiles') result = [];
      else if (table === 'follows') result = [];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    update(payload) {
      if (table === 'profiles') {
        window.__PROFILE_UPDATES__.push(payload);
        Object.assign(PROFILE, payload);
      }
      return { eq: () => Promise.resolve({ data: null, error: null }) };
    },
    insert() { return Promise.resolve({ data: null, error: null }); },
    delete() { return { eq: () => Promise.resolve({ data: null, error: null }) }; },
    upsert() { return Promise.resolve({ data: null, error: null }); },
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
    rpc: (fn, args) => {
      window.__RPC_CALLS__.push({ fn, args });
      if (fn === 'get_or_create_my_household') return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      if (fn === 'file_dsar_request') return Promise.resolve({ data: 'dsar-request-1', error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
