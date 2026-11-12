package com.minilauncher.tv;

import android.content.Context;
import android.graphics.Color;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/** Reads assets/games/catalog.json (generated from the game scripts) into launcher tiles. */
final class GameCatalog {
    private GameCatalog() {}

    static List<AppEntry> load(Context context) {
        List<AppEntry> out = new ArrayList<>();
        try (InputStream in = context.getAssets().open("games/catalog.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) buf.write(b, 0, n);
            JSONArray arr = new JSONArray(buf.toString("UTF-8"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String title = o.getString("title");
                String variant = o.optString("variantName", "");
                int color = Color.parseColor(o.optString("color", "#3A3A48"));
                GameBanner banner = new GameBanner(color, o.optString("icon", "🎮"), title, variant);
                String label = variant.isEmpty() ? title : title + " · " + variant;
                out.add(new AppEntry(o.getString("id"), o.getInt("variant"), label, banner));
            }
        } catch (Exception e) {
            // No catalog: the Games tab simply shows as empty.
        }
        return out;
    }
}
