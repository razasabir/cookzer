// Minimal mock for index.html as a logged-out visitor — no session, so
// the page's own redirect-if-signed-in never fires and the landing page
// (including the cookie-consent banner) stays visible.
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => {},
      signOut: () => Promise.resolve({}),
    },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
};
