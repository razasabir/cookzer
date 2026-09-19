// Shared sidebar "Friends" widget — up to 7 avatars of people you
// follow, most recently followed first, plus a settings link through to
// the full Friends page. Replaces a hardcoded "Recently active: Sarah
// K., Amina M., Josh M." block that was never wired to real data.
(function () {
  async function renderFriendsWidget(sb, currentUserId, containerEl) {
    const { data } = await sb
      .from('follows')
      .select('followee_id, profiles!follows_followee_id_fkey(id, display_name, initials)')
      .eq('follower_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(7);

    const people = (data || []).filter((f) => f.profiles);

    containerEl.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'sidebar-friends-label';
    label.textContent = 'Friends';
    containerEl.appendChild(label);

    if (people.length === 0) {
      const empty = document.createElement('a');
      empty.href = 'cookzer-friends.html';
      empty.style.cssText = 'display:block; font-size:12px; color:var(--ink-soft); text-decoration:none;';
      empty.textContent = 'Follow people to see your Friends here →';
      containerEl.appendChild(empty);
      return;
    }

    const row = document.createElement('div');
    row.className = 'sidebar-friends-row';

    people.forEach((f) => {
      const a = document.createElement('a');
      a.className = 'sidebar-friend-avatar';
      a.href = 'cookzer-profile.html?id=' + f.profiles.id;
      a.title = f.profiles.display_name || 'Someone';
      a.textContent = f.profiles.initials || '??';
      row.appendChild(a);
    });

    const settings = document.createElement('a');
    settings.className = 'sidebar-friends-settings';
    settings.href = 'cookzer-friends.html';
    settings.title = 'Manage Friends';
    settings.textContent = '⚙';
    row.appendChild(settings);

    containerEl.appendChild(row);
  }

  window.CookzerFriendsWidget = { render: renderFriendsWidget };
})();
