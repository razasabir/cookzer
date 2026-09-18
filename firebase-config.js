// Public Firebase config, for push notifications (push-notifications.js).
// Safe to commit — same as supabase-config.js above: these values are
// designed to be exposed client-side, they're not secrets. Fill in the
// real ones from Firebase Console -> Project Settings -> General -> Your
// apps -> Web app, and the VAPID key from Project Settings -> Cloud
// Messaging -> Web configuration -> Web Push certificates.
const COOKZER_FIREBASE_CONFIG = {
  apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_PROJECT.firebaseapp.com',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID',
  vapidKey: 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY',
};
