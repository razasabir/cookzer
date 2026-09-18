// Public Firebase config, for push notifications (push-notifications.js).
// Safe to commit — same as supabase-config.js above: these values are
// designed to be exposed client-side, they're not secrets. Fill in the
// real ones from Firebase Console -> Project Settings -> General -> Your
// apps -> Web app, and the VAPID key from Project Settings -> Cloud
// Messaging -> Web configuration -> Web Push certificates.
const COOKZER_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC9xeX50GfStFFmTZxNvJVqdv0B7dtUTec',
  authDomain: 'cookzer-c3103.firebaseapp.com',
  projectId: 'cookzer-c3103',
  storageBucket: 'cookzer-c3103.firebasestorage.app',
  messagingSenderId: '399270908248',
  appId: '1:399270908248:web:4bf52c14033e6c80e5152d',
  vapidKey: 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY',
};
