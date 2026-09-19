// Generic filter-driven mock for cookzer-friends.html (People You May
// Know, Invite Friends) and, via auth-guard.js loading on the same
// page, the invite-link referral-capture flow. Same generic
// filters-over-arrays engine as tests/mocks/profile-page.js.
window.__CALLS__ = [];
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME', referred_by: null },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD' },
    { id: 'bob-1', display_name: 'Bob Ortiz', initials: 'BO' },
    { id: 'carol-1', display_name: 'Carol Diaz', initials: 'CD' },
    { id: 'dave-1', display_name: 'Dave Kim', initials: 'DK' },
    { id: 'erin-1', display_name: 'Erin Fox', initials: 'EF' },
    { id: 'frank-1', display_name: 'Frank Lee', initials: 'FL' },
  ],
  follows: [
    { follower_id: 'me-1', followee_id: 'alice-1', created_at: '2024-01-01T00:00:00Z' },
    { follower_id: 'me-1', followee_id: 'frank-1', created_at: '2024-01-01T00:00:00Z' },
    { follower_id: 'bob-1', followee_id: 'me-1', created_at: '2024-01-01T00:00:00Z' },
    { follower_id: 'alice-1', followee_id: 'dave-1', created_at: '2024-01-01T00:00:00Z' },
    { follower_id: 'alice-1', followee_id: 'frank-1', created_at: '2024-01-01T00:00:00Z' },
  ],
  group_members: [
    { group_id: 'g1', user_id: 'me-1' },
    { group_id: 'g1', user_id: 'erin-1' },
  ],
  pymk_dismissals: [],
  user_blocks: [],
};
let nextId = 1;

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'neq') return v !== f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'is') return f.val === null ? (v === null || v === undefined) : v === f.val;
    if (f.op === 'ilike') return String(v || '').toLowerCase().includes(f.val);
    return true;
  });
}

function profileById(id) {
  return window.__STATE__.profiles.find((p) => p.id === id) || null;
}

function chain(table) {
  const filters = [];
  let wantCount = false;
  let selectStr = '';
  const builder = {
    select(cols, opts) {
      selectStr = cols || '';
      if (opts && opts.count) wantCount = true;
      return builder;
    },
    eq(col, val) { filters.push({ col, op: 'eq', val }); return builder; },
    neq(col, val) { filters.push({ col, op: 'neq', val }); return builder; },
    in(col, vals) { filters.push({ col, op: 'in', val: vals }); return builder; },
    is(col, val) { filters.push({ col, op: 'is', val }); return builder; },
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
    order() { return builder; },
    limit() { return builder; },
    rows() {
      let rows = (window.__STATE__[table] || []).filter((r) => matches(r, filters));
      if (table === 'follows' && selectStr.indexOf('follows_followee_id_fkey') !== -1) {
        rows = rows.map((r) => Object.assign({}, r, { profiles: profileById(r.followee_id) }));
      } else if (table === 'follows' && selectStr.indexOf('follows_follower_id_fkey') !== -1) {
        rows = rows.map((r) => Object.assign({}, r, { profiles: profileById(r.follower_id) }));
      } else if (table === 'user_blocks' && selectStr.indexOf('user_blocks_blocked_id_fkey') !== -1) {
        rows = rows.map((r) => Object.assign({}, r, { profiles: profileById(r.blocked_id) }));
      }
      return rows;
    },
    single() {
      const rows = builder.rows();
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    maybeSingle() {
      const rows = builder.rows();
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    delete() { builder._isDelete = true; return builder; },
    update(payload) { builder._isUpdate = true; builder._payload = payload; return builder; },
    insert(payload) {
      const rowsToInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = rowsToInsert.map((r) => Object.assign({ id: table + '-new-' + (nextId++) }, r));
      window.__CALLS__.push({ op: 'insert', table, payload });
      window.__STATE__[table] = (window.__STATE__[table] || []).concat(inserted);
      return {
        select() { return this; },
        single() { return Promise.resolve({ data: inserted[0] || null, error: null }); },
        then(resolve) { return Promise.resolve({ data: inserted, error: null }).then(resolve); },
      };
    },
    then(resolve) {
      if (builder._isDelete) {
        const rows = builder.rows();
        window.__CALLS__.push({ op: 'delete', table, filters: filters.slice() });
        window.__STATE__[table] = (window.__STATE__[table] || []).filter((r) => !rows.includes(r));
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      if (builder._isUpdate) {
        const rows = builder.rows();
        window.__CALLS__.push({ op: 'update', table, filters: filters.slice(), payload: builder._payload });
        rows.forEach((r) => Object.assign(r, builder._payload));
        return Promise.resolve({ data: rows.map((r) => ({ id: r.id })), error: null }).then(resolve);
      }
      const rows = builder.rows();
      if (wantCount) return Promise.resolve({ data: null, error: null, count: rows.length }).then(resolve);
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
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
