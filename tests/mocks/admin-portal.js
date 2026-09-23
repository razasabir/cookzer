// Generic filter-driven mock (same engine as tests/mocks/profile-activity.js)
// extended with the embed pre-baking cookzer-admin.html's queries need
// (reports.reporter/assignee, admin_actions.profiles, restaurant_claim_
// requests.restaurants) and an rpc() implementation for the new admin
// RPCs from migration 056, since this mock has no real Postgres behind
// it to run the real SQL functions.
window.__CALLS__ = [];
window.__RPC_CALLS__ = [];

const ADMIN_ID = 'admin-1';
const NOW = new Date('2026-09-23T12:00:00Z');
const hoursAgoIso = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const daysAgoIso = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();

window.__STATE__ = {
  profiles: [
    { id: ADMIN_ID, display_name: 'Raza', initials: 'RZ', is_platform_admin: true, platform_role: 'super_admin', is_verified_creator: false, created_at: daysAgoIso(400) },
    { id: 'alice-1', display_name: 'Alice Diaz', initials: 'AD', is_platform_admin: false, platform_role: null, is_verified_creator: true, created_at: daysAgoIso(200) },
    { id: 'bob-1', display_name: 'Bob Kirk', initials: 'BK', is_platform_admin: false, platform_role: null, is_verified_creator: false, created_at: daysAgoIso(1) },
  ],
  posts: [
    { id: 'post-1', author_id: 'bob-1', caption: 'Spammy promo post', created_at: hoursAgoIso(6) },
  ],
  comments: [
    { id: 'comment-1', post_id: 'post-1', author_id: 'bob-1', text: 'A harassing comment', created_at: hoursAgoIso(31) },
  ],
  recipes: [
    { id: 'recipe-1', author_id: 'alice-1', title: 'Sourdough Boule', created_at: daysAgoIso(50) },
  ],
  reports: [
    { id: 'report-1', reporter_id: 'alice-1', target_type: 'comment', target_id: 'comment-1', reason: 'Harassment', severity: 'medium', status: 'open', assigned_to: null, created_at: hoursAgoIso(31) },
    { id: 'report-2', reporter_id: 'alice-1', target_type: 'post', target_id: 'post-1', reason: 'Spam', severity: 'medium', status: 'open', assigned_to: null, created_at: hoursAgoIso(6) },
  ],
  user_strikes: [],
  user_suspensions: [],
  admin_actions: [
    { id: 'action-1', actor_id: ADMIN_ID, action_type: 'restaurant_verified', target_type: 'restaurant', target_id: 'rest-1', target_label: null, created_at: hoursAgoIso(3) },
  ],
  restaurants: [
    { id: 'rest-1', name: 'The Copper Spoon', address: '99 Elm St', is_verified: true, featured_until: daysAgoIso(-10) },
    { id: 'rest-2', name: "Nonna's Table", address: '123 Main St', is_verified: false, featured_until: null },
  ],
  restaurant_claim_requests: [
    { id: 'claim-1', restaurant_id: 'rest-2', user_id: 'bob-1', status: 'pending', created_at: daysAgoIso(5) },
  ],
};

function matches(row, filters) {
  return filters.every((f) => {
    const v = row[f.col];
    if (f.op === 'eq') return v === f.val;
    if (f.op === 'neq') return v !== f.val;
    if (f.op === 'in') return f.val.includes(v);
    if (f.op === 'is') return f.val === null ? (v === null || v === undefined) : v === f.val;
    if (f.op === 'ilike') return String(v || '').toLowerCase().includes(f.val);
    if (f.op === 'gte') return v >= f.val;
    if (f.op === 'gt') return v != null && v > f.val;
    return true;
  });
}

function attachEmbeds(table, rows) {
  const profileById = (id) => window.__STATE__.profiles.find((p) => p.id === id) || null;
  if (table === 'reports') {
    rows.forEach((r) => {
      const reporter = profileById(r.reporter_id);
      r.reporter = reporter ? { display_name: reporter.display_name } : null;
      const assignee = profileById(r.assigned_to);
      r.assignee = assignee ? { display_name: assignee.display_name } : null;
    });
  }
  if (table === 'admin_actions') {
    rows.forEach((r) => {
      const actor = profileById(r.actor_id);
      r.profiles = actor ? { display_name: actor.display_name } : null;
    });
  }
  if (table === 'restaurant_claim_requests') {
    rows.forEach((r) => {
      const rest = window.__STATE__.restaurants.find((x) => x.id === r.restaurant_id);
      r.restaurants = rest ? { name: rest.name } : null;
    });
  }
}

