window.__INSERTED_SUGGESTIONS__ = [];
window.__INSERTED_ENTRIES__ = [];

const MY_GROUPS = [{ group_id: 'group-1', groups: { id: 'group-1', name: 'The Smiths' } }];
const FAMILY_PROFILES = [{ id: 'fam-1', name: 'Emma', avatar_emoji: '👧' }];
const RECIPES = [
  { id: 'r1', title: 'Lemon Herb Chicken' },
  { id: 'r2', title: 'Spaghetti Carbonara' },
];

// The planner always keys suggestions off the real clock's Monday of
// this week — rather than hardcode a date, this seeded suggestion is
// returned for whichever date the meal_suggestions query actually asks
// for first, tagged onto that same date so "Use this" inserts onto a
// day the test can then find in the rendered grid.
let seededDate = null;

function chain(table) {
  let inArgs = null;
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in(col, vals) { inArgs = [col, vals]; return builder; },
    order() { return builder; },
    or() { return builder; },
    limit() { return builder; },
    not() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      let result = [];
      if (table === 'group_members') {
        result = MY_GROUPS;
      } else if (table === 'meal_plan_entries') {
        result = [];
      } else if (table === 'meal_suggestions') {
        if (inArgs && inArgs[0] === 'suggestion_date' && !seededDate) seededDate = inArgs[1][0];
        result = [{
          id: 'sugg-1',
          suggestion_date: seededDate,
          dish_text: 'Tacos',
          recipe_id: null,
          suggested_by_user_id: null,
          suggested_by_family_profile_id: 'fam-1',
          profiles: null,
          family_profiles: { name: 'Emma', avatar_emoji: '👧' },
        }];
      } else if (table === 'family_profiles') {
        result = FAMILY_PROFILES;
      } else if (table === 'recipes') {
        result = RECIPES;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return Promise.resolve({ data: null, error: null }); },
    insert(payload) {
      if (table === 'meal_suggestions') window.__INSERTED_SUGGESTIONS__.push(payload);
      if (table === 'meal_plan_entries') window.__INSERTED_ENTRIES__.push(payload);
      return {
        select() { return { single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }; },
      };
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
try { localStorage.setItem('cookzer-welcomed', '1'); localStorage.removeItem('cookzer-planner-share-group'); } catch (e) {}
