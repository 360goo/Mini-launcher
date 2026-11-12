package com.minilauncher.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.text.InputType;
import android.view.View;
import android.widget.EditText;
import android.widget.AdapterView;
import android.widget.GridView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final int TAB_APPS = 0;
    private static final int TAB_APKS = 1;
    private static final int TAB_GAMES = 2;
    private static final long WEATHER_REFRESH_MS = 30L * 60 * 1000;

    private static final String PREFS = "launcher";
    private static final String KEY_HIDDEN = "hidden";
    private static final String KEY_SHOW_SYSTEM = "show_system";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private int loadGeneration;

    private SharedPreferences prefs;
    private GridView grid;
    private TextView empty;
    private TextView tabApps;
    private TextView tabApks;
    private TextView tabGames;
    private TextView weatherView;
    private List<AppEntry> games = new ArrayList<>();
    private boolean weatherLoading;
    private final Runnable weatherTick = new Runnable() {
        @Override public void run() {
            refreshWeather(true);
            main.postDelayed(this, WEATHER_REFRESH_MS);
        }
    };
    private AppAdapter adapter;
    private View highlighted;

    private List<AppEntry> allApps = new ArrayList<>();
    private int currentTab = TAB_APPS;

    private final BroadcastReceiver packageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            reload();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        grid = findViewById(R.id.grid);
        empty = findViewById(R.id.empty);
        tabApps = findViewById(R.id.tab_apps);
        tabApks = findViewById(R.id.tab_apks);
        tabGames = findViewById(R.id.tab_games);
        weatherView = findViewById(R.id.weather);
        View settings = findViewById(R.id.settings);

        adapter = new AppAdapter(getLayoutInflater(), grid);
        grid.setAdapter(adapter);

        grid.setOnItemClickListener((parent, view, position, id) -> launch(adapter.getItem(position)));
        grid.setOnItemLongClickListener((parent, view, position, id) -> {
            showAppOptions(adapter.getItem(position));
            return true;
        });
        grid.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (grid.hasFocus()) highlight(view);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                highlight(null);
            }
        });
        grid.setOnFocusChangeListener((v, hasFocus) ->
                highlight(hasFocus ? grid.getSelectedView() : null));

        // TV style: moving onto a tab switches to it.
        tabApps.setOnFocusChangeListener((v, f) -> { if (f) selectTab(TAB_APPS); });
        tabApks.setOnFocusChangeListener((v, f) -> { if (f) selectTab(TAB_APKS); });
        tabGames.setOnFocusChangeListener((v, f) -> { if (f) selectTab(TAB_GAMES); });
        tabApps.setOnClickListener(v -> focusGrid());
        tabApks.setOnClickListener(v -> focusGrid());
        tabGames.setOnClickListener(v -> focusGrid());
        settings.setOnClickListener(v -> showLauncherMenu());

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addAction(Intent.ACTION_PACKAGE_REPLACED);
        filter.addDataScheme("package");
        registerReceiver(packageReceiver, filter);

        selectTab(TAB_APPS);
        reload();
        grid.requestFocus();

        String cached = prefs.getString(Weather.KEY_TEXT, "");
        weatherView.setText(cached);
        weatherView.setVisibility(cached.isEmpty() ? View.GONE : View.VISIBLE);
    }

    @Override
    protected void onStart() {
        super.onStart();
        main.post(weatherTick);
    }

    @Override
    protected void onStop() {
        main.removeCallbacks(weatherTick);
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        reload(); // catches changes made while we weren't listening (e.g. app disabled in Settings)
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Home pressed while already home: jump back to the start.
        if (Intent.ACTION_MAIN.equals(intent.getAction())) {
            selectTab(TAB_APPS);
            grid.setSelection(0);
            focusGrid();
        }
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(packageReceiver);
        executor.shutdownNow();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // This is the home screen; there's nowhere to go back to.
        if (!grid.hasFocus()) focusGrid();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            AppEntry app = grid.hasFocus() ? (AppEntry) grid.getSelectedItem() : null;
            if (app != null) showAppOptions(app); else showLauncherMenu();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // ---------------------------------------------------------------- data

    private void reload() {
        final int gen = ++loadGeneration;
        final boolean showSystem = prefs.getBoolean(KEY_SHOW_SYSTEM, false);
        final Set<String> hidden = new HashSet<>(prefs.getStringSet(KEY_HIDDEN, new HashSet<>()));
        final Context ctx = getApplicationContext();
        final boolean needGames = games.isEmpty();
        executor.execute(() -> {
            List<AppEntry> apps = AppLoader.load(ctx, showSystem, hidden);
            List<AppEntry> loadedGames = needGames ? GameCatalog.load(ctx) : null;
            main.post(() -> {
                if (gen != loadGeneration || isFinishing()) return;
                allApps = apps;
                if (loadedGames != null && games.isEmpty()) games = loadedGames;
                applyTab();
            });
        });
    }

    private void selectTab(int tab) {
        if (tab == currentTab && adapter.getCount() > 0) {
            updateTabViews();
            return;
        }
        currentTab = tab;
        updateTabViews();
        applyTab();
    }

    private void updateTabViews() {
        tabApps.setSelected(currentTab == TAB_APPS);
        tabApks.setSelected(currentTab == TAB_APKS);
        tabGames.setSelected(currentTab == TAB_GAMES);
    }

    private void applyTab() {
        AppEntry previous = (AppEntry) grid.getSelectedItem();

        List<AppEntry> shown = new ArrayList<>();
        if (currentTab == TAB_GAMES) {
            shown.addAll(games);
        } else {
            for (AppEntry a : allApps) {
                if ((currentTab == TAB_APKS) == a.sideloaded) shown.add(a);
            }
        }
        adapter.setItems(shown);

        boolean hasItems = !shown.isEmpty();
        grid.setFocusable(hasItems);
        empty.setVisibility(hasItems ? View.GONE : View.VISIBLE);
        empty.setText(currentTab == TAB_APKS ? R.string.empty_apks
                : currentTab == TAB_GAMES ? R.string.empty_games : R.string.empty_apps);

        // Keep the cursor on the same app after a refresh.
        if (previous != null) {
            for (int i = 0; i < shown.size(); i++) {
                if (shown.get(i).packageName.equals(previous.packageName)) {
                    grid.setSelection(i);
                    break;
                }
            }
        }
        if (grid.hasFocus()) grid.post(() -> highlight(grid.getSelectedView()));
    }

    // ---------------------------------------------------------------- focus look

    private void highlight(View view) {
        if (highlighted == view) return;
        if (highlighted != null) setTileFocused(highlighted, false);
        highlighted = view;
        if (view != null) setTileFocused(view, true);
    }

    private void setTileFocused(View tile, boolean focused) {
        float scale = focused ? 1.1f : 1f;
        tile.animate().scaleX(scale).scaleY(scale).setDuration(120).start();
        Object tag = tile.getTag();
        if (tag instanceof AppAdapter.Holder) {
            AppAdapter.Holder h = (AppAdapter.Holder) tag;
            h.card.setActivated(focused);
            h.label.setTextColor(getResources().getColor(focused ? R.color.text : R.color.text_dim, null));
        }
        tile.setElevation(focused ? 8f : 0f);
    }

    private void focusGrid() {
        if (adapter.getCount() > 0) grid.requestFocus();
    }

    // ---------------------------------------------------------------- actions

    private void launch(AppEntry app) {
        if (app.gameId != null) {
            startActivity(new Intent(this, GameActivity.class)
                    .putExtra(GameActivity.EXTRA_GAME, app.gameId)
                    .putExtra(GameActivity.EXTRA_VARIANT, app.gameVariant));
            return;
        }
        Intent intent = new Intent(Intent.ACTION_MAIN)
                .setComponent(app.component)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException e) {
            Intent fallback = getPackageManager().getLeanbackLaunchIntentForPackage(app.packageName);
            if (fallback == null) fallback = getPackageManager().getLaunchIntentForPackage(app.packageName);
            if (fallback != null) {
                startActivity(fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else {
                Toast.makeText(this, "Can't open " + app.label, Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void showAppOptions(AppEntry app) {
        if (app.gameId != null) {
            launch(app);
            return;
        }
        String[] options = {"Open", "App info", "Uninstall", "Hide from launcher"};
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle(app.label)
                .setItems(options, (d, which) -> {
                    switch (which) {
                        case 0: launch(app); break;
                        case 1: openAppInfo(app.packageName); break;
                        case 2: uninstall(app.packageName); break;
                        case 3: hide(app.packageName); break;
                    }
                })
                .show();
    }

    private void showLauncherMenu() {
        boolean showSystem = prefs.getBoolean(KEY_SHOW_SYSTEM, false);
        int hiddenCount = prefs.getStringSet(KEY_HIDDEN, new HashSet<>()).size();
        String[] options = {
                "Android TV settings",
                (showSystem ? "Hide" : "Show") + " preinstalled system apps",
                "Unhide apps (" + hiddenCount + " hidden)",
                "Choose default home app",
                "Weather location: " + (prefs.getString(Weather.KEY_CITY, "").isEmpty()
                        ? "Auto" : prefs.getString(Weather.KEY_CITY, "")),
                "Temperature: " + (prefs.getBoolean(Weather.KEY_FAHRENHEIT, false) ? "°F" : "°C")
        };
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle(R.string.app_name)
                .setItems(options, (d, which) -> {
                    switch (which) {
                        case 0: safeStart(new Intent(Settings.ACTION_SETTINGS)); break;
                        case 1:
                            prefs.edit().putBoolean(KEY_SHOW_SYSTEM, !showSystem).apply();
                            reload();
                            break;
                        case 2:
                            prefs.edit().remove(KEY_HIDDEN).apply();
                            reload();
                            break;
                        case 3:
                            if (!safeStart(new Intent(Settings.ACTION_HOME_SETTINGS))) {
                                safeStart(new Intent(Settings.ACTION_SETTINGS));
                            }
                            break;
                        case 4: askCity(); break;
                        case 5:
                            prefs.edit().putBoolean(Weather.KEY_FAHRENHEIT,
                                    !prefs.getBoolean(Weather.KEY_FAHRENHEIT, false)).apply();
                            refreshWeather(false);
                            break;
                    }
                })
                .show();
    }

    // ---------------------------------------------------------------- weather

    private void refreshWeather(boolean onlyIfStale) {
        long age = System.currentTimeMillis() - prefs.getLong(Weather.KEY_TIME, 0);
        if (weatherLoading || (onlyIfStale && age < WEATHER_REFRESH_MS)) return;
        weatherLoading = true;
        executor.execute(() -> {
            String text;
            boolean ok;
            try {
                text = Weather.fetch(prefs);
                ok = true;
            } catch (Exception e) {
                text = e.getMessage() != null && e.getMessage().startsWith("City not found")
                        ? e.getMessage() : null;
                ok = false;
            }
            final String shown = text;
            final boolean success = ok;
            main.post(() -> {
                weatherLoading = false;
                if (shown != null) {
                    weatherView.setText(shown);
                    weatherView.setVisibility(View.VISIBLE);
                } else if (!success && weatherView.getText().length() == 0) {
                    weatherView.setVisibility(View.GONE); // offline: just hide it
                }
            });
        });
    }

    private void askCity() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        input.setHint("City, e.g. Mumbai (leave empty for automatic)");
        input.setText(prefs.getString(Weather.KEY_CITY, ""));
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Weather location")
                .setView(input)
                .setPositiveButton("Save", (d, w) -> {
                    prefs.edit().putString(Weather.KEY_CITY, input.getText().toString().trim()).apply();
                    refreshWeather(false);
                })
                .setNeutralButton("Automatic", (d, w) -> {
                    prefs.edit().putString(Weather.KEY_CITY, "").apply();
                    refreshWeather(false);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void openAppInfo(String pkg) {
        safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
    }

    @SuppressWarnings("deprecation")
    private void uninstall(String pkg) {
        Intent intent = new Intent(Intent.ACTION_UNINSTALL_PACKAGE, Uri.parse("package:" + pkg));
        if (!safeStart(intent)) openAppInfo(pkg);
    }

    private void hide(String pkg) {
        Set<String> hidden = new HashSet<>(prefs.getStringSet(KEY_HIDDEN, new HashSet<>()));
        hidden.add(pkg);
        prefs.edit().putStringSet(KEY_HIDDEN, hidden).apply();
        reload();
    }

    private boolean safeStart(Intent intent) {
        try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }
}
