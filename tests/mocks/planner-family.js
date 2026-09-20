window.__INSERTED_SUGGESTIONS__ = [];
window.__INSERTED_ENTRIES__ = [];
window.__UPDATED_SUGGESTIONS__ = [];

const MY_GROUPS = [{ group_id: 'group-1', groups: { id: 'group-1', name: 'The Smiths' } }];
const FAMILY_PROFILES = [{ id: 'fam-1', name: 'Emma', avatar_emoji: '👧' }];
const RECIPES = [
  { id: 'r1', title: 'Lemon Herb Chicken', tags: ['quick', 'weeknight'] },
  { id: 'r2', title: 'Spaghetti Carbonara', tags: ['comfort-food'] },
];

// The planner always keys suggestions off the real clock's Monday of
// this week — rather than hardcode a date, this seeded suggestion is
// returned for whichever date the meal_suggestions query actually asks
// for first, tagged onto that same date so "Use this" inserts onto a
// day the test can then find in the rendered grid.
let seededDate = null;
let suggestions = null; // lazily seeded once seededDate is known

function suggestionDisplay(s) {
  if (s.suggested_by_family_profile_id) {
    const f = FAMILY_PROFILES.find((p) => p.id === s.suggested_by_family_profile_id);
    return { ...s, profiles: null, family_profiles: f ? { name: f.name, avatar_emoji: f.avatar_emoji } : null };
  }
  return { ...s, profiles: { display_name: 'Test Cook' }, family_profiles: null };
}

function chain(table) {
  let inArgs = null;
  let eqArgs = [];
  let isUpdate = false;
  let updatePayload = null;
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    in(col, vals) { inArgs = [col, vals]; return builder; },
    order() { return builder; },
    or() { return builder; },
    limit() { return builder; },
    not() { return builder; },
    single() {
      if (isUpdate && table === 'meal_suggestions') {
        const idArg = eqArgs.find(([col]) => col === 'id');
        const row = (suggestions || []).find((s) => s.id === (idArg && idArg[1]));
        if (row) Object.assign(row, updatePayload);
        window.__UPDATED_SUGGESTIONS__.push({ id: idArg && idArg[1], payload: updatePayload });
        return Promise.resolve({ data: row ? suggestionDisplay(row) : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    // household_size: 3 with 1 named Family Profile (Emma) means the
    // planner shows You + Emma + one "ghost" placeholder column.
    maybeSingle() {
      if (table === 'profiles') return Promise.resolve({ data: { household_size: 3 }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'group_members') {
        result = MY_GROUPS;
      } else if (table === 'meal_plan_entries') {
        result = [];
      } else if (table === 'meal_suggestions') {
        if (inArgs && inArgs[0] === 'suggestion_date' && !seededDate) {
          seededDate = inArgs[1][0];
          suggestions = [{
            id: 'sugg-1',
            suggestion_date: seededDate,
            dish_text: 'Tacos',
            recipe_id: null,
            suggested_by_user_id: null,
            suggested_by_family_profile_id: 'fam-1',
          }];
        }
        const dates = (inArgs && inArgs[0] === 'suggestion_date') ? inArgs[1] : null;
        result = (suggestions || []).filter((s) => !dates || dates.includes(s.suggestion_date)).map(suggestionDisplay);
      } else if (table === 'family_profiles') {
        result = FAMILY_PROFILES;
      } else if (table === 'recipes') {
        result = RECIPES;
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update(payload) { isUpdate = true; updatePayload = payload; return builder; },
    insert(payload) {
      if (table === 'meal_suggestions') {
        window.__INSERTED_SUGGESTIONS__.push(payload);
        const row = { id: 'sugg-' + ((suggestions || []).length + 1), ...payload };
        suggestions = (suggestions || []).concat([row]);
        return {
          select() { return { single: () => Promise.resolve({ data: suggestionDisplay(row), error: null }) }; },
        };
      }
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
