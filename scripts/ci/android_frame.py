# Adapt the generated Android project: keep the webview inside the system bars,
# and let the pipeline sign the release builds it publishes.
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
ANDROID = ROOT / "src-tauri/gen/android"
APP = ANDROID / "app"
MAIN = APP / "src/main"
MARKER = "gwaymaegyi android frame"
LIGHT_BACKGROUND = "#EDF1EF"
DARK_BACKGROUND = "#17241F"

ACTIVITY = """\
package {package}

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {{
  override fun onCreate(savedInstanceState: Bundle?) {{
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // {marker}: the window is edge to edge, so the webview is inset by hand and
    // never draws over the notification bar or the gesture bar.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) {{ view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }}
  }}
}}
"""

THEME = """\
<resources xmlns:tools="http://schemas.android.com/tools">
    <!-- {marker}: the strip behind the system bars matches the app's own ground. -->
    <style name="{theme}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:windowBackground">@color/app_background</item>
    </style>
</resources>
"""

COLOUR = """\
<resources>
    <!-- {marker} -->
    <color name="app_background">{value}</color>
</resources>
"""

SIGNING = """
// {marker}: sign release builds with the keystore the pipeline supplies, so the
// published APKs install on a device and upgrade each other.
val releaseKeystore: String =
  System.getenv("ANDROID_KEYSTORE_PATH") ?: "${{projectDir}}/release.keystore"
android {{
  signingConfigs {{
    create("release") {{
      storeFile = file(releaseKeystore)
      storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
      keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "gwaymaegyi"
      keyPassword =
        System.getenv("ANDROID_KEY_PASSWORD")
          ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
    }}
  }}
  buildTypes {{
    getByName("release") {{
      signingConfig = signingConfigs.getByName("release")
    }}
  }}
}}
"""


def patch_activity(path: Path) -> None:
    """Keep the generated package name and inset the webview by hand."""
    source = path.read_text()
    found = re.search(r"^package\s+([\w.]+)", source, re.M)
    if not found:
        raise SystemExit(f"{path} has no package line to keep.")
    path.write_text(ACTIVITY.format(package=found.group(1), marker=MARKER))


def patch_theme(path: Path) -> None:
    """Keep the generated theme name and hang the bars on the app's own ground."""
    source = path.read_text()
    found = re.search(r'name="(Theme\.[^"]+)"', source)
    if not found:
        raise SystemExit(f"{path} names no theme to keep.")
    path.write_text(THEME.format(theme=found.group(1), marker=MARKER))


def patch_signing(path: Path) -> None:
    """Sign release builds with the keystore the environment points at."""
    source = path.read_text()
    if MARKER in source:
        return
    path.write_text(source.rstrip("\n") + "\n" + SIGNING.format(marker=MARKER))


def write_background(directory: Path, value: str) -> None:
    """Name the app's own background colour for one night-mode folder."""
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "app_background.xml").write_text(
        COLOUR.format(marker=MARKER, value=value)
    )


def main() -> None:
    activity = next(MAIN.rglob("MainActivity.kt"), None)
    theme = MAIN / "res/values/themes.xml"
    gradle = APP / "build.gradle.kts"
    if activity is None or not theme.is_file() or not gradle.is_file():
        raise SystemExit("Run `tauri android init` before adapting the project.")
    patch_activity(activity)
    patch_theme(theme)
    patch_signing(gradle)
    write_background(MAIN / "res/values", LIGHT_BACKGROUND)
    write_background(MAIN / "res/values-night", DARK_BACKGROUND)
    print(f"Android project adapted: {activity.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
