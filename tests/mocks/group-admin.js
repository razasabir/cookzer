window.__CALLS__ = [];
window.__STATE__ = {
  group: { id: 'g1', name: 'Weeknight Cooks', description: 'For quick meals', cover_gradient: null, created_by: 'me-1' },
  members: [
    { user_id: 'me-1', profiles: { display_name: 'Me', initials: 'ME' } },
    { user_id: 'bob-1', profiles: { display_name: 'Bob Ortiz', initials: 'BO' } },
  ],
};

function chain(table) {
  let filters = {};
  const builder = {
    select() { return builder; },
    eq(col, val) { filters[col] = val; return builder; },
    order() { return builder; },
    limit() { return builder; },
    single() {
      if (table === 'groups') return Promise.resolve({ data: window.__STATE__.group, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'group_members') {
        const found = window.__STATE__.members.find((m) => m.user_id === filters.user_id);
        return Promise.resolve({ data: found ? { user_id: found.user_id } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'group_members') result = window.__STATE__.members;
      else if (table === 'posts') result = [];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { builder._isDelete = true; return builder; },
    update(payload) {
      window.__CALLS__.push({ op: 'update', table, payload });
      Object.assign(window.__STATE__.group, payload);
      return builder;
    },
    insert() { return Promise.resolve({ data: null, error: null }); },
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
