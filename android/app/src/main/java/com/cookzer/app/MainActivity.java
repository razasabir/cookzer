package com.cookzer.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
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
        // Restoring the pre-Android-15 "fit system windows" behavior here
        // makes Android itself reserve space for the system bars again, so
        // every screen's actual visible/scrollable area matches what the
        // WebView reports, the same way it already does in a real mobile
        // browser tab (confirmed not to show this bug).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
