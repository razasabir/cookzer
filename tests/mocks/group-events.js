window.__CALLS__ = [];
window.__STATE__ = {
  group: { name: 'Weeknight Cooks', created_by: 'me-1' },
  myRole: 'member',
  events: [
    { id: 'ev-1', title: 'Sunday Roast', description: 'At Mum\'s place', event_at: '2030-01-06T18:00:00Z', location: 'Mum\'s house', created_by: 'me-1' },
  ],
  rsvps: [],
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
      if (table === 'group_events') result = window.__STATE__.events;
      else if (table === 'group_event_rsvps') result = window.__STATE__.rsvps;
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { builder._isDelete = true; return builder; },
    insert(payload) {
      window.__CALLS__.push({ op: 'insert', table, payload });
      if (table === 'group_events') {
        const row = Object.assign({ id: 'ev-' + (window.__STATE__.events.length + 1) }, payload);
        window.__STATE__.events.push(row);
      }
      return Promise.resolve({ data: null, error: null });
    },
    upsert(payload) {
      window.__CALLS__.push({ op: 'upsert', table, payload });
      if (table === 'group_event_rsvps') {
        const existing = window.__STATE__.rsvps.find((r) => r.event_id === payload.event_id && r.user_id === payload.user_id);
        if (existing) Object.assign(existing, payload);
        else window.__STATE__.rsvps.push(payload);
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const origThen = builder.then;
  builder.then = function (resolve) {
    if (builder._isDelete) {
      window.__CALLS__.push({ op: 'delete', table, filters: Object.assign({}, filters) });
      if (table === 'group_events') {
        window.__STATE__.events = window.__STATE__.events.filter((e) => e.id !== filters.id);
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
