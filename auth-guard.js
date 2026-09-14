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
      if (person.avatar_url) {
        el.style.backgroundImage = "url('" + person.avatar_url + "')";
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.textContent = person.initials;
      }
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
    .select('display_name, initials, avatar_url')
    .eq('id', session.user.id)
    .single();

  const person = profile || {
    display_name: session.user.email,
    initials: (session.user.email || '??').slice(0, 2).toUpperCase(),
    avatar_url: null,
  };

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    const days = Math.floor(hours / 24);
    return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  }

  function wireNotificationBell(userId) {
    const btn = document.getElementById('notifBellBtn');
    if (!btn) return;

    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.style.cssText = 'display:none; position:absolute; top:52px; right:16px; width:300px; max-height:360px; overflow-y:auto; background:var(--card-bg); border:1px solid var(--line); border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.12); z-index:150; padding:8px;';
    document.body.appendChild(panel);

    btn.style.position = 'relative';

    async function loadNotifications() {
      panel.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--ink-soft);">Loading…</div>';

      const [followsRes, heartsRes, commentsRes] = await Promise.all([
        sb.from('follows')
          .select('follower_id, created_at, profiles!follows_follower_id_fkey(display_name)')
          .eq('followee_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        sb.from('hearts')
          .select('user_id, created_at, profiles(display_name), posts!inner(author_id)')
          .eq('posts.author_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        sb.from('comments')
          .select('author_id, created_at, text, profiles(display_name), posts!inner(author_id)')
          .eq('posts.author_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items = [];
      (followsRes.data || []).forEach((f) => {
        if (f.profiles) items.push({ created_at: f.created_at, text: (f.profiles.display_name || 'Someone') + ' followed you' });
      });
      (heartsRes.data || []).forEach((h) => {
        if (h.profiles) items.push({ created_at: h.created_at, text: (h.profiles.display_name || 'Someone') + ' hearted your post' });
      });
      (commentsRes.data || []).forEach((c) => {
        if (c.profiles) items.push({ created_at: c.created_at, text: (c.profiles.display_name || 'Someone') + ' commented on your post' });
      });

      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      panel.innerHTML = '';
      if (items.length === 0) {
        panel.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--ink-soft);">No activity yet.</div>';
        return;
      }
      items.slice(0, 8).forEach((item) => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 8px; font-size:13px; color:var(--ink); border-bottom:1px solid var(--line);';
        const text = document.createElement('div');
        text.textContent = item.text;
        const time = document.createElement('div');
        time.style.cssText = 'font-size:11px; color:var(--ink-soft); margin-top:2px;';
        time.textContent = timeAgo(item.created_at);
        row.appendChild(text);
        row.appendChild(time);
        panel.appendChild(row);
      });
      panel.lastChild.style.borderBottom = 'none';
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) loadNotifications();
    });

    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireAvatar(person);
      wireNotificationBell(session.user.id);
    });
  } else {
    wireAvatar(person);
    wireNotificationBell(session.user.id);
  }
})();
