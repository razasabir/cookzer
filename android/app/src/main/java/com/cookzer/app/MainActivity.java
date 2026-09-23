package com.cookzer.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 36, see variables.gradle) makes edge-to-edge
        // display mandatory by default — the WebView's own reported bounds
        // extend behind the system status/nav bars instead of stopping
        // above them. That's the actual root cause of the Android bottom-
        // cutoff bug several website-only fixes failed to resolve: the
        // WebView's window.innerHeight (and window.visualViewport.height,
        // which reflects the same underlying native bounds) genuinely
        // believed the full screen height was safely paintable — there is
        // no signal available to any web page that part of it sits behind
        // opaque system UI, so no CSS or JS run inside the page could ever
        // have detected or corrected for it.
        //
        // An earlier version of this fix called
        // WindowCompat.setDecorFitsSystemWindows(getWindow(), true) to
        // restore the pre-Android-15 "fit system windows" behavior wholesale.
        // That resolved the bottom nav-bar cutoff, but a diagnostic banner
        // shipped straight to the reporting device (window.visualViewport.
        // offsetTop, .height and window.innerHeight, read live off the
        // device) proved it did nothing for the status bar: innerHeight and
        // visualViewport.height came back EXACTLY equal with offsetTop at 0,
        // meaning the WebView's own box still extends up under the status
        // bar — that legacy compatibility flag isn't honored per-bar on
        // every OEM skin at targetSdk 36, at least not on this device.
        //
        // Replaced with the officially-recommended edge-to-edge pattern:
        // opt fully into edge-to-edge (required going forward regardless)
        // and manually consume the system bar insets by padding the
        // Activity's own root content view. This genuinely shrinks the
        // WebView's box to sit between the status and nav bars — rather
        // than asking Android to pretend edge-to-edge isn't happening — so
        // window.innerHeight/visualViewport are accurate for both bars
        // without needing any web-side detection at all. The existing
        // safe-area/visualViewport CSS from earlier fixes stays in place as
        // a harmless no-op safety net (styles.css/theme.js): it now
        // resolves to 0 because there's genuinely no gap left to measure.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
    }
}
