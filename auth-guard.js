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

  // Pages that render lists of posts/people can `await window.blockedIdsReady`
  // and filter out anyone in the returned Set, so a blocked user's content
  // stays out of your feed/group/profile views.
  window.blockedIdsReady = sb
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', session.user.id)
    .then(({ data }) => new Set((data || []).map((b) => b.blocked_id)));

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
    if (!btn || !window.CookzerNotifications) return;

    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.style.cssText = 'display:none; position:absolute; top:52px; right:16px; width:300px; max-height:400px; overflow-y:auto; background:var(--card-bg); border:1px solid var(--line); border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.12); z-index:150; padding:8px;';
    document.body.appendChild(panel);

    const dot = document.createElement('div');
    dot.style.cssText = 'display:none; position:absolute; top:2px; right:2px; width:9px; height:9px; border-radius:50%; background:var(--brick,#E85659); border:2px solid var(--card-bg);';
    btn.style.position = 'relative';
    btn.appendChild(dot);

    async function refreshUnreadDot() {
      const count = await window.CookzerNotifications.getUnreadCount(userId);
      dot.style.display = count > 0 ? 'block' : 'none';
    }

    async function loadNotifications() {
      panel.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--ink-soft);">Loading…</div>';
      const items = await window.CookzerNotifications.fetchItems(userId, 8);

      panel.innerHTML = '';
      if (items.length === 0) {
        panel.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--ink-soft);">No activity yet.</div>';
      } else {
        items.forEach((item) => {
          const row = document.createElement('a');
          row.href = item.linkUrl || ('cookzer-profile.html?id=' + item.actorId);
          row.style.cssText = 'display:block; padding:10px 8px; font-size:13px; color:var(--ink); border-bottom:1px solid var(--line); text-decoration:none;' + (item.read_at ? '' : ' background:rgba(0,156,74,0.06);');
          const text = document.createElement('div');
          text.textContent = item.text;
          const time = document.createElement('div');
          time.style.cssText = 'font-size:11px; color:var(--ink-soft); margin-top:2px;';
          time.textContent = timeAgo(item.created_at);
          row.appendChild(text);
          row.appendChild(time);
          panel.appendChild(row);
        });
      }

      const seeAll = document.createElement('a');
      seeAll.href = 'cookzer-notifications.html';
      seeAll.style.cssText = 'display:block; padding:10px 8px; font-size:12.5px; color:var(--olive-dark); font-weight:600; text-decoration:none; text-align:center;';
      seeAll.textContent = 'See all notifications';
      panel.appendChild(seeAll);

      await window.CookzerNotifications.markAllRead(userId);
      dot.style.display = 'none';
    }

    refreshUnreadDot();

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

  // Delegates to the shared cocooks-widget.js (every page loads it) rather
  // than keeping a second, slightly-worse copy of this logic here — this
  // used to build its own widget from scratch with no explicit order and
  // no empty-state message, while a couple of pages that also called
  // cocooks-widget.js directly ended up rendering the widget twice.
  async function wireCoCooksWidget(userId) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || !window.CookzerCocooksWidget) return;
    const widget = document.createElement('div');
    widget.className = 'sidebar-cocooks-widget';
    sidebar.appendChild(widget);
    await window.CookzerCocooksWidget.render(sb, userId, widget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireAvatar(person);
      wireNotificationBell(session.user.id);
      wireCoCooksWidget(session.user.id);
    });
  } else {
    wireAvatar(person);
    wireNotificationBell(session.user.id);
    wireCoCooksWidget(session.user.id);
  }
})();
