// Shared sidebar "Co-Cooks" widget — up to 7 avatars of people you
// follow, most recently followed first, plus a settings link through to
// the full Co-Cooks page. Replaces a hardcoded "Recently active: Sarah
// K., Amina M., Josh M." block that was never wired to real data.
(function () {
  async function renderCocooksWidget(sb, currentUserId, containerEl) {
    const { data } = await sb
      .from('follows')
      .select('followee_id, profiles!follows_followee_id_fkey(id, display_name, initials)')
      .eq('follower_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(7);

    const people = (data || []).filter((f) => f.profiles);

    containerEl.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'sidebar-cocooks-label';
    label.textContent = 'Co-Cooks';
    containerEl.appendChild(label);

    if (people.length === 0) {
      const empty = document.createElement('a');
      empty.href = 'cookzer-cocooks.html';
      empty.style.cssText = 'display:block; font-size:12px; color:var(--ink-soft); text-decoration:none;';
      empty.textContent = 'Follow people to see your Co-Cooks here →';
      containerEl.appendChild(empty);
      return;
    }

    const row = document.createElement('div');
    row.className = 'sidebar-cocooks-row';

    people.forEach((f) => {
      const a = document.createElement('a');
      a.className = 'sidebar-cocook-avatar';
      a.href = 'cookzer-profile.html?id=' + f.profiles.id;
      a.title = f.profiles.display_name || 'Someone';
      a.textContent = f.profiles.initials || '??';
      row.appendChild(a);
    });

    const settings = document.createElement('a');
    settings.className = 'sidebar-cocooks-settings';
    settings.href = 'cookzer-cocooks.html';
    settings.title = 'Manage Co-Cooks';
    settings.textContent = '⚙';
    row.appendChild(settings);

    containerEl.appendChild(row);
  }

  window.CookzerCocooksWidget = { render: renderCocooksWidget };
})();
