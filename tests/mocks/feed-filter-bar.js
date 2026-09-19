window.__CALLS__ = [];

const ALL_POSTS = [
  { id: 'post-plain', author_id: 'user-1', kind: 'post', recipe_id: null, caption: 'Just a regular update.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook A', initials: 'CA' }, recipes: null },
  { id: 'post-recipe', author_id: 'user-2', kind: 'post', recipe_id: 'r1', caption: 'Nailed this one.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook B', initials: 'CB' }, recipes: { title: 'Lemon Herb Chicken', hero_photo_path: null, tags: ['quick', 'weeknight'] } },
  { id: 'post-recipe-2', author_id: 'user-7', kind: 'post', recipe_id: 'r2', caption: 'Weeknight staple.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook G', initials: 'CG' }, recipes: { title: 'Garlic Naan', hero_photo_path: null, tags: ['quick'] } },
  { id: 'post-dining', author_id: 'user-3', kind: 'post', recipe_id: null, caption: 'Great dinner out.', photo_path: null, video_uid: null, mood: null, restaurant_name: "Mario's Trattoria", created_at: new Date().toISOString(), profiles: { display_name: 'Cook C', initials: 'CC' }, recipes: null },
  { id: 'post-mood-comfort', author_id: 'user-4', kind: 'post', recipe_id: null, caption: 'Mac and cheese night.', photo_path: null, video_uid: null, mood: 'Comfort food', restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook D', initials: 'CD' }, recipes: null },
  { id: 'post-mood-quick', author_id: 'user-5', kind: 'post', recipe_id: null, caption: '15-minute stir fry.', photo_path: null, video_uid: null, mood: 'Quick and easy', restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook E', initials: 'CE' }, recipes: null },
  { id: 'post-mood-fancy', author_id: 'user-6', kind: 'post', recipe_id: null, caption: 'Seared scallops for two.', photo_path: null, video_uid: null, mood: 'Fancy tonight', restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook F', initials: 'CF' }, recipes: null },
];

const CHALLENGE_ENTRIES = [{ post_id: 'post-plain' }];

function chain(table) {
  let rangeArgs = null;
  let eqArgs = [];
  let notArgs = [];
  let inArgs = null;
  let filterArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    not(col, op, val) { notArgs.push([col, op, val]); return builder; },
    filter(col, op, val) { filterArgs.push([col, op, val]); return builder; },
    order() { return builder; },
    limit() { return builder; },
    in(col, ids) { inArgs = [col, ids]; return builder; },
    range(from, to) { rangeArgs = [from, to]; return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table, rangeArgs, eqArgs, notArgs, inArgs, filterArgs });
      let result = [];
      if (table === 'posts') {
        result = ALL_POSTS;
        eqArgs.forEach(([col, val]) => { result = result.filter((p) => p[col] === val); });
        notArgs.forEach(([col, op, val]) => {
          if (op === 'is' && val === null) result = result.filter((p) => p[col] !== null && p[col] !== undefined);
        });
        filterArgs.forEach(([col, op, val]) => {
          // Only the one embedded-resource filter this app actually
          // sends: recipes.tags "contains" a tag, PostgREST-style
          // ('cs', Postgres array literal e.g. '{"quick"}').
          if (col === 'recipes.tags' && op === 'cs') {
            const tag = String(val).replace(/[{}"]/g, '');
            result = result.filter((p) => p.recipes && Array.isArray(p.recipes.tags) && p.recipes.tags.includes(tag));
          }
        });
        if (inArgs) {
          const [col, ids] = inArgs;
          result = result.filter((p) => ids.includes(p[col]));
        }
        if (rangeArgs) result = result.slice(rangeArgs[0], rangeArgs[1] + 1);
      } else if (table === 'challenge_entries') {
        result = CHALLENGE_ENTRIES;
      } else if (table === 'profiles') {
        result = { display_name: 'Me', initials: 'ME', avatar_url: null };
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert() { return { select() { return { single: () => Promise.resolve({ data: { id: 'new-post-1' }, error: null }) }; } }; },
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
