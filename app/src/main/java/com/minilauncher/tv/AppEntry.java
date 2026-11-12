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

    AppEntry(String packageName, ComponentName component, String label, Drawable banner,
             Drawable icon, boolean sideloaded, boolean system) {
        this.packageName = packageName;
        this.component = component;
        this.label = label;
        this.banner = banner;
        this.icon = icon;
        this.sideloaded = sideloaded;
        this.system = system;
    }
}
