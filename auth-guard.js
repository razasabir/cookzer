// Shared auth guard, included on every page except cookzer-auth.html.
// Redirects to the sign-in page if there's no session, and wires the
// header avatar to show real initials + sign out on click.

// Kid Mode: a soft, device-local restriction for handing a shared family
// account to a child's own phone without exposing the feed/friends/
// messenger on that device. State lives in this browser's localStorage,
// not the account — the point is to lock down one device, not the
// account itself, so it follows whichever phone it was turned on for.
// This is a UX guard against a curious kid, not real security: anyone
// who knows to clear site data or open a private window can bypass it.
const KID_MODE_KEY = 'cz_kid_mode';
const KID_MODE_ALLOWED_PAGE = 'cookzer-planner.html';

function getKidMode() {
  try {
    const raw = localStorage.getItem(KID_MODE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function hashKidModePin(pin) {
  const enc = new TextEncoder().encode('cookzer-kid-mode:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

window.CookzerKidMode = {
  get: getKidMode,
  async enable(familyProfile, pin) {
    const pinHash = await hashKidModePin(pin);
    localStorage.setItem(KID_MODE_KEY, JSON.stringify({
      enabled: true,
      familyProfileId: familyProfile.id,
      familyProfileName: familyProfile.name,
      familyProfileEmoji: familyProfile.avatar_emoji,
      pinHash,
    }));
  },
  async unlock(pin) {
    const kidMode = getKidMode();
    if (!kidMode) return true;
    const hash = await hashKidModePin(pin);
    if (hash !== kidMode.pinHash) return false;
    localStorage.removeItem(KID_MODE_KEY);
    return true;
  },
};

function kidModeModal() {
  let overlay = document.getElementById('kidModeOverlay');
  if (overlay) return overlay.querySelector('.cz2-modal');
  overlay = document.createElement('div');
  overlay.id = 'kidModeOverlay';
  overlay.className = 'cz2-overlay';
  overlay.hidden = true;
  const modal = document.createElement('div');
  modal.className = 'cz2-modal';
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });
  document.body.appendChild(overlay);
  return modal;
}

function kidModeBtn(label, primary) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.cssText = primary
    ? 'padding:10px 20px; border-radius:12px; border:none; background:var(--olive); color:#fff; font-weight:600; font-size:14px; cursor:pointer;'
    : 'padding:10px 20px; border-radius:12px; border:1px solid var(--line); background:var(--cream); color:var(--ink); font-weight:600; font-size:14px; cursor:pointer;';
  return btn;
}

function openKidModeUnlockModal() {
  const modal = kidModeModal();
  modal.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Exit Kid Mode';
  modal.appendChild(title);
  const label = document.createElement('div');
  label.className = 'cz2-label';
  label.textContent = 'Enter the PIN to unlock full access on this device.';
  modal.appendChild(label);
  const pinInput = document.createElement('input');
  pinInput.type = 'password';
  pinInput.inputMode = 'numeric';
  pinInput.placeholder = 'PIN';
  modal.appendChild(pinInput);
  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = 'color:var(--brick); font-size:12px; margin:-4px 0 10px; min-height:14px;';
  modal.appendChild(errorMsg);
  const actions = document.createElement('div');
  actions.className = 'cz2-actions';
  const cancelBtn = kidModeBtn('Cancel', false);
  cancelBtn.addEventListener('click', () => { document.getElementById('kidModeOverlay').hidden = true; });
  const submitBtn = kidModeBtn('Unlock', true);
  submitBtn.addEventListener('click', async () => {
    const ok = await window.CookzerKidMode.unlock(pinInput.value.trim());
    if (!ok) { errorMsg.textContent = 'Wrong PIN.'; return; }
    window.location.href = 'cookzer-settings.html';
  });
  pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); });
  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  modal.appendChild(actions);
  document.getElementById('kidModeOverlay').hidden = false;
  pinInput.focus();
}

