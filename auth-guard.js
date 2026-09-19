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
    window.location.href = 'cookzer-auth.html';
    return;
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
    wireAvatar(person);
    if (kidMode && kidMode.enabled) {
      applyKidModeRestrictions(kidMode);
    } else {
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
