window.__CALLS__ = [];
window.__PREFS_SAVED__ = [];

const HOUSEHOLD = { id: 'household-1', name: null, household_size: 4 };

window.__SEED_PREFS__ = window.__SEED_PREFS__ || {
  notify_follows: true, notify_hearts: false, notify_comments: true,
  notify_remakes: true, notify_challenge_joins: false,
  notify_messages: true, notify_reviews: false, notify_group_joins: true,
  notify_email: false, notify_push: false,
};

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    is() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle() {
      window.__CALLS__.push({ table, method: 'maybeSingle', eqArgs });
      if (table === 'notification_prefs') return Promise.resolve({ data: window.__SEED_PREFS__, error: null });
      if (table === 'profiles') return Promise.resolve({ data: { display_name: 'Test Cook' }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      window.__CALLS__.push({ table, method: 'single', eqArgs });
      if (table === 'profiles') return Promise.resolve({ data: { display_name: 'Test Cook', initials: 'TC', avatar_url: null }, error: null });
      if (table === 'households') return Promise.resolve({ data: HOUSEHOLD, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    upsert(payload) {
      window.__PREFS_SAVED__.push(payload);
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      window.__CALLS__.push({ table, method: 'then', eqArgs });
      const result = table === 'notifications' ? { data: [], count: 0 } : { data: [], count: 0 };
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
      updateUser: () => Promise.resolve({ data: {}, error: null }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    rpc: (fn) => {
      if (fn === 'get_or_create_my_household') return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