function applyKidModeRestrictions(kidMode) {
  document.querySelectorAll('.sidebar-item').forEach((el) => {
    if (!el.classList.contains('planner')) el.closest('a')?.remove();
  });
  document.querySelector('.sidebar-plus')?.remove();
  document.getElementById('notifBellBtn')?.remove();
  document.querySelector('a[href="cookzer-messenger.html"]')?.remove();

  // The "Cookzer" wordmark in the sidebar is its own link straight to the
  // feed, separate from the .sidebar-item nav rows removed above — repoint
  // it at the allowed page instead of leaving it as a way around the lock.
  const brandLink = document.querySelector('.sidebar-brand')?.closest('a');
  if (brandLink) brandLink.href = KID_MODE_ALLOWED_PAGE;

  const settingsLink = document.querySelector('a[href="cookzer-settings.html"]');
  if (settingsLink) {
    const lockBtn = document.createElement('button');
    lockBtn.className = 'icon-btn';
    lockBtn.type = 'button';
    lockBtn.title = 'Exit Kid Mode';
    lockBtn.textContent = '🔒';
    lockBtn.addEventListener('click', openKidModeUnlockModal);
    settingsLink.replaceWith(lockBtn);
  }

  const banner = document.createElement('div');
  banner.style.cssText = 'background:var(--plus-tint); color:var(--olive-dark); text-align:center; padding:8px 12px; font-size:13px; font-weight:600; position:sticky; top:0; z-index:120;';
  banner.textContent = '🧒 Kid Mode — suggesting as ' + kidMode.familyProfileEmoji + ' ' + kidMode.familyProfileName;
  document.body.insertBefore(banner, document.body.firstChild);
}

