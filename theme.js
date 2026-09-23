// Shared dark-mode toggle. Included before styles.css on every page so the
// saved choice applies before first paint (no flash of the wrong theme).
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('cookzer-theme');
  } catch (e) {
    // Private browsing / storage blocked — fall back to light, silently.
  }
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Flags the packaged Android/iOS app (never the real website) so
  // styles.css can give scroll containers a much bigger safe-area
  // fallback than the website needs — env(safe-area-inset-bottom) not
  // resolving on a given WebView is exactly what left content stuck
  // behind the system nav bar even after padding-bottom was added
  // (see the .main / .feed-container rules in styles.css). Runs before
  // first paint, same as the theme flag above, and before pull-to-refresh.js
  // and the page's own layout script even parse.
  //
  // window.Capacitor.isNativePlatform() alone isn't reliable here: the
  // app points at this live site (capacitor.config.json -> server.url)
  // rather than bundled local assets, and whether that still gets the
  // native bridge's JS injected into an externally-hosted page depends
  // on the exact Capacitor/WebView version — nothing this page can
  // verify for itself. Android's own embedded WebView always marks
  // itself with a "wv" token in its user-agent (true for every app's
  // WebView, Capacitor or not), which needs no bridge injection at all,
  // so it's checked as an independent, more reliable signal alongside
  // the Capacitor check rather than instead of it.
  var ua = navigator.userAgent || '';
  var isAndroidEmbeddedWebView = /Android/.test(ua) && /\bwv\b/.test(ua);
  var isCapacitorNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isCapacitorNative || isAndroidEmbeddedWebView) {
    document.documentElement.setAttribute('data-native-app', 'true');
  }

  window.toggleTheme = function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    try {
      localStorage.setItem('cookzer-theme', isDark ? 'light' : 'dark');
    } catch (e) {
      // Nothing to persist to — the toggle still works for this page view.
    }
    syncThemeButtons();
  };

  function syncThemeButtons() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeButtons);
  } else {
    syncThemeButtons();
  }
})();
