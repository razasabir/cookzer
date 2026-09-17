// Public Supabase config. Safe to commit: the publishable key is
// designed to be exposed client-side, protected by Row Level Security
// policies (see supabase/schema.sql), not by keeping it secret.
const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

// Some browsers cache GET requests to the same REST endpoint (e.g. the
// feed reload after posting), so a freshly created row doesn't show up
// until a hard refresh even though the write itself succeeded. Force
// every Supabase request to bypass the browser's disk cache.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // PKCE puts the OAuth result in a plain ?code= query param instead of a
  // URL hash fragment — needed so the Android/iOS app's deep-link callback
  // (see cookzer-auth.html's oauthSignIn) can read it with a plain URL parse.
  auth: {
    flowType: 'pkce',
  },
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
  },
});
