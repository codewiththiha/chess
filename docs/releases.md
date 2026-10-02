# Releases

`.github/workflows/release.yml` turns a version tag into a published GitHub
release. It is the only workflow that writes to releases; the verification
workflows in [ci.md](ci.md) keep read-only permissions and never publish.

## What one release contains

- **Desktop bundles** for Linux x64 (`deb`, `rpm`, `AppImage`), macOS arm64 and
  Intel (`app`, `dmg`), and Windows x64 (NSIS installer, `msi`).
- **Android APKs** signed for installing by hand: one per architecture
  (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`) and a universal APK.
- **An Android App Bundle** (`app-universal-release.aab`) for Play Console.
- **A web bundle** (`gwaymaegyi-chess-VERSION-web.tar.gz`) of the production
  `dist` output, for anyone serving the app themselves.

## Cutting a release

1. Bump `version` in `package.json` and `src-tauri/tauri.conf.json` together;
   `tests/ci/test_release.py` fails the build if the two disagree.
2. Commit, push, and wait for **CI / Full verification** on that commit.
3. Tag and push the tag:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Watch **Actions → Release**. The `Prepare` job refuses a tag that does not
   name the shipped version, opens the release with generated notes, and every
   build job uploads its files to it.

A version with a hyphen (`0.2.0-rc.1`) is published as a pre-release. Re-running
a release for an existing tag is safe: the caches are reused and uploads
overwrite (`--clobber`).

## Dry runs

**Actions → Release → Run workflow** takes the tag and a `dry_run` switch. A dry
run builds every artifact on the same runners with the same signing but keeps
them as workflow artifacts instead of release assets, which is the way to prove
a pipeline change before tagging.

## Android builds

The Android project is **generated, not committed**: the workflow runs
`tauri android init --ci` and then `scripts/ci/android_frame.py`, which keeps the
generated package and theme names and applies the three things this app needs:

- `MainActivity.kt` applies the system-bar and display-cutout insets as padding,
  so the window stays edge to edge while the webview never draws over the
  notification bar or the gesture bar.
- `values`/`values-night` background colours put the strips behind those bars on
  the app's own ground instead of the platform default.
- `app/build.gradle.kts` gains a release signing config that reads the keystore
  from the environment.

Locally, the same steps are `npm run android:init` followed by
`npm run tauri -- android build --apk --split-per-abi`, with the Android SDK,
NDK, and JDK 17 installed.

### Signing

Without secrets the pipeline generates a throwaway keystore, so the APKs install
but each release is signed differently: a device must uninstall the previous
version before installing the next one, and Play Console requires a stable key.
Add these repository secrets for signatures that survive releases:

```sh
keytool -genkeypair -v -keystore release.jks -alias gwaymaegyi \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks > release.jks.b64
gh secret set ANDROID_KEYSTORE_BASE64 < release.jks.b64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_PASSWORD
gh secret set ANDROID_KEY_ALIAS   # gwaymaegyi
```

The Play Store wants the AAB, and its first upload has to be done by hand in the
Play Console. The version code is derived from the version
(`major * 1_000_000 + minor * 1_000 + patch`), so `0.1.0` is code `1000`.

## Adding more variants

- **Linux arm64:** add `ubuntu-24.04-arm` to the desktop matrix once the
  repository is public, which is the only thing that runner needs.
- **Windows arm64:** add a matrix entry with
  `args: '--target aarch64-pc-windows-msvc'` and the matching rust target.
- **Universal macOS:** `args: '--target universal-apple-darwin'` builds one
  binary for both Mac architectures, at the cost of a slower build.
- **iOS:** `tauri ios init` and `tauri ios build` on a macOS runner, the same way
  the Android job generates and adapts its project.

## Where the time goes

Release jobs run only for tags, so they never compete with push verification.
Inside them: Rust artifacts are cached per platform and Android separately from
desktop, Gradle's distribution and dependency cache is restored by lockfile
hash, npm downloads come from the shared action's cache, and the desktop matrix
fails independently so one platform cannot cancel the others. Push verification
caches the Playwright browser download and skips documentation-only pushes.
