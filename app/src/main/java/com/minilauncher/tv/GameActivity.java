package com.minilauncher.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Runs one of the bundled offline HTML5 games full screen. */
public class GameActivity extends Activity {

    static final String EXTRA_GAME = "game";
    static final String EXTRA_VARIANT = "variant";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0B0F);
        web.setFocusable(true);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowContentAccess(false);
        s.setBlockNetworkLoads(true); // games are fully offline
        web.addJavascriptInterface(new Store(getSharedPreferences("games", MODE_PRIVATE)), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // never navigate away from the game
            }
        });
        setContentView(web);

        String id = getIntent().getStringExtra(EXTRA_GAME);
        int v = getIntent().getIntExtra(EXTRA_VARIANT, 0);
        web.loadUrl("file:///android_asset/games/index.html#" + (id == null ? "" : id) + "/" + v);
        web.requestFocus(View.FOCUS_DOWN);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String k = keyName(event.getKeyCode());
        if (k != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                boolean repeat = event.getRepeatCount() > 0;
                web.evaluateJavascript("window.Engine&&Engine.key('" + k + "'," + repeat + ")", null);
            } else if (event.getAction() == KeyEvent.ACTION_UP) {
                web.evaluateJavascript("window.Engine&&Engine.keyUp('" + k + "')", null);
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private static String keyName(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                return "ok";
            default: return null;
        }
    }

    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    /** High scores, kept in SharedPreferences. */
    static final class Store {
        private final SharedPreferences prefs;
        Store(SharedPreferences prefs) { this.prefs = prefs; }
        @JavascriptInterface public String get(String key) { return prefs.getString(key, null); }
        @JavascriptInterface public void set(String key, String value) { prefs.edit().putString(key, value).apply(); }
    }
}
