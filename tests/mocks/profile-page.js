// Generic filter-driven mock for cookzer-profile.html: rather than
// special-casing every query the page fires (there are a couple dozen
// across loadProfile/loadStats/loadRecipesView), each table in
// __STATE__ is a plain array and eq/neq/in/is/not/ilike/order are
// applied generically against it. Rows that need an embedded relation
// (e.g. a recommendation's author profile) carry it pre-baked, the same
// way every other mock in this suite sidesteps parsing PostgREST
// select-string syntax.
window.__CALLS__ = [];
window.__UPLOADS__ = [];
window.__STATE__ = {
  profiles: [
    { id: 'me-1', display_name: 'Me', initials: 'ME', bio: '', location: '', avatar_url: null, is_kitchen_cv: true, cv_title: 'Home cook', cv_bio: '', open_to_work: false, cover_gradient: null, created_at: '2024-01-01T00:00:00Z', birthday_month: null, birthday_day: null },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD', bio: 'Baker', location: 'Austin', avatar_url: null, is_kitchen_cv: true, cv_title: 'Pastry chef', cv_bio: 'Sourdough specialist', open_to_work: true, cover_gradient: null, created_at: '2023-06-01T00:00:00Z', birthday_month: 3, birthday_day: 14 },
    { id: 'bob-1', display_name: 'Bob Ortiz', initials: 'BO' },
    { id: 'carol-1', display_name: 'Carol Diaz', initials: 'CD' },
  ],
  follows: [
    { follower_id: 'me-1', followee_id: 'bob-1' },
    { follower_id: 'alice-1', followee_id: 'bob-1' },
  ],
  user_blocks: [],
  recipes: [],
  posts: [],
  challenge_entries: [],
  recipe_photos: [],
  kitchen_cv_skills: [
    { id: 'skill-1', profile_id: 'alice-1', skill: 'Baking', created_at: '2024-01-01T00:00:00Z' },
  ],
  kitchen_cv_endorsements: [],
  kitchen_cv_recommendations: [
    { id: 'rec-1', profile_id: 'me-1', author_id: 'alice-1', body: 'Great cook, always brings the best dishes to potlucks!', status: 'pending', created_at: '2024-02-01T00:00:00Z', profiles: { display_name: 'Alice Diaz', initials: 'AD' } },
  ],
  post_bookmarks: [],
};
let nextId = 1;

// Mirrors public.get_public_profile_preview(p_id) from migration 053:
// returns the same whitelisted columns + counts, only for a
// profile_visibility === 'public' row, null/empty otherwise. Tests for
// the logged-out preview call this through sb.rpc(), same as the real
// page — see profile-page-logged-out.js for the no-session variant.
window.__RPC_HANDLERS__ = {
  get_public_profile_preview: (params) => {
    const p = window.__STATE__.profiles.find((row) => row.id === params.p_id);
    if (!p || (p.profile_visibility || 'public') !== 'public') return [];
    const pinned = p.pinned_recipe_id
      ? window.__STATE__.recipes.find((r) => r.id === p.pinned_recipe_id)
      : null;
    return [{
      id: p.id,
      display_name: p.display_name,
      initials: p.initials,
      avatar_url: p.avatar_url || null,
      bio: p.bio || null,
      location: p.location || null,
      cover_gradient: p.cover_gradient || null,
      is_kitchen_cv: !!p.is_kitchen_cv,
      cv_title: p.cv_title || null,
      is_verified_creator: !!p.is_verified_creator,
      follower_count: window.__STATE__.follows.filter((f) => f.followee_id === p.id).length,
      recipe_count: window.__STATE__.recipes.filter((r) => r.author_id === p.id).length,
      pinned_recipe_id: p.pinned_recipe_id || null,
      pinned_recipe_title: pinned ? pinned.title : null,
      pinned_recipe_hero_photo_path: pinned ? pinned.hero_photo_path : null,
    }];
  },
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
        if (table === 'kitchen_cv_recommendations') {
          row.profiles = window.__STATE__.profiles.find((p) => p.id === row.author_id) || null;
          if (!row.status) row.status = 'pending';
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
    rpc: (fnName, params) => {
      window.__CALLS__.push({ op: 'rpc', fnName, params });
      const handler = window.__RPC_HANDLERS__[fnName];
      return Promise.resolve({ data: handler ? handler(params) : null, error: null });
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }),
        upload: (path, fileOrBlob) => {
          window.__UPLOADS__.push({ bucket, path, hasName: typeof fileOrBlob.name === 'string', size: fileOrBlob.size, type: fileOrBlob.type });
          return Promise.resolve({ data: {}, error: null });
        },
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
