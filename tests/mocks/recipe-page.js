window.__DELETED_COMMENT_IDS__ = [];
window.__INSERTED_COMMENTS__ = [];
window.__SAVED_UPSERTS__ = [];
window.__INSERTED_PLANNER_ENTRIES__ = [];
window.__INSERTED_POSTS__ = [];

// Exposed on window (not a bare top-level const) so a test's extraInit —
// injected as its own separate init script — can reach and mutate it.
window.RECIPE = {
  id: 'r1',
  title: 'Spaghetti Carbonara',
  description: 'A classic.',
  category: 'Dinner',
  dietary_tags: ['Vegetarian'],
  tags: ['quick', 'weeknight'],
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  servings: 4,
  spice_level: 'Mild',
  ingredients: [{ name: 'Spaghetti', qty: '400g' }],
  steps: [],
  nutrition: {},
  cost_per_serve: null,
  hero_photo_path: null,
  created_at: new Date().toISOString(),
  author_id: 'me-1',
  profiles: { display_name: 'Test Cook', initials: 'TC' },
};

const FOLDERS = [{ id: 'f1', name: 'Weeknights', emoji: '🌙' }];
const HOUSEHOLD = { id: 'household-1', name: null, household_size: 4 };

// The current user ("me-1") is also the recipe's author here — covers
// the more interesting moderation case: deleting both your own comment
// and someone else's, same as a post owner can on their own post.
let comments = [
  { id: 'c1', recipe_id: 'r1', author_id: 'me-1', text: 'My own comment.', created_at: new Date().toISOString(), profiles: { display_name: 'Test Cook', initials: 'TC' } },
  { id: 'c2', recipe_id: 'r1', author_id: 'other-2', text: "Someone else's comment.", created_at: new Date().toISOString(), profiles: { display_name: 'Other Cook', initials: 'OC' } },
];

let hearts = [{ recipe_id: 'r1', user_id: 'other-1' }];

function chain(table) {
  let eqArgs = [];
  let selectOptions = null;
  const builder = {
    select(cols, options) { selectOptions = options || null; return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    or() { return builder; },
    in(col, vals) { eqArgs.push([col, vals]); return builder; },
    single() {
      if (table === 'households') return Promise.resolve({ data: HOUSEHOLD, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      if (table === 'recipes') return Promise.resolve({ data: RECIPE, error: null });
      if (table === 'hearts') {
        const recipeIdFilter = eqArgs.find((a) => a[0] === 'recipe_id');
        const userIdFilter = eqArgs.find((a) => a[0] === 'user_id');
        const found = hearts.find((h) => h.recipe_id === (recipeIdFilter && recipeIdFilter[1]) && h.user_id === (userIdFilter && userIdFilter[1]));
        return Promise.resolve({ data: found || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      let count;
      if (table === 'comments') {
        const recipeIdFilter = eqArgs.find((a) => a[0] === 'recipe_id');
        result = recipeIdFilter ? comments.filter((c) => c.recipe_id === recipeIdFilter[1]) : comments;
      } else if (table === 'hearts') {
        const recipeIdFilter = eqArgs.find((a) => a[0] === 'recipe_id');
        const filtered = recipeIdFilter ? hearts.filter((h) => h.recipe_id === recipeIdFilter[1]) : hearts;
        if (selectOptions && selectOptions.count === 'exact' && selectOptions.head) {
          count = filtered.length;
          result = null;
        } else {
          result = filtered;
        }
      } else if (table === 'cookbook_folders') {
        result = FOLDERS;
      } else if (table === 'meal_plan_entries') {
        // Seed one already-planned day: whichever date is first in the
        // .in('plan_date', [...]) list the page actually queried for —
        // deterministic against the real calendar without hardcoding a
        // weekday, same trick used in tests/mocks/planner-family.js.
        const dateFilter = eqArgs.find((a) => a[0] === 'plan_date');
        result = dateFilter ? [{ plan_date: dateFilter[1][0], free_text: 'Leftover Pasta', recipes: null }] : [];
      } else if (table === 'recipe_photos' || table === 'recipe_reviews') {
        result = [];
      }
      return Promise.resolve({ data: result, error: null, count }).then(resolve);
    },
    // Supports both a single .eq() (comments: .eq('id', id)) and a
    // chained pair (hearts: .eq('recipe_id', x).eq('user_id', y)) by
    // deferring the actual delete until awaited, via .then().
    delete() {
      const filters = [];
      const del = {
        eq(col, val) { filters.push([col, val]); return del; },
        then(resolve) {
          if (table === 'comments') {
            const idFilter = filters.find((f) => f[0] === 'id');
            if (idFilter) {
              window.__DELETED_COMMENT_IDS__.push(idFilter[1]);
              comments = comments.filter((c) => c.id !== idFilter[1]);
            }
          } else if (table === 'hearts') {
            hearts = hearts.filter((h) => !filters.every(([col, val]) => h[col] === val));
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return del;
    },
    update() { return builder; },
    upsert(payload) {
      if (table === 'saved_recipes') window.__SAVED_UPSERTS__.push(payload);
      return Promise.resolve({ data: null, error: null });
    },
    insert(payload) {
      if (table === 'comments') {
        window.__INSERTED_COMMENTS__.push(payload);
        const row = { id: 'new-comment-1', ...payload, created_at: new Date().toISOString(), profiles: { display_name: 'Test Cook', initials: 'TC' } };
        comments = comments.concat([row]);
      } else if (table === 'hearts') {
        hearts = hearts.concat([payload]);
      } else if (table === 'meal_plan_entries') {
        window.__INSERTED_PLANNER_ENTRIES__.push(payload);
      } else if (table === 'posts') {
        window.__INSERTED_POSTS__.push(payload);
      }
      return Promise.resolve({ data: null, error: null });
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
    rpc: (fn) => {
      if (fn === 'get_or_create_my_household') return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: (path) => ({ data: { publicUrl: 'https://example.test/' + path } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
