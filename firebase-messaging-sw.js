// Background push handler for web push. Firebase's web SDK looks for this
// exact file at the site root by default, so it can show a notification
// even when no Cookzer tab is open — a plain page script can't do that,
// only a service worker runs independently of any open tab.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

firebase.initializeApp(COOKZER_FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const link = (payload.data && payload.data.link) || 'https://cookzer.com/cookzer-feed.html';
  self.registration.showNotification((payload.notification && payload.notification.title) || 'Cookzer', {
    body: payload.notification && payload.notification.body,
    icon: '/icon-192.png',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || 'https://cookzer.com/cookzer-feed.html';
  event.waitUntil(clients.openWindow(link));
});
