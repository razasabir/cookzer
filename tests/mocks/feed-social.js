window.__CLIPBOARD__ = null;
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText: (text) => { window.__CLIPBOARD__ = text; return Promise.resolve(); } },
});

const ME = { display_name: 'Me Cook', initials: 'MC', avatar_url: 'https://example.com/me.jpg' };

const POSTS = [
  { id: 'post-recipe', author_id: 'user-2', kind: 'post', recipe_id: 'r1', caption: 'Nailed it.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook B', initials: 'CB', avatar_url: null }, recipes: { title: 'Lemon Herb Chicken', hero_photo_path: null } },
  { id: 'post-tip', author_id: 'user-3', kind: 'tip', recipe_id: null, caption: 'Salt the pasta water.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook C', initials: 'CC', avatar_url: 'https://example.com/cookc.jpg' }, recipes: null },
  { id: 'post-plain', author_id: 'user-4', kind: 'post', recipe_id: null, caption: 'Made dinner tonight.', photo_path: 'dinner.jpg', video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook D', initials: 'CD', avatar_url: null }, recipes: null },
  { id: 'post-no-photo', author_id: 'user-4', kind: 'post', recipe_id: null, caption: 'Just words, no photo.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook D', initials: 'CD', avatar_url: null }, recipes: null },
];

const FRIENDS = [
  { followee_id: 'friend-1', profiles: { id: 'friend-1', display_name: 'Alice Cook', initials: 'AC' } },
  { followee_id: 'friend-2', profiles: { id: 'friend-2', display_name: 'Bob Baker', initials: 'BB' } },
];

// post-plain has hearts/comments to test the inline "❤️ N / 💬 N" count
// display; post-no-photo and post-recipe stay at zero to test that the
// count is left blank rather than shown as "0".
const HEARTS = [
  { post_id: 'post-plain', user_id: 'x1' },
  { post_id: 'post-plain', user_id: 'x2' },
  { post_id: 'post-plain', user_id: 'x3' },
];
const COMMENTS = [
  { post_id: 'post-plain', id: 'c1' },
  { post_id: 'post-plain', id: 'c2' },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    range() { return builder; },
    not() { return builder; },
    single() {
      if (table === 'profiles') return Promise.resolve({ data: ME, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      let result = [];
      const postIdFilter = eqArgs.find((a) => a[0] === 'post_id');
      if (table === 'posts') result = POSTS;
      else if (table === 'follows') result = FRIENDS;
      else if (table === 'hearts') result = postIdFilter ? HEARTS.filter((h) => h.post_id === postIdFilter[1]) : HEARTS;
      else if (table === 'comments') result = postIdFilter ? COMMENTS.filter((c) => c.post_id === postIdFilter[1]) : COMMENTS;
      else if (table === 'post_bookmarks' || table === 'challenge_entries') result = [];
      else if (table === 'profiles') result = ME;
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
    update() { return builder; },
    insert(payload) {
      return { select() { return { single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }; } };
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
