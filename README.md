# Mini Launcher for Google TV

A tiny, ad-free home screen for Google TV / Android TV.

- **No ads, no recommendations, no tracking.** Just your apps.
- **Big clock + date + weather** at the top. Weather comes from [Open-Meteo](https://open-meteo.com)
  (free, no API key); location is detected automatically from your IP, or set a city in the ⚙ menu.
  Internet is used for nothing else.
- **Apps** tab: everything you installed from the Play Store.
- **APKs** tab: everything you sideloaded (installed from an APK file, via Downloader, a file manager, `adb`, etc.).
- **Games** tab: 100 built-in offline games (36 different games, many with several difficulty/size
  versions), all playable with the remote's D-pad. Best scores are saved. Back exits a game.
- System / preinstalled apps are hidden (can be turned on from the ⚙ menu).
- Long-press OK (or press Menu) on an app: Open · App info · Uninstall · Hide.
- ⚙ menu: open Android TV settings, show/hide preinstalled apps, unhide apps, pick default home app,
  weather city, °C/°F.

## Get the APK

Every push is built by GitHub Actions (`.github/workflows/build.yml`).
Download `MiniLauncher.apk` from the repo's **Releases** page (pre-release named after the branch)
or from the run's **Artifacts**.

To build locally instead (needs the Android SDK): `./gradlew assembleRelease`.

## Install on the TV

1. On the TV: Settings → System → About → click **Android TV OS build** 7 times to enable Developer options.
2. Settings → System → Developer options → turn on **USB debugging** (and **Network debugging** if shown).
3. From a computer on the same Wi-Fi (find the TV's IP in Settings → Network):

   ```sh
   adb connect <TV-IP>
   adb install -r MiniLauncher.apk
   ```

   (Alternatively, use the *Downloader* app on the TV with the release's download URL.)

## Make it the home screen

Google TV doesn't let you pick another home app from settings — the Home button always goes to the
stock launcher. The usual fix is to disable the stock launcher with adb:

```sh
adb shell pm disable-user --user 0 com.google.android.apps.tv.launcherx
adb shell pm disable-user --user 0 com.google.android.tungsten.setupwraith
```

Press Home and Mini Launcher takes over (choose it and "Always" if asked).

**Undo** (restores the Google TV home screen):

```sh
adb shell pm enable com.google.android.apps.tv.launcherx
adb shell pm enable com.google.android.tungsten.setupwraith
```

Notes:
- Disabling the stock launcher also removes things that live inside it (e.g. the Google TV account/profile
  switcher and some input/Ambient settings shortcuts). Settings remain reachable from the ⚙ menu.
- A system update may re-enable the stock launcher; just run the commands again.
- If you'd rather not disable anything, a button-remapping app (e.g. "Button Mapper") can send the Home
  button to Mini Launcher instead.

## Games

The games are plain HTML5/JavaScript in `app/src/main/assets/games/` (`engine.js` + `g_*.js`),
run in a WebView with network access blocked. `node tools/test-games.js` smoke-tests every game in
headless Chromium and regenerates `catalog.json`, which the launcher reads to build the Games tab.
To try them on a computer, open `index.html#snake/0` in a browser (arrow keys + Enter).

## How "APK" apps are detected

An app counts as sideloaded when its installer isn't an app store (`com.android.vending` – Google Play,
or Amazon Appstore). See `AppLoader.java` to tweak this.

## Signing (optional, recommended)

Without a key, CI signs with a throwaway debug key that changes every run, so updating means
uninstalling first. To keep one signature, create a key once and store it as GitHub secrets:

```sh
keytool -genkeypair -keystore launcher.keystore -storetype PKCS12 -alias minilauncher \
  -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Mini Launcher"
base64 -w0 launcher.keystore   # paste output into secret SIGNING_KEYSTORE_BASE64
```

Then add secret `SIGNING_PASSWORD` (the password you chose) under the repo's
Settings → Secrets and variables → Actions. Never commit the keystore.
