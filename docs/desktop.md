# Desktop shell

The desktop application is the same frontend revision in a Tauri window. There is
one codebase, one SQLite schema, and one engine: the shell adds a native window
and nothing else that could drift from the web build.

## What the shell is

| Layer        | Web build                                 | Desktop build                                |
| ------------ | ----------------------------------------- | -------------------------------------------- |
| Interface    | `src/` compiled by Vite                   | identical `dist/` embedded in `src-tauri/`   |
| Rules/engine | Rust engine as WASM in `public/engine`    | identical WASM packages, no native recompile |
| Storage      | SQLite WASM + OPFS pool in `src/lib/data` | identical database, in the webview's OPFS    |
| Native host  | browser                                   | Tauri window from `src-tauri/`               |

The Rust side of the shell is deliberately small: a window, the bundle metadata,
and one command (`desktop_info`) that tells the interface which host it runs in.
The Help dialog shows that line only when a desktop host answers, so the browser
build carries no desktop wording.

Storage is not re-implemented for desktop. The database stays the same
`@sqlite.org/sqlite-wasm` database persisted through the origin private file
system, so records written in the desktop build follow the same one-record
identity, review, and clock rules as the web build. If a webview cannot provide
that storage, the application says so with the existing session-only banner
instead of pretending to save.

## Commands

```sh
npm ci
npm run tauri -- dev      # Tauri window against the dev server on :5173
npm run tauri -- build    # production frontend + bundle for the current OS
```

`npm run tauri -- build` runs `npm run build` first (configured in
`src-tauri/tauri.conf.json`) so the window always embeds the verified bundle.
Rust 1.77.2 or newer and the platform's Tauri prerequisites are required **only**
for desktop packaging; the web build needs neither.

## The app mark

`public/favicon.svg` is the application's mark and the only artwork any platform
icon is drawn from: **a pawn cut as ink on a printed plate, with the printer's
rule set off centre**. Flat inks and three paths, no gradient, no shadow, and no
stroke — which is what keeps it legible at 16px, and the reason the one
asymmetry, the rule, is the only thing in the composition that is not centred.
The plate is a squircle (a superellipse with n = 5), so its corners are round the
way a phone's icon mask is round rather than as a circle stuck onto a square.

Nothing else draws it. `scripts/app_mark.py` holds the geometry and writes the
SVG, and the repo check fails if the committed file is not what the module
draws, so the numbers in that module are the single source:

```sh
npm run assets:mark     # rewrite public/favicon.svg from the geometry
```

Android is the one place a second copy is needed, because its launcher icons
must be vector drawables rather than SVG: `scripts/ci/android_frame.py` asks the
same module for the paths and writes the adaptive icon's layers — the plate
across the whole 108-unit canvas, and the pawn scaled so its furthest point
touches the 66-unit circle that survives every launcher mask. Devices below
API 26, which have no adaptive icons, get the whole mark as one vector.

## Platform icons

The PNG/ICO/ICNS set the shell embeds is **generated, not committed**, from the
mark:

```sh
npm run icons           # tauri icon public/favicon.svg -o src-tauri/icons
npm run assets          # the mark, then the platform set
```

`npm run icons` writes `32x32.png` through `icon.png`, `icon.ico` for Windows,
and `icon.icns` for macOS. A Windows build compiles the `.ico` into the
executable as its resource, so it must exist even though the bundle list is what
names it; both desktop workflows run this step before building, and
`src-tauri/icons/` is ignored by git.

## Verification

Rust is not compiled in this workspace. The shell is verified by the `Desktop`
workflow (`.github/workflows/desktop.yml`) on every push that touches the
frontend or `src-tauri/`, and by manual dispatch with an optional bundle step:

1. `npm run build` – the exact production frontend the shell embeds.
2. `cargo fmt --all --check` – formatting.
3. `cargo clippy --all-targets --locked -- -D warnings` – lints, warnings denied.
4. `cargo build --release --locked` – compiles the shell against the real frontend
   bundle and the committed `Cargo.lock`.
5. The compiled binary is uploaded as a workflow artifact; scheduled bundle builds
   (`deb`, `rpm`, `appimage`) are available from manual dispatch.

A hosted run conclusion is the only evidence for desktop compilation. Do not infer
a passing desktop build from the web gates, and do not claim a packaged installer
until that workflow job actually produced one.

## Limits

- The shell does not add native menus, tray icons, auto-update, or file
  associations. PGN export uses the browser download path inside the webview.
- Desktop storage inherits the webview's OPFS support. Where a platform webview
  cannot provide it, the app reports session-only data rather than silently
  dropping writes.
- Cross-platform bundles are produced per operating system by the Tauri toolchain;
  this repository only schedules Linux bundles in CI.
