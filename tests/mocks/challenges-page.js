// Generic filter-driven mock (same shape as tests/mocks/profile-activity.js)
// for cookzer-challenges.html: the multi-challenge, weekly-auto-seeded,
// leaderboard-per-card, winner-on-ended-challenges redesign.
window.__CALLS__ = [];
const NOW = Date.now();
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME' },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD' },
    { id: 'bob-1', display_name: 'Bob Ortiz', initials: 'BO' },
  ],
  // Seeded with one already-running sitewide challenge — this.ends_at is
  // in the future, so ensureWeeklyChallenge() should NOT auto-seed a
  // second one on top of it.
  challenges: [
    {
      id: 'chal-active', title: 'Budget Bites', description: 'Under $5 a serving.', category: 'budget',
      group_id: null, is_auto_generated: true, created_by: 'alice-1',
      ends_at: new Date(NOW + 5 * 86400000).toISOString(), winner_user_id: null, winner_computed_at: null,
    },
    {
      id: 'chal-ended', title: 'Weeknight Pasta', description: 'Any pasta, any night.', category: 'cuisine',
      group_id: null, is_auto_generated: false, created_by: 'bob-1',
      ends_at: new Date(NOW - 2 * 86400000).toISOString(), winner_user_id: null, winner_computed_at: null,
    },
  ],
  challenge_entries: [
    { id: 'entry-1', challenge_id: 'chal-active', user_id: 'alice-1', post_id: 'post-1' },
    { id: 'entry-2', challenge_id: 'chal-ended', user_id: 'bob-1', post_id: 'post-2' },
    { id: 'entry-3', challenge_id: 'chal-ended', user_id: 'alice-1', post_id: 'post-3' },
  ],
  posts: [
    { id: 'post-1', recipe_id: 'r1', recipes: { id: 'r1', title: 'Lentil Soup' } },
    { id: 'post-2', recipe_id: 'r2', recipes: { id: 'r2', title: 'Cacio e Pepe' } },
    { id: 'post-3', recipe_id: null, recipes: null },
  ],
  hearts: [
    { post_id: 'post-2' },
    { post_id: 'post-2' },
    { post_id: 'post-3' },
  ],
  recipes: [
    { id: 'r1', ingredients: [] },
    { id: 'r2', ingredients: [] },
  ],
  group_members: [],
};
let nextId = 1;

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'neq') return v !== f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'is') return f.val === null ? (v === null || v === undefined) : v === f.val;
    if (f.op === 'not_is_null') return v !== null && v !== undefined;
    if (f.op === 'gt') return new Date(v).getTime() > new Date(f.val).getTime();
    if (f.op === 'lt') return new Date(v).getTime() < new Date(f.val).getTime();
    if (f.op === 'gte') return new Date(v).getTime() >= new Date(f.val).getTime();
    if (f.op === 'lte') return new Date(v).getTime() <= new Date(f.val).getTime();
    if (f.op === 'ilike') return String(v || '').toLowerCase().includes(f.val);
    return true;
  });
}

function chain(table) {
  const filters = [];
  let wantCount = false;
  let orderSpec = null;
  const builder = {
    select(cols, opts) { if (opts && opts.count) wantCount = true; return builder; },
    eq(col, val) { filters.push({ col, op: 'eq', val }); return builder; },
    neq(col, val) { filters.push({ col, op: 'neq', val }); return builder; },
    in(col, vals) { filters.push({ col, op: 'in', val: vals }); return builder; },
    is(col, val) { filters.push({ col, op: 'is', val }); return builder; },
    not(col, _op, val) { filters.push({ col, op: 'not_is_null', val }); return builder; },
    gt(col, val) { filters.push({ col, op: 'gt', val }); return builder; },
    lt(col, val) { filters.push({ col, op: 'lt', val }); return builder; },
    gte(col, val) { filters.push({ col, op: 'gte', val }); return builder; },
    lte(col, val) { filters.push({ col, op: 'lte', val }); return builder; },
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
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
      // Pre-baked embeds — this mock doesn't parse PostgREST embed
      // syntax, so attach the fields each page's select() asks for
      // directly, looked up from the flat seed tables above.
      if (table === 'challenges') {
        rows.forEach((r) => {
          const creator = window.__STATE__.profiles.find((p) => p.id === r.created_by);
          r.profiles = creator ? { display_name: creator.display_name } : null;
          const winner = r.winner_user_id ? window.__STATE__.profiles.find((p) => p.id === r.winner_user_id) : null;
          r.winner_profile = winner || null;
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
    delete() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
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
      return Promise.resolve({ data: inserted, error: null });
    },
    then(resolve) {
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
