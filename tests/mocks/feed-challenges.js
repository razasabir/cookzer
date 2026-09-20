// Generic filter-driven mock (same shape as tests/mocks/profile-activity.js)
// for the Feed page, built to exercise the Challenges integration added
// to cookzer-feed.html: the sidebar widget, the 🏆 badge on a post
// that's a challenge entry, and the "last week's winner" banner.
window.__CALLS__ = [];
const NOW = Date.now();
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME', avatar_url: null },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD', avatar_url: null },
  ],
  challenges: [
    {
      id: 'chal-active', title: 'Budget Bites', description: 'Under $5 a serving.', category: 'budget',
      group_id: null, is_auto_generated: true, ends_at: new Date(NOW + 5 * 86400000).toISOString(),
      winner_user_id: null,
    },
    {
      id: 'chal-ended', title: 'Weeknight Pasta', description: null, category: 'cuisine',
      group_id: null, is_auto_generated: false, ends_at: new Date(NOW - 2 * 86400000).toISOString(),
      winner_user_id: 'alice-1', winner_profile: { display_name: 'Alice Diaz', initials: 'AD' },
    },
  ],
  challenge_entries: [
    { id: 'entry-1', challenge_id: 'chal-active', user_id: 'alice-1', post_id: 'post-1', challenges: { title: 'Budget Bites' } },
  ],
  posts: [
    {
      id: 'post-1', author_id: 'alice-1', kind: 'post', recipe_id: null, caption: 'Under-budget dinner',
      photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(),
      profiles: { display_name: 'Alice Diaz', initials: 'AD', avatar_url: null }, recipes: null,
    },
  ],
  hearts: [],
  comments: [],
  post_bookmarks: [],
  recipes: [],
  follows: [],
  user_blocks: [],
  notifications: [],
  pymk_dismissals: [],
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
    gte() { return builder; },
    lte() { return builder; },
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
    filter() { return builder; },
    order(col, opts) { orderSpec = { col, asc: !(opts && opts.ascending === false) }; return builder; },
    limit() { return builder; },
    range() { return builder; },
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
        rows.forEach((r) => { if (r.winner_user_id && !r.winner_profile) r.winner_profile = null; r.profiles = r.winner_profile; });
      }
      if (table === 'challenge_entries') {
        rows.forEach((r) => {
          const p = window.__STATE__.profiles.find((x) => x.id === r.user_id);
          r.profiles = p ? { display_name: p.display_name, initials: p.initials } : null;
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
      return { select() { return { single: () => Promise.resolve({ data: inserted[0], error: null }) }; } };
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
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }),
        upload: () => Promise.resolve({ data: {}, error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
