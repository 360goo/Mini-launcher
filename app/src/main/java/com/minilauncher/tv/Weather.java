package com.minilauncher.tv;

import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Current weather from Open-Meteo (free, no API key, no ads).
 * Location: a city the user typed, otherwise an approximate location from the IP address.
 */
final class Weather {
    static final String KEY_CITY = "wx_city";          // user override; empty = auto
    static final String KEY_FAHRENHEIT = "wx_f";
    static final String KEY_TEXT = "wx_text";          // last shown line
    static final String KEY_TIME = "wx_time";          // when it was fetched
    private static final String KEY_LOC = "wx_loc";    // cached "lat,lon,name,source,time"
    private static final long LOCATION_TTL = 12L * 60 * 60 * 1000;

    private Weather() {}

    /** Fetches and returns the one-line weather summary (also cached in prefs). Runs on a background thread. */
    static String fetch(SharedPreferences prefs) throws Exception {
        double[] latLon = new double[2];
        String place = resolveLocation(prefs, latLon);
        boolean f = prefs.getBoolean(KEY_FAHRENHEIT, false);

        String url = "https://api.open-meteo.com/v1/forecast"
                + "?latitude=" + latLon[0] + "&longitude=" + latLon[1]
                + "&current=temperature_2m,weather_code,is_day"
                + "&daily=temperature_2m_max,temperature_2m_min"
                + "&timezone=auto&forecast_days=1"
                + (f ? "&temperature_unit=fahrenheit" : "");
        JSONObject o = new JSONObject(get(url));
        JSONObject cur = o.getJSONObject("current");
        JSONObject daily = o.getJSONObject("daily");
        int code = cur.getInt("weather_code");
        boolean day = cur.optInt("is_day", 1) == 1;
        long temp = Math.round(cur.getDouble("temperature_2m"));
        long hi = Math.round(daily.getJSONArray("temperature_2m_max").getDouble(0));
        long lo = Math.round(daily.getJSONArray("temperature_2m_min").getDouble(0));

        String text = String.format(Locale.getDefault(), "%s  %d°%s  %s   ↑%d°  ↓%d°%s",
                icon(code, day), temp, f ? "F" : "C", describe(code), hi, lo,
                place.isEmpty() ? "" : "   ·   " + place);
        prefs.edit().putString(KEY_TEXT, text).putLong(KEY_TIME, System.currentTimeMillis()).apply();
        return text;
    }

    private static String resolveLocation(SharedPreferences prefs, double[] out) throws Exception {
        String city = prefs.getString(KEY_CITY, "").trim();
        String source = city.isEmpty() ? "auto" : "city:" + city.toLowerCase(Locale.ROOT);

        String[] cached = prefs.getString(KEY_LOC, "").split("\t");
        if (cached.length == 5 && cached[3].equals(source)) {
            long age = System.currentTimeMillis() - Long.parseLong(cached[4]);
            if (!city.isEmpty() || age < LOCATION_TTL) {
                out[0] = Double.parseDouble(cached[0]);
                out[1] = Double.parseDouble(cached[1]);
                return cached[2];
            }
        }

        String name;
        if (!city.isEmpty()) {
            JSONObject o = new JSONObject(get("https://geocoding-api.open-meteo.com/v1/search?count=1&name="
                    + Uri.encode(city)));
            JSONArray results = o.optJSONArray("results");
            if (results == null || results.length() == 0) throw new Exception("City not found: " + city);
            JSONObject r = results.getJSONObject(0);
            out[0] = r.getDouble("latitude");
            out[1] = r.getDouble("longitude");
            name = r.optString("name", city);
        } else {
            JSONObject o;
            try {
                o = new JSONObject(get("https://ipapi.co/json/"));
                if (!o.has("latitude")) throw new Exception("no location");
            } catch (Exception first) {
                o = new JSONObject(get("https://ipwho.is/"));
            }
            out[0] = o.getDouble("latitude");
            out[1] = o.getDouble("longitude");
            name = o.optString("city", "");
        }
        prefs.edit().putString(KEY_LOC, out[0] + "\t" + out[1] + "\t" + name.replace("\t", " ")
                + "\t" + source + "\t" + System.currentTimeMillis()).apply();
        return name;
    }

    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(10000);
        c.setRequestProperty("User-Agent", "MiniLauncher");
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            int n;
            while ((n = in.read(b)) > 0) buf.write(b, 0, n);
            return buf.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    /** WMO weather codes → emoji. */
    static String icon(int code, boolean day) {
        if (code == 0) return day ? "☀️" : "🌙";
        if (code <= 2) return day ? "🌤️" : "☁️";
        if (code == 3) return "☁️";
        if (code == 45 || code == 48) return "🌫️";
        if (code >= 51 && code <= 57) return "🌦️";
        if (code >= 61 && code <= 67) return "🌧️";
        if (code >= 71 && code <= 77) return "❄️";
        if (code >= 80 && code <= 82) return "🌧️";
        if (code == 85 || code == 86) return "🌨️";
        if (code >= 95) return "⛈️";
        return "🌡️";
    }

    static String describe(int code) {
        if (code == 0) return "Clear";
        if (code == 1) return "Mostly clear";
        if (code == 2) return "Partly cloudy";
        if (code == 3) return "Cloudy";
        if (code == 45 || code == 48) return "Fog";
        if (code >= 51 && code <= 57) return "Drizzle";
        if (code >= 61 && code <= 67) return "Rain";
        if (code >= 71 && code <= 77) return "Snow";
        if (code >= 80 && code <= 82) return "Showers";
        if (code == 85 || code == 86) return "Snow showers";
        if (code >= 95) return "Thunderstorm";
        return "";
    }
}
