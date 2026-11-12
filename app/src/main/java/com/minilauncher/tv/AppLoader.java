package com.minilauncher.tv;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.os.Build;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Finds launchable apps and works out which ones came from an APK rather than an app store. */
final class AppLoader {

    /** Installers that count as "store" installs. Anything else (or no installer) is a sideloaded APK. */
    private static final Set<String> STORE_INSTALLERS = new HashSet<>(Arrays.asList(
            "com.android.vending",          // Google Play Store
            "com.google.android.feedback",  // legacy Play installer
            "com.amazon.venezia"            // Amazon Appstore
    ));

    private AppLoader() {}

    /**
     * @param includeSystem also return preinstalled/system apps (off by default)
     * @param hidden        packages the user chose to hide
     */
    static List<AppEntry> load(Context context, boolean includeSystem, Set<String> hidden) {
        PackageManager pm = context.getPackageManager();
        String self = context.getPackageName();

        // TV apps first so their leanback activity wins over a phone-style launcher activity.
        Map<String, ResolveInfo> byPackage = new LinkedHashMap<>();
        collect(pm, Intent.CATEGORY_LEANBACK_LAUNCHER, byPackage);
        collect(pm, Intent.CATEGORY_LAUNCHER, byPackage);

        List<AppEntry> result = new ArrayList<>();
        for (Map.Entry<String, ResolveInfo> e : byPackage.entrySet()) {
            String pkg = e.getKey();
            if (pkg.equals(self) || hidden.contains(pkg)) continue;

            ResolveInfo ri = e.getValue();
            ApplicationInfo ai = ri.activityInfo.applicationInfo;
            if (!ai.enabled) continue;

            boolean system = (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            if (system && !includeSystem) continue;

            boolean sideloaded = !system && !STORE_INSTALLERS.contains(installerOf(pm, pkg));

            CharSequence label = ri.loadLabel(pm);
            Drawable banner = null;
            try {
                banner = ri.activityInfo.loadBanner(pm);
                if (banner == null) banner = ai.loadBanner(pm);
            } catch (Exception ignored) {
            }
            Drawable icon = ri.loadIcon(pm);

            result.add(new AppEntry(pkg,
                    new ComponentName(pkg, ri.activityInfo.name),
                    label == null ? pkg : label.toString(),
                    banner, icon, sideloaded, system));
        }

        Collator collator = Collator.getInstance();
        collator.setStrength(Collator.PRIMARY);
        result.sort((a, b) -> collator.compare(a.label, b.label));
        return result;
    }

    private static void collect(PackageManager pm, String category, Map<String, ResolveInfo> out) {
        Intent intent = new Intent(Intent.ACTION_MAIN).addCategory(category);
        List<ResolveInfo> list = pm.queryIntentActivities(intent, 0);
        for (ResolveInfo ri : list) {
            if (ri.activityInfo == null) continue;
            String pkg = ri.activityInfo.packageName;
            if (!out.containsKey(pkg)) out.put(pkg, ri);
        }
    }

    @SuppressWarnings("deprecation")
    private static String installerOf(PackageManager pm, String pkg) {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                InstallSourceInfo info = pm.getInstallSourceInfo(pkg);
                String installer = info.getInstallingPackageName();
                if (installer == null) installer = info.getInitiatingPackageName();
                return installer;
            }
            return pm.getInstallerPackageName(pkg);
        } catch (Exception e) {
            return null;
        }
    }
}
