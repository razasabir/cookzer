// Generic filter-driven mock (same shape as tests/mocks/profile-activity.js)
// for the Feed page, built specifically to exercise profile-hover-card.js:
// a post authored by 'author-1', who has 3 recipes, 2 followers, and a
// 2-day cook-in streak (today + yesterday), plus a bio/location line.
window.__CALLS__ = [];
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME', avatar_url: null, bio: '', location: '' },
    { id: 'author-1', display_name: 'Alice Diaz', initials: 'AD', avatar_url: null, bio: 'Baker from Austin', location: 'Austin' },
  ],
  recipes: [
    { id: 'r1', author_id: 'author-1' },
    { id: 'r2', author_id: 'author-1' },
    { id: 'r3', author_id: 'author-1' },
  ],
  follows: [
    { follower_id: 'x1', followee_id: 'author-1', created_at: '2024-01-01T00:00:00Z' },
    { follower_id: 'x2', followee_id: 'author-1', created_at: '2024-01-02T00:00:00Z' },
  ],
  posts: [
    {
      id: 'post-1', author_id: 'author-1', kind: 'post', recipe_id: null, caption: 'Dinner tonight',
      photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(),
      profiles: { display_name: 'Alice Diaz', initials: 'AD', avatar_url: null }, recipes: null,
    },
    {
      id: 'ci-1', author_id: 'author-1', kind: 'cook_in', recipe_id: null, caption: null,
      photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(),
      profiles: { display_name: 'Alice Diaz', initials: 'AD', avatar_url: null }, recipes: null,
    },
    {
      id: 'ci-2', author_id: 'author-1', kind: 'cook_in', recipe_id: null, caption: null,
      photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date(Date.now() - 86400000).toISOString(),
      profiles: { display_name: 'Alice Diaz', initials: 'AD', avatar_url: null }, recipes: null,
    },
  ],
  hearts: [],
  comments: [],
  post_bookmarks: [],
  challenge_entries: [],
  challenges: [],
  user_blocks: [],
  notifications: [],
  pymk_dismissals: [],
  group_members: [],
};

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'neq') return v !== f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'is') return f.val === null ? (v === null || v === undefined) : v === f.val;
    if (f.op === 'not_is_null') return v !== null && v !== undefined;
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
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
    gte() { return builder; },
    lte() { return builder; },
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
    update() { return builder; },
    upsert() { return Promise.resolve({ data: null, error: null }); },
    insert(payload) {
      window.__CALLS__.push({ op: 'insert', table, payload });
      return { select() { return { single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }; } };
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