function chain(table) {
  const filters = [];
  let wantCount = false;
  let orderSpec = null;
  let limitN = null;
  const builder = {
    select(cols, opts) {
      if (opts && opts.count) wantCount = true;
      return builder;
    },
    eq(col, val) { filters.push({ col, op: 'eq', val }); return builder; },
    neq(col, val) { filters.push({ col, op: 'neq', val }); return builder; },
    in(col, vals) { filters.push({ col, op: 'in', val: vals }); return builder; },
    is(col, val) { filters.push({ col, op: 'is', val }); return builder; },
    ilike(col, pattern) { filters.push({ col, op: 'ilike', val: String(pattern).replace(/%/g, '').toLowerCase() }); return builder; },
    gte(col, val) { filters.push({ col, op: 'gte', val }); return builder; },
    gt(col, val) { filters.push({ col, op: 'gt', val }); return builder; },
    order(col, opts) { orderSpec = { col, asc: !(opts && opts.ascending === false) }; return builder; },
    limit(n) { limitN = n; return builder; },
    rows() {
      let rows = (window.__STATE__[table] || []).filter((r) => matches(r, filters));
      if (orderSpec) {
        rows = rows.slice().sort((a, b) => {
          if (a[orderSpec.col] < b[orderSpec.col]) return orderSpec.asc ? -1 : 1;
          if (a[orderSpec.col] > b[orderSpec.col]) return orderSpec.asc ? 1 : -1;
          return 0;
        });
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      attachEmbeds(table, rows);
      return rows;
    },
    single() { const rows = builder.rows(); return Promise.resolve({ data: rows[0] || null, error: null }); },
    maybeSingle() { const rows = builder.rows(); return Promise.resolve({ data: rows[0] || null, error: null }); },
    then(resolve) {
      const rows = builder.rows();
      if (wantCount) return Promise.resolve({ data: null, error: null, count: rows.length }).then(resolve);
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return builder;
}

function findReport(id) { return window.__STATE__.reports.find((r) => r.id === id); }

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: ADMIN_ID } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: ADMIN_ID, email: 'admin@example.com' } } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: (table) => chain(table),
    rpc: (fn, args) => {
      window.__RPC_CALLS__.push({ fn, args });
      const st = window.__STATE__;

      if (fn === 'admin_resolve_report') {
        const r = findReport(args.p_report_id);
        if (r) { r.status = args.p_decision; r.resolution = args.p_note; }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_remove_content') {
        const r = findReport(args.p_report_id);
        if (r) {
          if (r.target_type === 'post') st.posts = st.posts.filter((p) => p.id !== r.target_id);
          if (r.target_type === 'comment') st.comments = st.comments.filter((c) => c.id !== r.target_id);
          r.status = 'reviewed'; r.resolution = 'removed';
        }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_assign_report') {
        const r = findReport(args.p_report_id);
        if (r) r.assigned_to = args.p_assignee;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_issue_strike') {
        st.user_strikes.push({ id: 'strike-' + (st.user_strikes.length + 1), user_id: args.p_user_id, reason: args.p_reason, severity: args.p_severity, created_at: new Date().toISOString() });
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_set_suspension') {
        const ends = args.p_duration_days ? new Date(Date.now() + args.p_duration_days * 86400000).toISOString() : null;
        st.user_suspensions.push({ id: 'susp-' + (st.user_suspensions.length + 1), user_id: args.p_user_id, type: args.p_type, reason: args.p_reason, ends_at: ends, revoked_at: null, created_at: new Date().toISOString() });
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_revoke_suspension') {
        const s = st.user_suspensions.find((x) => x.id === args.p_suspension_id);
        if (s) s.revoked_at = new Date().toISOString();
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'review_restaurant_claim') {
        const c = st.restaurant_claim_requests.find((x) => x.id === args.p_claim_id);
        if (c) c.status = args.p_decision;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'set_restaurant_verified') {
        const r = st.restaurants.find((x) => x.id === args.p_restaurant_id);
        if (r) r.is_verified = args.p_verified;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'set_restaurant_featured') {
        const r = st.restaurants.find((x) => x.id === args.p_restaurant_id);
        if (r) r.featured_until = args.p_days ? new Date(Date.now() + args.p_days * 86400000).toISOString() : null;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }),
      }),
    },
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
