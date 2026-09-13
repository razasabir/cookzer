// Shared auth guard, included on every page except cookzer-auth.html.
// Redirects to the sign-in page if there's no session, and wires the
// header avatar to show real initials + sign out on click.
(async function () {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    window.location.href = 'cookzer-auth.html';
    return;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'cookzer-auth.html';
    }
  });

  function wireAvatar(person) {
    document.querySelectorAll('.avatar').forEach((el) => {
      el.textContent = person.initials;
      el.title = person.display_name;
      el.style.cursor = 'pointer';
      el.addEventListener('click', async () => {
        if (confirm('Sign out of Cookzer?')) {
          await sb.auth.signOut();
          window.location.href = 'cookzer-auth.html';
        }
      });
    });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, initials')
    .eq('id', session.user.id)
    .single();

  const person = profile || {
    display_name: session.user.email,
    initials: (session.user.email || '??').slice(0, 2).toUpperCase(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wireAvatar(person));
  } else {
    wireAvatar(person);
  }
})();
