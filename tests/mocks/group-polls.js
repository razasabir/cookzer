window.__CALLS__ = [];
window.__STATE__ = {
  group: { name: 'Weeknight Cooks', created_by: 'me-1' },
  myRole: 'member',
  polls: [
    { id: 'poll-1', question: 'Pizza or tacos Friday?', created_by: 'me-1', created_at: '2024-01-01T00:00:00Z' },
  ],
  options: [
    { id: 'opt-1', poll_id: 'poll-1', option_text: 'Pizza', position: 0 },
    { id: 'opt-2', poll_id: 'poll-1', option_text: 'Tacos', position: 1 },
  ],
  votes: [],
};

function chain(table) {
  let filters = {};
  const builder = {
    select() { return builder; },
    eq(col, val) { filters[col] = val; return builder; },
    in() { return builder; },
    order() { return builder; },
    single() {
      if (table === 'groups') return Promise.resolve({ data: window.__STATE__.group, error: null });
      if (table === 'group_polls' && builder._lastInsert) return Promise.resolve({ data: builder._lastInsert, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'group_members') {
        return Promise.resolve({ data: window.__STATE__.myRole ? { role: window.__STATE__.myRole } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'group_polls') result = window.__STATE__.polls;
      else if (table === 'group_poll_options') result = window.__STATE__.options;
      else if (table === 'group_poll_votes') result = window.__STATE__.votes;
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { builder._isDelete = true; return builder; },
    insert(payload) {
      window.__CALLS__.push({ op: 'insert', table, payload });
      if (table === 'group_polls') {
        const row = Object.assign({ id: 'poll-' + (window.__STATE__.polls.length + 1) }, payload);
        window.__STATE__.polls.push(row);
        builder._lastInsert = row;
      } else if (table === 'group_poll_options') {
        const rows = payload.map((opt, i) => Object.assign({ id: 'opt-new-' + i }, opt));
        window.__STATE__.options.push(...rows);
      }
      return builder;
    },
    upsert(payload) {
      window.__CALLS__.push({ op: 'upsert', table, payload });
      if (table === 'group_poll_votes') {
        const existing = window.__STATE__.votes.find((v) => v.poll_id === payload.poll_id && v.user_id === payload.user_id);
        if (existing) Object.assign(existing, payload);
        else window.__STATE__.votes.push(payload);
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const origThen = builder.then;
  builder.then = function (resolve) {
    if (builder._isDelete) {
      window.__CALLS__.push({ op: 'delete', table, filters: Object.assign({}, filters) });
      if (table === 'group_polls') {
        window.__STATE__.polls = window.__STATE__.polls.filter((p) => p.id !== filters.id);
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