(async function () {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    // Carve-out for the public logged-out profile preview: a shared
    // profile link (cookzer-profile.html?id=<uuid>) should show a growth
    // funnel, not a login wall. Every other page, and a profile URL with
    // no ?id, still redirects — this is the only public route in the app.
    const currentPage = location.pathname.split('/').pop();
    const params = new URLSearchParams(location.search);
    if (currentPage === 'cookzer-profile.html' && params.get('id')) {
      window.CookzerLoggedOutPreview = true;
      return;
    }
    window.location.href = 'cookzer-auth.html';
    return;
  }

  // A suspended or banned account is locked out of every page except the
  // lockout page itself — checked before Kid Mode's own redirect since a
  // suspension is the more severe restriction. This is the one real
  // enforcement point for public.user_suspensions: 'warn' and 'mute'
  // don't reach here (my_active_suspension() only returns 'suspend' and
  // 'ban' rows), and aren't blocked anywhere yet.
  const currentPageForSuspension = location.pathname.split('/').pop();
  if (currentPageForSuspension !== 'cookzer-suspended.html' && currentPageForSuspension !== 'cookzer-auth.html') {
    try {
      const { data: activeSuspension } = await sb.rpc('my_active_suspension');
      if (activeSuspension && activeSuspension.length) {
        window.location.href = 'cookzer-suspended.html';
        return;
      }
    } catch (e) {
      // Fails open — a broken or unavailable check should never lock
      // every signed-in user out of the whole site.
    }
  }

  const kidMode = getKidMode();
  if (kidMode && kidMode.enabled) {
    const currentPage = location.pathname.split('/').pop();
    if (currentPage !== KID_MODE_ALLOWED_PAGE) {
      window.location.href = KID_MODE_ALLOWED_PAGE;
      return;
    }
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

  // Invite-link referrals: cookzer-auth.html stashes `?ref=<uid>` from an
  // invite link into localStorage before sign-in/sign-up. Once there's a
  // real session, attribute it — once — by setting profiles.referred_by
  // (only if still unset, so re-visiting an old invite link never
  // overwrites an existing attribution) and auto-following the referrer
  // so their content shows up right away. This runs post-login rather
  // than in the signup trigger so it covers Google/Facebook OAuth the
  // same way as email/password signup.
  async function captureReferral(userId) {
    const refId = localStorage.getItem('cz_ref');
    if (!refId || refId === userId) {
      localStorage.removeItem('cz_ref');
      return;
    }
    const { data: updated } = await sb
      .from('profiles')
      .update({ referred_by: refId })
      .eq('id', userId)
      .is('referred_by', null)
      .select('id');
    if (updated && updated.length) {
      await sb.from('follows').insert({ follower_id: userId, followee_id: refId });
    }
    localStorage.removeItem('cz_ref');
  }

  function applyAvatarLook(el, person) {
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
  }

  async function signOut() {
    if (await CookzerModal.confirm('Sign out of Cookzer?')) {
      await sb.auth.signOut();
      window.location.href = 'cookzer-auth.html';
    }
  }

  // Kid Mode keeps the avatar to just sign-out — a full menu would offer
  // Profile/Settings links that route straight around the nav lock
  // applyKidModeRestrictions puts in place (only the Planner stays reachable).
  function wireAvatarBasic(person) {
    document.querySelectorAll('.avatar').forEach((el) => {
      applyAvatarLook(el, person);
      el.addEventListener('click', signOut);
    });
  }

  function injectAvatarMenuStyle() {
    if (document.getElementById('avatar-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'avatar-menu-style';
    style.textContent = `
      .avatar-menu-panel {
        display: none; position: absolute; top: 52px; right: 16px; width: 250px;
        background: var(--card-bg); border: 1px solid var(--line); border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.14); z-index: 150; overflow: hidden;
      }
      .avatar-menu-header { padding: 14px; border-bottom: 1px solid var(--line); }
      .avatar-menu-name { font-weight: 600; font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .avatar-menu-email { font-size: 12px; color: var(--ink-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .avatar-menu-row {
        display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px;
        font-size: 13.5px; color: var(--ink); text-decoration: none; background: none; border: none;
        cursor: pointer; font-family: inherit; text-align: left;
      }
      .avatar-menu-row:hover { background: var(--cream); }
      .avatar-menu-icon { font-size: 16px; flex-shrink: 0; width: 18px; text-align: center; }
      .avatar-menu-ai { display: block; padding: 11px 14px; text-decoration: none; border-top: 1px solid var(--line); }
      .avatar-menu-ai:hover { background: var(--cream); }
      .avatar-menu-ai-title { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--ink); }
      .avatar-menu-ai-usage { font-size: 11.5px; color: var(--ink-faint, var(--ink-soft)); margin-left: 26px; margin-top: 2px; }
      .avatar-menu-signout { color: var(--brick); border-top: 1px solid var(--line); }
    `;
    document.head.appendChild(style);
  }

  // The full account menu — profile/settings/AI usage/sign out — shown
  // for a real (non-Kid-Mode) session.
  function wireAvatarMenu(person, userId) {
    const avatarEls = document.querySelectorAll('.avatar');
    if (!avatarEls.length) return;
    avatarEls.forEach((el) => applyAvatarLook(el, person));
    injectAvatarMenuStyle();

    const panel = document.createElement('div');
    panel.className = 'avatar-menu-panel';
    panel.id = 'avatarMenuPanel';

    const header = document.createElement('div');
    header.className = 'avatar-menu-header';
    const nameEl = document.createElement('div');
    nameEl.className = 'avatar-menu-name';
    nameEl.textContent = person.display_name;
    header.appendChild(nameEl);
    if (person.email) {
      const emailEl = document.createElement('div');
      emailEl.className = 'avatar-menu-email';
      emailEl.textContent = person.email;
      header.appendChild(emailEl);
    }
    panel.appendChild(header);

    function menuLink(icon, label, href) {
      const row = document.createElement('a');
      row.className = 'avatar-menu-row';
      row.href = href;
      row.innerHTML = '<span class="avatar-menu-icon">' + icon + '</span><span>' + label + '</span>';
      panel.appendChild(row);
      return row;
    }

    menuLink('👤', 'Profile', 'cookzer-profile.html');
    menuLink('⚙️', 'Settings', 'cookzer-settings.html');
    if (person.isPlatformAdmin) menuLink('🛠️', 'Back Office', 'cookzer-admin.html');

    // Cookzer+ AI usage — the same monthly cap/count ai-assistant-chat.js
    // enforces (500 messages/month across Cooking Ideas, Leftover Help,
    // and Health & Nutrition combined), surfaced here so it's visible
    // without having to open one of those features first.
    const aiRow = document.createElement('a');
    aiRow.className = 'avatar-menu-ai';
    aiRow.href = 'cookzer-pantry.html';
    aiRow.innerHTML = '<div class="avatar-menu-ai-title"><span class="avatar-menu-icon">✨</span><span>Cookzer+ AI</span></div>'
      + '<div class="avatar-menu-ai-usage" id="avatarMenuAiUsage">Loading usage…</div>';
    panel.appendChild(aiRow);

    const signOutRow = menuLink('🚪', 'Log Out', '#');
    signOutRow.classList.add('avatar-menu-signout');
    signOutRow.addEventListener('click', (e) => {
      e.preventDefault();
      panel.style.display = 'none';
      signOut();
    });

    document.body.appendChild(panel);

    const AI_MESSAGE_LIMIT = 500;
    async function loadAiUsage() {
      const usageEl = document.getElementById('avatarMenuAiUsage');
      if (!usageEl) return;
      try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const { count } = await sb
          .from('ai_assistant_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('role', 'user')
          .gte('created_at', monthStart);
        usageEl.textContent = (count || 0) + ' / ' + AI_MESSAGE_LIMIT + ' AI messages this month';
      } catch (e) {
        usageEl.textContent = 'AI usage unavailable right now';
      }
    }

    avatarEls.forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) loadAiUsage();
      });
    });

    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' && !panel.contains(e.target) && !Array.from(avatarEls).includes(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, initials, avatar_url, is_platform_admin')
    .eq('id', session.user.id)
    .single();

  const person = Object.assign(
    {},
    profile || {
      display_name: session.user.email,
      initials: (session.user.email || '??').slice(0, 2).toUpperCase(),
      avatar_url: null,
      is_platform_admin: false,
    },
    { email: session.user.email, isPlatformAdmin: !!(profile && profile.is_platform_admin) }
  );

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
    dot.style.cssText = 'display:none; position:absolute; top:2px; right:2px; width:9px; height:9px; border-radius:50%; background:var(--brick,#FF6B4A); border:2px solid var(--card-bg);';
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

      if (items.some((item) => !item.read_at)) {
        const markAllBtn = document.createElement('button');
        markAllBtn.type = 'button';
        markAllBtn.style.cssText = 'display:block; width:100%; text-align:right; background:none; border:none; padding:4px 8px 8px; font-size:12px; color:var(--olive-dark); font-weight:600; cursor:pointer;';
        markAllBtn.textContent = 'Mark all read';
        markAllBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.CookzerNotifications.markAllRead(userId);
          await loadNotifications();
          refreshUnreadDot();
        });
        panel.appendChild(markAllBtn);
      }

      if (items.length === 0) {
        panel.innerHTML += '<div style="padding:12px; font-size:13px; color:var(--ink-soft);">No activity yet.</div>';
      } else {
        items.forEach((item) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:10px 8px; border-bottom:1px solid var(--line);' + (item.read_at ? '' : ' background:rgba(0,156,74,0.06);');

          const link = document.createElement('a');
          link.href = item.linkUrl || ('cookzer-profile.html?id=' + item.actorId);
          link.style.cssText = 'flex:1; min-width:0; font-size:13px; color:var(--ink); text-decoration:none;';
          const text = document.createElement('div');
          text.textContent = item.text;
          const time = document.createElement('div');
          time.style.cssText = 'font-size:11px; color:var(--ink-soft); margin-top:2px;';
          time.textContent = timeAgo(item.created_at);
          link.appendChild(text);
          link.appendChild(time);
          row.appendChild(link);

          // A dedicated mark-read control — clicking a notification's own
          // text still navigates you to what it's about, but this lets
          // you clear just this one without having to go there.
          if (!item.read_at) {
            const markBtn = document.createElement('button');
            markBtn.type = 'button';
            markBtn.title = 'Mark as read';
            markBtn.setAttribute('aria-label', 'Mark as read');
            markBtn.style.cssText = 'flex-shrink:0; width:22px; height:22px; border-radius:50%; border:1px solid var(--line); background:var(--card-bg); color:var(--olive-dark); font-size:12px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;';
            markBtn.textContent = '✓';
            markBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              markBtn.disabled = true;
              await window.CookzerNotifications.markRead(userId, item.id);
              row.style.background = '';
              markBtn.remove();
              refreshUnreadDot();
            });
            row.appendChild(markBtn);
          }

          panel.appendChild(row);
        });
      }

      const seeAll = document.createElement('a');
      seeAll.href = 'cookzer-notifications.html';
      seeAll.style.cssText = 'display:block; padding:10px 8px; font-size:12.5px; color:var(--olive-dark); font-weight:600; text-decoration:none; text-align:center;';
      seeAll.textContent = 'See all notifications';
      panel.appendChild(seeAll);
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

  // Delegates to the shared friends-widget.js (every page loads it) rather
  // than keeping a second, slightly-worse copy of this logic here — this
  // used to build its own widget from scratch with no explicit order and
  // no empty-state message, while a couple of pages that also called
  // friends-widget.js directly ended up rendering the widget twice.
  async function wireFriendsWidget(userId) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || !window.CookzerFriendsWidget) return;
    const widget = document.createElement('div');
    widget.className = 'sidebar-friends-widget';
    sidebar.appendChild(widget);
    await window.CookzerFriendsWidget.render(sb, userId, widget);
  }

  captureReferral(session.user.id);

  function wireForKidModeOrFull() {
    if (kidMode && kidMode.enabled) {
      wireAvatarBasic(person);
      applyKidModeRestrictions(kidMode);
    } else {
      wireAvatarMenu(person, session.user.id);
      wireNotificationBell(session.user.id);
      wireFriendsWidget(session.user.id);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireForKidModeOrFull);
  } else {
    wireForKidModeOrFull();
  }
})();
