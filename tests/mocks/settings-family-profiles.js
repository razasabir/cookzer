window.__INSERTED_FAMILY_PROFILES__ = [];
window.__DELETED_FAMILY_PROFILE_IDS__ = [];
window.__PROFILE_UPDATES__ = [];

let profiles = [{ id: 'fam-1', name: 'Emma', avatar_emoji: '👧' }];

function chain(table) {
  const builder = {
    select() { return builder; },
    eq(col, val) { builder._eqId = val; return builder; },
    order() { return builder; },
    maybeSingle() {
      if (table === 'profiles') return Promise.resolve({ data: { display_name: 'Test Cook', household_size: 4 }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    single() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      let result = [];
      if (table === 'family_profiles') result = profiles;
      else if (table === 'profiles') result = { display_name: 'Test Cook' };
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    insert(payload) {
      if (table === 'family_profiles') {
        window.__INSERTED_FAMILY_PROFILES__.push(payload);
        profiles = profiles.concat([{ id: 'fam-2', name: payload.name, avatar_emoji: payload.avatar_emoji }]);
      }
      return Promise.resolve({ data: null, error: null });
    },
    update(payload) {
      if (table === 'profiles') window.__PROFILE_UPDATES__.push(payload);
      return { eq: () => Promise.resolve({ data: null, error: null }) };
    },
    delete() {
      return {
        eq(col, val) {
          window.__DELETED_FAMILY_PROFILE_IDS__.push(val);
          profiles = profiles.filter((p) => p.id !== val);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
