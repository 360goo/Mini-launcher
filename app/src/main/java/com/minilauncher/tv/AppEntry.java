package com.minilauncher.tv;

import android.content.ComponentName;
import android.graphics.drawable.Drawable;

/** One launchable app shown on the home screen. */
final class AppEntry {
    final String packageName;
    final ComponentName component;
    final String label;
    final Drawable banner; // 16:9 TV banner, may be null
    final Drawable icon;
    final boolean sideloaded;
    final boolean system;
    /** Non-null for built-in games: the game id inside assets/games. */
    final String gameId;
    final int gameVariant;

    AppEntry(String packageName, ComponentName component, String label, Drawable banner,
             Drawable icon, boolean sideloaded, boolean system) {
        this.packageName = packageName;
        this.component = component;
        this.label = label;
        this.banner = banner;
        this.icon = icon;
        this.sideloaded = sideloaded;
        this.system = system;
        this.gameId = null;
        this.gameVariant = 0;
    }

    /** A built-in offline game tile. */
    AppEntry(String gameId, int variant, String label, Drawable banner) {
        this.packageName = "game:" + gameId + ":" + variant;
        this.component = null;
        this.label = label;
        this.banner = banner;
        this.icon = null;
        this.sideloaded = false;
        this.system = false;
        this.gameId = gameId;
        this.gameVariant = variant;
    }
}
