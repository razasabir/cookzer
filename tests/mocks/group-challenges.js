// Generic filter-driven mock for cookzer-group-challenges.html — a
// group ('group-1') 'me-1' is a member of, with one active challenge
// (already entered by 'alice-1') and one ended challenge with an entry
// to be lazily finalized into a winner.
window.__CALLS__ = [];
const NOW = Date.now();
window.__STATE__ = {
  groups: [{ id: 'group-1', name: 'The Weeknight Cooks' }],
  group_members: [{ group_id: 'group-1', user_id: 'me-1', role: 'member' }],
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME' },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD' },
  ],
  challenges: [
    {
      id: 'gchal-active', title: 'Sunday Roast Showdown', description: 'Best Sunday roast wins.', category: 'cuisine',
      group_id: 'group-1', created_by: 'alice-1', ends_at: new Date(NOW + 4 * 86400000).toISOString(), winner_user_id: null,
    },
    {
      id: 'gchal-ended', title: 'Taco Tuesday', description: null, category: null,
      group_id: 'group-1', created_by: 'me-1', ends_at: new Date(NOW - 86400000).toISOString(), winner_user_id: null,
    },
  ],
  challenge_entries: [
    { id: 'gentry-1', challenge_id: 'gchal-active', user_id: 'alice-1', post_id: 'gpost-1' },
    { id: 'gentry-2', challenge_id: 'gchal-ended', user_id: 'alice-1', post_id: 'gpost-2' },
  ],
  posts: [
    { id: 'gpost-1', recipe_id: 'gr1', recipes: { id: 'gr1', title: 'Herb-Crusted Chicken' } },
    { id: 'gpost-2', recipe_id: null, recipes: null },
  ],
  hearts: [{ post_id: 'gpost-2' }],
  recipes: [{ id: 'gr1' }],
};
let nextId = 1;

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'is') return f.val === null ? (v === null || v === undefined) : v === f.val;
    if (f.op === 'not_is_null') return v !== null && v !== undefined;
    return true;
  });
}

function chain(table) {
  const filters = [];
  let orderSpec = null;
  const builder = {
    select() { return builder; },
    eq(col, val) { filters.push({ col, op: 'eq', val }); return builder; },
    in(col, vals) { filters.push({ col, op: 'in', val: vals }); return builder; },
    is(col, val) { filters.push({ col, op: 'is', val }); return builder; },
    not(col, _op, val) { filters.push({ col, op: 'not_is_null', val }); return builder; },
    order(col, opts) { orderSpec = { col, asc: !(opts && opts.ascending === false) }; return builder; },
    limit() { return builder; },
    rows() {
      let rows = (window.__STATE__[table] || []).filter((r) => matches(r, filters));
      if (orderSpec) {
        rows = rows.slice().sort((a, b) => {
          if (a[orderSpec.col] < b[orderSpec.col]) return orderSpec.asc ? -1 : 1;
          if (a[orderSpec.col] > b[orderSpec.col]) return orderSpec.asc ? 1 : -1;
          return 0;
        });
      }
      if (table === 'challenges') {
        rows.forEach((r) => {
          const creator = window.__STATE__.profiles.find((p) => p.id === r.created_by);
          r.profiles = creator ? { display_name: creator.display_name } : null;
        });
      }
      if (table === 'challenge_entries') {
        rows.forEach((r) => {
          const p = window.__STATE__.profiles.find((x) => x.id === r.user_id);
          r.profiles = p ? { id: p.id, display_name: p.display_name, initials: p.initials } : null;
          const post = window.__STATE__.posts.find((x) => x.id === r.post_id);
          r.posts = post ? { recipe_id: post.recipe_id, recipes: post.recipes } : null;
        });
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
    update(payload) {
      return {
        eq(col, val) {
          const rows = (window.__STATE__[table] || []).filter((r) => r[col] === val);
          window.__CALLS__.push({ op: 'update', table, col, val, payload });
          rows.forEach((r) => Object.assign(r, payload));
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    upsert(payload, opts) {
      const rowsToUpsert = Array.isArray(payload) ? payload : [payload];
      window.__CALLS__.push({ op: 'upsert', table, payload });
      rowsToUpsert.forEach((r) => {
        const conflictCols = (opts && opts.onConflict ? opts.onConflict.split(',') : ['id']);
        const existing = (window.__STATE__[table] || []).find((row) => conflictCols.every((c) => row[c] === r[c]));
        if (existing) Object.assign(existing, r);
        else window.__STATE__[table] = (window.__STATE__[table] || []).concat([{ id: table + '-new-' + (nextId++), ...r }]);
      });
      return Promise.resolve({ data: null, error: null });
    },
    insert(payload) {
      const rowsToInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = rowsToInsert.map((r) => Object.assign({ id: table + '-new-' + (nextId++) }, r));
      window.__CALLS__.push({ op: 'insert', table, payload });
      window.__STATE__[table] = (window.__STATE__[table] || []).concat(inserted);
      return { select() { return { single: () => Promise.resolve({ data: inserted[0], error: null }) }; } };
    },
    then(resolve) {
      return Promise.resolve({ data: builder.rows(), error: null }).then(resolve);
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
