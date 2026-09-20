window.__INSERTED_FAMILY_PROFILES__ = [];
window.__ADD_CO_ADMIN_CALLS__ = [];
window.__REMOVED_MEMBER_IDS__ = [];

const HOUSEHOLD = { id: 'household-1', name: null, household_size: 4 };

const ME_MEMBER = { user_id: 'me-1', joined_at: '2024-01-01T00:00:00Z', profiles: { display_name: 'Test Cook', initials: 'TC', avatar_url: null } };
const JORDAN_MEMBER = { user_id: 'friend-1', joined_at: '2024-01-02T00:00:00Z', profiles: { display_name: 'Jordan Lee', initials: 'JL', avatar_url: null } };

let members = [ME_MEMBER];
let profiles = [];

const FOLLOWS = [
  { followee_id: 'friend-1', profiles: { id: 'friend-1', display_name: 'Jordan Lee', initials: 'JL' } },
  { followee_id: 'friend-2', profiles: { id: 'friend-2', display_name: 'Casey Kim', initials: 'CK' } },
];

function chain(table) {
  let notArgs = null;
  const builder = {
    select() { return builder; },
    eq(col, val) { builder._eqId = val; return builder; },
    order() { return builder; },
    not(col, op, val) { notArgs = [col, op, val]; return builder; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    single() {
      if (table === 'households') return Promise.resolve({ data: HOUSEHOLD, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'household_members') result = members;
      else if (table === 'follows') result = FOLLOWS;
      else if (table === 'family_profiles') {
        result = (notArgs && notArgs[0] === 'linked_user_id')
          ? profiles.filter((p) => p.linked_user_id != null)
          : profiles;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    insert(payload) {
      if (table === 'family_profiles') {
        window.__INSERTED_FAMILY_PROFILES__.push(payload);
        profiles = profiles.concat([{
          id: 'fam-' + (profiles.length + 1),
          name: payload.name,
          avatar_emoji: payload.avatar_emoji,
          linked_user_id: payload.linked_user_id || null,
        }]);
      }
      return Promise.resolve({ data: null, error: null });
    },
    update() { return { eq: () => Promise.resolve({ data: null, error: null }) }; },
    delete() {
      return {
        eq(col1, val1) {
          return {
            eq(col2, val2) {
              if (table === 'household_members') {
                window.__REMOVED_MEMBER_IDS__.push(val2);
                members = members.filter((m) => m.user_id !== val2);
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
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
    rpc: (fn, params) => {
      if (fn === 'get_or_create_my_household') return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      if (fn === 'add_household_co_admin') {
        window.__ADD_CO_ADMIN_CALLS__.push(params);
        if (params.p_invitee_user_id === 'friend-1') members = members.concat([JORDAN_MEMBER]);
        return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
