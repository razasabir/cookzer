// Public Supabase config. Safe to commit: the publishable key is
// designed to be exposed client-side, protected by Row Level Security
// policies (see supabase/schema.sql), not by keeping it secret.
const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
