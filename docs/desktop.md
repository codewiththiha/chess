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

Icons are regenerated from the application's own four-square mark:

```sh
python3 -m pip install pillow      # one-time, for the generator only
python3 scripts/make-icons.py
npm run tauri -- icon src-tauri/icons/icon.png   # optional .ico/.icns set
```

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
