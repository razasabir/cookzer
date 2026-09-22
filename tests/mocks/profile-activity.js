// Generic filter-driven mock, same shape as tests/mocks/profile-page.js
// (each table in __STATE__ is a plain array, eq/neq/in/is/not/ilike/order
// applied generically), extended with the tables the new profile
// features (Message button -> messenger.html, Lists, Activity stats,
// pinned recipe) touch that profile-page.js didn't need: recipe_lists,
// recipe_list_items, comments, hearts, and messenger's own
// conversations/conversation_participants/messages.
window.__CALLS__ = [];
window.__UPLOADS__ = [];
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME', bio: '', location: '', avatar_url: null, is_kitchen_cv: false, cv_title: '', cv_bio: '', open_to_work: false, cover_gradient: null, created_at: '2024-01-01T00:00:00Z', birthday_month: null, birthday_day: null, pinned_recipe_id: null },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD', bio: 'Baker', location: 'Austin', avatar_url: null, is_kitchen_cv: false, cv_title: '', cv_bio: '', open_to_work: false, cover_gradient: null, created_at: '2023-06-01T00:00:00Z', birthday_month: null, birthday_day: null, pinned_recipe_id: 'r1' },
  ],
  follows: [],
  user_blocks: [],
  recipes: [
    { id: 'r1', title: 'Sourdough Boule', author_id: 'alice-1', category: 'Baking', created_at: '2024-01-01T00:00:00Z' },
    { id: 'r2', title: 'Weeknight Tacos', author_id: 'alice-1', created_at: '2024-02-01T00:00:00Z' },
    { id: 'r3', title: 'Garlic Butter Pasta', author_id: 'me-1', created_at: '2024-02-15T00:00:00Z' },
  ],
  posts: [
    { id: 'p1', author_id: 'alice-1', kind: 'tip', created_at: '2024-03-01T00:00:00Z' },
    { id: 'p2', author_id: 'alice-1', kind: 'tip', created_at: '2024-03-02T00:00:00Z' },
    { id: 'p3', author_id: 'alice-1', kind: 'cook_in', created_at: new Date().toISOString() },
  ],
  comments: [
    { id: 'c1', author_id: 'alice-1', post_id: 'p1', text: 'Nice!', created_at: '2024-03-01T00:00:00Z' },
  ],
  hearts: [
    { user_id: 'alice-1', post_id: 'p1', created_at: '2024-03-01T00:00:00Z' },
    { user_id: 'alice-1', recipe_id: 'r2', created_at: '2024-03-01T00:00:00Z' },
  ],
  challenge_entries: [],
  challenges: [
    { id: 'chal-1', title: 'Budget Bites', winner_user_id: 'alice-1' },
  ],
  recipe_photos: [
    { id: 'ph1', user_id: 'alice-1', recipe_id: 'r1', storage_path: 'alice-1/x.jpg' },
  ],
  recipe_lists: [
    { id: 'list-1', owner_id: 'alice-1', name: 'Weeknight favorites', is_public: true, created_at: '2024-01-01T00:00:00Z', recipe_list_items: [{ recipe_id: 'r1' }, { recipe_id: 'r2' }] },
    { id: 'list-2', owner_id: 'alice-1', name: 'Private stash', is_public: false, created_at: '2024-01-02T00:00:00Z', recipe_list_items: [] },
  ],
  kitchen_cv_skills: [],
  kitchen_cv_endorsements: [],
  kitchen_cv_recommendations: [],
  post_bookmarks: [],
  conversations: [],
  conversation_participants: [],
  messages: [],
  profile_views: [],
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
    if (f.op === 'ilike') return String(v || '').toLowerCase().includes(f.val);
    if (f.op === 'gte') return v >= f.val;
    return true;
  });
}

function chain(table) {
  const filters = [];
  let wantCount = false;
  let orderSpec = null;
  const builder = {
    select(cols, opts) {
      if (opts && opts.count) wantCount = true;
      return builder;
    },
    eq(col, val) { filters.push({ col, op: 'eq', val }); return builder; },
    neq(col, val) { filters.push({ col, op: 'neq', val }); return builder; },
    in(col, vals) { filters.push({ col, op: 'in', val: vals }); return builder; },
    is(col, val) { filters.push({ col, op: 'is', val }); return builder; },
    not(col, _op, val) { filters.push({ col, op: 'not_is_null', val }); return builder; },
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
    gte(col, val) { filters.push({ col, op: 'gte', val }); return builder; },
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
      if (table === 'profiles') {
        // Recompute the pinned_recipe embed from pinned_recipe_id, since
        // this mock doesn't parse PostgREST embed syntax and update()
        // only touches the raw column. Applies to single()/maybeSingle()
        // too, not just the generic then() path, since loadProfile()
        // reads via .single().
        rows.forEach((r) => {
          const recipe = r.pinned_recipe_id
            ? window.__STATE__.recipes.find((x) => x.id === r.pinned_recipe_id)
            : null;
          r.pinned_recipe = recipe
            ? { id: recipe.id, title: recipe.title, hero_photo_path: recipe.hero_photo_path || null, category: recipe.category || null }
            : null;
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
    delete() { builder._isDelete = true; return builder; },
    update(payload) { builder._isUpdate = true; builder._payload = payload; return builder; },
    insert(payload) {
      const rowsToInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = rowsToInsert.map((r) => {
        const row = Object.assign({ id: table + '-new-' + (nextId++) }, r);
        if (table === 'conversation_participants') {
          const p = window.__STATE__.profiles.find((x) => x.id === row.user_id);
          row.profiles = p ? { display_name: p.display_name, initials: p.initials } : null;
        }
        return row;
      });
      window.__CALLS__.push({ op: 'insert', table, payload });
      window.__STATE__[table] = (window.__STATE__[table] || []).concat(inserted);
      const insertBuilder = {
        select() { return insertBuilder; },
        single() { return Promise.resolve({ data: inserted[0] || null, error: null }); },
        then(resolve) { return Promise.resolve({ data: inserted, error: null }).then(resolve); },
      };
      return insertBuilder;
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
      if (table === 'conversation_participants') {
        // Attach the joined fields loadConversations() asks for, since
        // this mock doesn't parse PostgREST embed syntax — pre-bake it
        // for every row, freshly inserted ones included.
        rows.forEach((r) => {
          if (!r.profiles) {
            const p = window.__STATE__.profiles.find((x) => x.id === r.user_id);
            r.profiles = p ? { display_name: p.display_name, initials: p.initials } : null;
          }
          const conv = window.__STATE__.conversations.find((c) => c.id === r.conversation_id);
          r.conversations = conv ? { name: conv.name || null } : null;
        });
      }
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
      from: (bucket) => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }),
        upload: (path, fileOrBlob) => {
          window.__UPLOADS__.push({ bucket, path, hasName: typeof fileOrBlob.name === 'string', size: fileOrBlob.size, type: fileOrBlob.type });
          return Promise.resolve({ data: {}, error: null });
        },
      }),
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, send: () => Promise.resolve('ok'), unsubscribe: () => Promise.resolve('ok') };
      return ch;
    },
    removeChannel: () => {},
  }),
};
