// Push-notification subscription flow — the third channel alongside the
// in-app bell and email (notifications-shared.js). Loaded on every page
// like that file, but unlike it, this never acts on its own: requesting
// OS/browser notification permission on page load (rather than in direct
// response to the user turning a toggle on) is exactly the pattern
// browsers and app stores penalize, so enable()/disable() only ever run
// from cookzer-settings.html's "Push notifications" toggle.
//
// Native app (Android via @capacitor/push-notifications, backed by the
// same Firebase project) and web push (Firebase JS SDK + VAPID, see
// firebase-config.js / firebase-messaging-sw.js) both end up as one FCM
// registration token, saved to notification_prefs — the send side
// (api/send-notification-push.js) doesn't need to know which kind it is.
(function () {
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function loadFirebaseWebSdk() {
    if (window.firebase) return Promise.resolve();
    const urls = [
      'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
    ];
    return urls.reduce(
      (chain, url) =>
        chain.then(
          () =>
            new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = url;
              script.onload = resolve;
              script.onerror = () => reject(new Error('Could not load ' + url));
              document.head.appendChild(script);
            })
        ),
      Promise.resolve()
    );
  }

  async function savePushPrefs(userId, token, platform) {
    await sb.from('notification_prefs').upsert(
      {
        user_id: userId,
        push_token: token,
        push_platform: platform,
        notify_push: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }

  function enableNative(userId) {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const PushNotifications = plugins && plugins.PushNotifications;
    if (!PushNotifications) {
      return Promise.resolve({ ok: false, error: 'Push plugin unavailable in this build.' });
    }
    return PushNotifications.requestPermissions().then((perm) => {
      if (perm.receive !== 'granted') {
        return { ok: false, error: 'Notification permission was not granted.' };
      }
      return new Promise((resolve) => {
        PushNotifications.addListener('registration', (token) => {
          savePushPrefs(userId, token.value, 'android').then(() => resolve({ ok: true }));
        });
        PushNotifications.addListener('registrationError', (err) => {
          resolve({ ok: false, error: (err && err.error) || 'Registration failed.' });
        });
        PushNotifications.register();
      });
    });
  }

  async function enableWeb(userId) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, error: 'This browser does not support push notifications.' };
    }
    const config = typeof COOKZER_FIREBASE_CONFIG !== 'undefined' ? COOKZER_FIREBASE_CONFIG : null;
    if (!config || config.apiKey === 'REPLACE_WITH_YOUR_FIREBASE_API_KEY') {
      return { ok: false, error: 'Push is not configured yet.' };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Notification permission was not granted.' };
    }
    try {
      await loadFirebaseWebSdk();
      const app = firebase.initializeApp(config);
      const messaging = firebase.messaging(app);
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // .register() can resolve before the worker is actually active —
      // PushManager.subscribe() (which getToken() calls internally) needs
      // an active worker, so wait for readiness rather than using the
      // registration handed back above directly.
      const registration = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({ vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
      if (!token) return { ok: false, error: 'Could not get a push token.' };
      await savePushPrefs(userId, token, 'web');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Could not register for push notifications.' };
    }
  }

  function enable(userId) {
    return isNative() ? enableNative(userId) : enableWeb(userId);
  }

  async function disable(userId) {
    // Keeps the stored token (harmless, just unused) — only flips the
    // preference, so re-enabling later doesn't need a fresh permission
    // prompt if the browser/OS still has it granted.
    await sb.from('notification_prefs').upsert(
      { user_id: userId, notify_push: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }

  window.CookzerPush = { enable, disable, isNative };
})();
