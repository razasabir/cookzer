// Generic filter-driven mock (same engine as tests/mocks/profile-activity.js)
// extended with the embed pre-baking cookzer-admin.html's queries need
// (reports.reporter/assignee, admin_actions.profiles, restaurant_claim_
// requests.restaurants, dsar_requests.user, support_tickets.user/assignee,
// support_ticket_messages.author, posts.hearts(count)) and an rpc()
// implementation for the admin RPCs from migrations 056/057/058, since
// this mock has no real Postgres behind it to run the real SQL functions.
window.__CALLS__ = [];
window.__RPC_CALLS__ = [];

const ADMIN_ID = 'admin-1';
// A fixed past NOW would silently drift out of sync with the real
// Date.now() the page's own hoursAgo()/timeAgo() helpers use as real
// time passes — using the actual current time keeps every "N hours/days
// ago" assertion below stable regardless of when the suite runs.
const NOW = new Date();
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
  hearts: [
    { post_id: 'post-1', user_id: 'alice-1', created_at: hoursAgoIso(5) },
  ],
  policy_documents: [
    { id: 'policy-1', type: 'terms', version: 1, is_current: true, published_at: daysAgoIso(90) },
  ],
  dsar_requests: [
    { id: 'dsar-1', user_id: 'alice-1', type: 'export', status: 'pending', note: null, created_at: hoursAgoIso(10) },
  ],
  legal_holds: [
    { id: 'hold-1', target_type: 'recipe', target_id: 'recipe-1', reason: 'Copyright dispute', placed_at: daysAgoIso(2), released_at: null },
  ],
  csam_reports: [],
  feature_flags: [
    { key: 'new_composer', enabled: true, description: 'New post composer', rollout_percent: 50, updated_at: daysAgoIso(1) },
  ],
  site_announcements: [
    { id: 'announce-1', message: 'Scheduled maintenance tonight', level: 'warning', active: true, starts_at: hoursAgoIso(1), ends_at: null, created_at: hoursAgoIso(1) },
  ],
  rate_limit_config: [
    { key: 'signup_per_ip', limit_per_hour: 10, description: 'signups per IP per hour', updated_at: daysAgoIso(3) },
  ],
  support_tickets: [
    { id: 'ticket-1', user_id: 'alice-1', subject: 'Cannot upload photo', status: 'open', priority: 'normal', assigned_to: null, created_at: hoursAgoIso(4), updated_at: hoursAgoIso(4) },
  ],
  support_ticket_messages: [
    { id: 'msg-1', ticket_id: 'ticket-1', author_id: 'alice-1', is_staff: false, body: 'Getting a 500 error every time', created_at: hoursAgoIso(4) },
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
    if (f.op === 'lt') return v != null && v < f.val;
    if (f.op === 'lte') return v != null && v <= f.val;
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
      // Dashboard's query embeds this unaliased (profiles!…fkey), Audit
      // Log's aliases it to `actor:profiles!…fkey` — set both since this
      // mock doesn't parse the select string to know which was asked for.
      r.profiles = actor ? { display_name: actor.display_name } : null;
      r.actor = r.profiles;
    });
  }
  if (table === 'restaurant_claim_requests') {
    rows.forEach((r) => {
      const rest = window.__STATE__.restaurants.find((x) => x.id === r.restaurant_id);
      r.restaurants = rest ? { name: rest.name } : null;
    });
  }
  if (table === 'dsar_requests') {
    rows.forEach((r) => {
      const u = profileById(r.user_id);
      r.user = u ? { display_name: u.display_name } : null;
    });
  }
  if (table === 'support_tickets') {
    rows.forEach((r) => {
      const u = profileById(r.user_id);
      r.user = u ? { display_name: u.display_name } : null;
      const a = profileById(r.assigned_to);
      r.assignee = a ? { display_name: a.display_name } : null;
    });
  }
  if (table === 'support_ticket_messages') {
    rows.forEach((r) => {
      const a = profileById(r.author_id);
      r.author = a ? { display_name: a.display_name } : null;
    });
  }
  if (table === 'posts') {
    rows.forEach((r) => {
      const count = window.__STATE__.hearts.filter((h) => h.post_id === r.id).length;
      r.hearts = [{ count }];
      const author = profileById(r.author_id);
      r.author = author ? { display_name: author.display_name } : null;
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
    lt(col, val) { filters.push({ col, op: 'lt', val }); return builder; },
    lte(col, val) { filters.push({ col, op: 'lte', val }); return builder; },
    order(col, opts) { orderSpec = { col, asc: !(opts && opts.ascending === false) }; return builder; },
    limit(n) { limitN = n; return builder; },
    range(from, to) { limitN = { from, to }; return builder; },
    rows() {
      let rows = (window.__STATE__[table] || []).filter((r) => matches(r, filters));
      if (orderSpec) {
        rows = rows.slice().sort((a, b) => {
          if (a[orderSpec.col] < b[orderSpec.col]) return orderSpec.asc ? -1 : 1;
          if (a[orderSpec.col] > b[orderSpec.col]) return orderSpec.asc ? 1 : -1;
          return 0;
        });
      }
      if (typeof limitN === 'number') rows = rows.slice(0, limitN);
      else if (limitN && typeof limitN === 'object') rows = rows.slice(limitN.from, limitN.to + 1);
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
      getSession: () => Promise.resolve({ data: { session: { user: { id: ADMIN_ID }, access_token: 'mock-admin-access-token' } } }),
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
      if (fn === 'admin_publish_policy') {
        st.policy_documents.forEach((p) => { if (p.type === args.p_type) p.is_current = false; });
        const nextVersion = Math.max(0, ...st.policy_documents.filter((p) => p.type === args.p_type).map((p) => p.version)) + 1;
        st.policy_documents.push({ id: 'policy-' + (st.policy_documents.length + 1), type: args.p_type, version: nextVersion, is_current: true, published_at: new Date().toISOString() });
        return Promise.resolve({ data: nextVersion, error: null });
      }
      if (fn === 'admin_update_dsar_status') {
        const r = st.dsar_requests.find((x) => x.id === args.p_request_id);
        if (r) { r.status = args.p_status; if (args.p_note) r.note = args.p_note; }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_fulfill_deletion_request') {
        const r = st.dsar_requests.find((x) => x.id === args.p_request_id);
        if (r) { r.status = 'completed'; st.profiles = st.profiles.filter((p) => p.id !== r.user_id); }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_place_legal_hold') {
        const id = 'hold-' + (st.legal_holds.length + 1);
        st.legal_holds.push({ id, target_type: args.p_target_type, target_id: args.p_target_id, reason: args.p_reason, placed_at: new Date().toISOString(), released_at: null });
        return Promise.resolve({ data: id, error: null });
      }
      if (fn === 'admin_release_legal_hold') {
        const h = st.legal_holds.find((x) => x.id === args.p_hold_id);
        if (h) h.released_at = new Date().toISOString();
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_flag_csam') {
        const id = 'csam-' + (st.csam_reports.length + 1);
        st.csam_reports.push({ id, content_type: args.p_content_type, content_id: args.p_content_id, status: 'flagged', notes: args.p_notes || null, created_at: new Date().toISOString() });
        return Promise.resolve({ data: id, error: null });
      }
      if (fn === 'admin_update_csam_status') {
        const c = st.csam_reports.find((x) => x.id === args.p_report_id);
        if (c) { c.status = args.p_status; if (args.p_notes) c.notes = args.p_notes; }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_set_feature_flag') {
        const f = st.feature_flags.find((x) => x.key === args.p_key);
        if (f) {
          f.enabled = args.p_enabled;
          if (args.p_description) f.description = args.p_description;
          if (args.p_rollout_percent != null) f.rollout_percent = args.p_rollout_percent;
        } else {
          st.feature_flags.push({ key: args.p_key, enabled: args.p_enabled, description: args.p_description || null, rollout_percent: args.p_rollout_percent != null ? args.p_rollout_percent : 100, updated_at: new Date().toISOString() });
        }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_create_announcement') {
        const id = 'announce-' + (st.site_announcements.length + 1);
        st.site_announcements.unshift({ id, message: args.p_message, level: args.p_level || 'info', active: true, starts_at: new Date().toISOString(), ends_at: args.p_ends_at || null, created_at: new Date().toISOString() });
        return Promise.resolve({ data: id, error: null });
      }
      if (fn === 'admin_deactivate_announcement') {
        const a = st.site_announcements.find((x) => x.id === args.p_id);
        if (a) a.active = false;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_set_rate_limit') {
        const r = st.rate_limit_config.find((x) => x.key === args.p_key);
        if (r) { r.limit_per_hour = args.p_limit_per_hour; if (args.p_description) r.description = args.p_description; }
        else st.rate_limit_config.push({ key: args.p_key, limit_per_hour: args.p_limit_per_hour, description: args.p_description || null, updated_at: new Date().toISOString() });
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_broadcast_notification') {
        const count = st.profiles.filter((p) => p.id !== ADMIN_ID).length;
        return Promise.resolve({ data: count, error: null });
      }
      if (fn === 'post_ticket_message') {
        st.support_ticket_messages.push({ id: 'msg-' + (st.support_ticket_messages.length + 1), ticket_id: args.p_ticket_id, author_id: ADMIN_ID, is_staff: true, body: args.p_body, created_at: new Date().toISOString() });
        const t = st.support_tickets.find((x) => x.id === args.p_ticket_id);
        if (t) { t.status = 'pending'; t.updated_at = new Date().toISOString(); }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_assign_ticket') {
        const t = st.support_tickets.find((x) => x.id === args.p_ticket_id);
        if (t) t.assigned_to = args.p_assignee;
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'admin_resolve_ticket') {
        const t = st.support_tickets.find((x) => x.id === args.p_ticket_id);
        if (t) t.status = 'resolved';
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
