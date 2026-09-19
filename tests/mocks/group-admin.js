window.__CALLS__ = [];
window.__STATE__ = {
  group: { id: 'g1', name: 'Weeknight Cooks', description: 'For quick meals', cover_gradient: null, cover_photo_path: null, created_by: 'me-1', is_private: false, invite_code: null, rules: null },
  members: [
    { user_id: 'me-1', role: 'member', muted: false, profiles: { display_name: 'Me', initials: 'ME' } },
    { user_id: 'bob-1', role: 'member', muted: false, profiles: { display_name: 'Bob Ortiz', initials: 'BO' } },
  ],
  posts: [
    { id: 'post-1', author_id: 'me-1', caption: 'First post', photo_path: null, created_at: '2024-01-01T10:00:00Z', pinned_at: null, profiles: { display_name: 'Me', initials: 'ME' } },
    { id: 'post-2', author_id: 'bob-1', caption: 'Second post', photo_path: null, created_at: '2024-01-02T10:00:00Z', pinned_at: null, profiles: { display_name: 'Bob Ortiz', initials: 'BO' } },
  ],
};

const PROFILE_DIRECTORY = [{ id: 'carol-1', display_name: 'Carol Diaz', initials: 'CD' }];

function chain(table) {
  let filters = {};
  let ilikeQuery = null;
  const builder = {
    select() { return builder; },
    eq(col, val) { filters[col] = val; return builder; },
    in() { return builder; },
    ilike(col, pattern) { ilikeQuery = String(pattern).replace(/%/g, '').toLowerCase(); return builder; },
    order() { return builder; },
    limit() { return builder; },
    single() {
      if (table === 'groups') return Promise.resolve({ data: window.__STATE__.group, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'group_members') {
        const found = window.__STATE__.members.find((m) => m.user_id === filters.user_id);
        return Promise.resolve({ data: found || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'group_members') result = window.__STATE__.members;
      else if (table === 'posts') result = window.__STATE__.posts;
      else if (table === 'profiles' && ilikeQuery) {
        result = PROFILE_DIRECTORY.filter((p) => p.display_name.toLowerCase().includes(ilikeQuery));
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { builder._isDelete = true; return builder; },
    update(payload) { builder._isUpdate = true; builder._updatePayload = payload; return builder; },
    insert(payload) {
      window.__CALLS__.push({ op: 'insert', table, payload });
      if (table === 'group_members') {
        const profile = PROFILE_DIRECTORY.find((p) => p.id === payload.user_id);
        window.__STATE__.members.push({
          user_id: payload.user_id,
          role: 'member',
          profiles: profile ? { display_name: profile.display_name, initials: profile.initials } : null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const origThen = builder.then;
  builder.then = function (resolve) {
    if (builder._isDelete) {
      window.__CALLS__.push({ op: 'delete', table, filters: Object.assign({}, filters) });
      if (table === 'group_members') {
        window.__STATE__.members = window.__STATE__.members.filter((m) => m.user_id !== filters.user_id);
      } else if (table === 'groups') {
        window.__STATE__.groupDeleted = true;
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    }
    if (builder._isUpdate) {
      window.__CALLS__.push({ op: 'update', table, filters: Object.assign({}, filters), payload: builder._updatePayload });
      if (table === 'groups') {
        Object.assign(window.__STATE__.group, builder._updatePayload);
      } else if (table === 'group_members') {
        const m = window.__STATE__.members.find((mm) => mm.user_id === filters.user_id);
        if (m) Object.assign(m, builder._updatePayload);
      } else if (table === 'posts') {
        const p = window.__STATE__.posts.find((pp) => pp.id === filters.id);
        if (p) Object.assign(p, builder._updatePayload);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    }
    return origThen(resolve);
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
