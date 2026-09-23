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

  // ---- TEMPORARY diagnostic banner — delete once the Android bottom-
  // cutoff bug is root-caused. Three rounds of fixes based on the
  // safe-area/edge-to-edge theory produced zero visible change on the
  // reporting device, even though other unrelated site changes (pull-to-
  // refresh, the profile redesign) reach it fine — so the theory itself,
  // or this detection, needs real evidence instead of another guess.
  // Pinned to the very bottom of the viewport (position:fixed, so it's
  // safe to append as a plain body child despite body being a flex
  // row — see the cookzer-profile-preview.html banner bug earlier this
  // session for what goes wrong without that). If THIS banner also gets
  // clipped by the system nav bar, the WebView really is rendering
  // behind it and env()/UA detection isn't compensating; if it's fully
  // visible, .main is being truncated by something else entirely.
  function renderDebugBanner() {
    var main = document.querySelector('.main') || document.querySelector('.feed-container');
    var mainInfo = main
      ? 'pb=' + getComputedStyle(main).paddingBottom + ' scrollH=' + main.scrollHeight + ' clientH=' + main.clientHeight
      : 'no .main/.feed-container found';
    var banner = document.createElement('div');
    banner.id = 'czDebugBanner';
    banner.textContent =
      'DBG native=' + document.documentElement.hasAttribute('data-native-app') +
      ' cap=' + isCapacitorNative + ' wv=' + isAndroidEmbeddedWebView +
      ' | ' + mainInfo + ' | winH=' + window.innerHeight;
    banner.style.cssText =
      'position:fixed; left:0; right:0; bottom:0; z-index:999999; ' +
      'background:#000; color:#0f0; font:10px/1.4 monospace; ' +
      'padding:4px 6px; white-space:pre-wrap; pointer-events:none;';
    document.body.appendChild(banner);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDebugBanner);
  } else {
    renderDebugBanner();
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
