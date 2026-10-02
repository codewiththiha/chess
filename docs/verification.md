# Verification evidence

Recorded 2026-10-01 after the final `npm run verify:all` production run of revision
`a27443b`. All source/test/build gates completed successfully. This document
distinguishes actual engine/browser execution from isolated test-only fault
simulation.

**2026-10-02 redesign status.** The gates marked _published_ below describe
`a27443b`, the last pre-redesign revision. The redesign itself is verified as:
unit suite **83 tests in 11 files**; `svelte-check` 0 errors
and 0 warnings; `tsc` for the node and test configs clean; oxlint 0/0 with 58
vendored checksums; Prettier clean; `npm run check` and the production build
successful; and the full production browser suite **47 passed plus one intentional
skip in about 2 minutes 20 seconds** (see the counts below). The redesign also
removed pause/resume in favour of a pre-game timeless choice, folded review into
the game card, and replaced IndexedDB with the SQLite database.

That browser run found and fixed two real startup races rather than hiding them:
a stored-preferences read could land after a settings save and overwrite it, and
the stored game or view could replace a choice the reader made while the database
was still opening. Both are now guarded in `controllers/persistence.ts` and
`controllers/session.ts`, and the regression is covered by the settings and
review scenarios. The desktop shell is compiled only by the `Desktop` workflow;
no Rust is compiled in this workspace. Both workflows then ran against the pushed
revision and passed; see the hosted evidence below.

## Suite and executed coverage

The published unit suite passed **55 tests in 8 files**; the redesign suite
passes **83 tests in 11 files**, covering everything below plus:

- Orthodox legal moves/perft, both castling conventions, king-already-on-target
  Chess960 castling, en passant, promotion, and all 960 unique legal starts.
- Legal PGN mainlines, non-starting FEN round trips, Chess960 Variant preservation,
  malformed input, unsupported variants, and bounded imported player names.
- Elapsed clocks, paused snapshots, exact expiry between ticks, pending-promotion
  expiry, timeout insufficient mating material, increments, and complete u64 budgets.
- Side-correct CPL grading, absence of fabricated accuracy, terminal-checkmate
  formatting, and no inferred per-line mate distance from a large numeric score.
- Real SQLite statements (in-memory SQLite in Node, the identical `SqlStore` code
  the worker runs): round trips, newest-first summaries, idempotent updates,
  duplicate merging that keeps one review, oldest-record survival, cascade delete,
  settings round trips, malformed-row rejection, and derived identity — plus
  save-path isolation, merge adoption, and truthful rejected-write behavior.
- Review identity/history/budget validation, legal cached PVs, finite scores,
  duplicate positions, and false completion rejection.
- Time-control groups and classification (1 minute and below is bullet, under ten
  minutes is blitz, ten and above is rapid), adjustable clocks, and the shared
  game-action guards for records, cursors, and clock expiry.
- The bot/two-player mode split, a queued premove that plays when the engine
  answers, a premove dropped as illegal with a notice, study not pausing a bot
  game, the Elo-only strength model, and migration of stored skill preferences
  through the engine's published level-to-Elo presets.
- Worker startup sharing, immediate cancellation, safe reinitialization, Auto
  fallback, stale-message suppression, clone errors, crash/restart, and stale
  queued-policy cancellation. Worker fault injection is isolated test scaffolding;
  discovery fixtures still come from the real portable binary.
- **Both actual portable and SIMD128 WASM binaries:** complete 11/38 discovery,
  every parameter's minimum/maximum/default, every behavior switch, perft 8,902,
  lossless seed, legal bounded/distinct MultiPV roots, and deterministic score
  agreement on the tested position. No local Rust compilation is involved.

The redesign browser suite runs **28 scenarios × 2 projects = 56 executions**:
**55 passed and one intentional skip**. The added scenarios cover two-player mode
(both colours moved by hand, no engine reply), a bot game that keeps playing while
study is on screen, arrows that appear in study and never during play, and premoves
that stay off until the setting is enabled. The skipped case is the desktop-only "fits the viewport without page
scrolling" check, which cannot hold on a scrolling narrow layout. Coverage includes:

- Real engine responses to tap/click, mouse drag, CDP touch drag, and keyboard moves.
- Illegal-drop rejection; explicit/cancellable underpromotion; standard and
  Chess960 castling; Black side, custom clocks, and en passant.
- Reload/restoration, uninterrupted clocks, elapsed timeout, history/takeback,
  resignation, PGN import/download, rename, delete, one-record study branching, and
  malformed input that leaves the active game intact.
- All 11/38 controls, persisted tuning, real Portable backend, nominal Elo/seed,
  invalid-range staging, piece/board/theme/aids, live limit edits, and cancellation.
- Real engine review, persistent recovery, stop/resume, rejected corrupt cache,
  keyboard chart navigation, and no archive resurrection after deletion/reload.
- Invalid preferences without archive loss; aborted WASM downloads followed by
  real restart recovery. The latter deliberately fails network asset requests;
  it does not substitute fake engine results.
- Same-origin-only initial asset requests, no initial page errors, native dialog
  focus, reduced motion, 320 px no-horizontal-overflow checks, and automated axe
  WCAG 2 A/AA, 2.1 AA, and 2.2 AA audits in light/dark states.

## Initial release gate results (2026-10-01)

| Gate                                               | Final status                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Svelte diagnostics + native TS source/config/tests | Passed; 0 Svelte errors/0 warnings                                          |
| Oxlint + authored-code/provenance hygiene          | Passed; 0 warnings/errors; 58 vendored hashes verified                      |
| Prettier                                           | Passed for all authored formatted files                                     |
| Unit/integration suite                             | Published 55/55 in 8 files; redesign 71/71 in 9 files                       |
| Production build                                   | Passed; Vite production bundle with worker and WASM assets                  |
| Desktop + mobile production browser suite          | Redesign: 47 passed, 1 intentional mobile skip, no retries                  |
| Desktop shell (Tauri)                              | Compiled and linted only by the hosted `Desktop` workflow                   |
| Actual Conventional Commit                         | Passed; actual Conventional Commit and author/committer verified; no remote |

A separate final screenshot flow completed real e4/engine e5 play and an imported
seven-ply tactical game's actual WASM review on desktop/mobile. Both reviewed
8/8 positions. Native piece animations were allowed to settle; there were no page
errors or horizontal overflow. Screenshots use 1440×1000 and 390×844 viewports.

Reproduction:

```sh
npm ci
npm run verify
npx playwright install --only-shell chromium
npm run test:e2e
npm run check:commit
```

## Fixed issues covered by regression checks

- Native board listeners missing after an initially view-only Chessground mount.
- Chess960 PGN Variant lost by starting-position header normalization.
- Settings controls with overly broad accessible names; muted-text contrast;
  prohibited labels on generic decorative spans.
- Coordinate toggle requiring a Chessground DOM rebuild.
- Resize geometry sampled before the board's observer had completed, and mobile
  taps obscured by fixed bottom navigation in the test driver. The driver waits
  for stable sizing/centers touch targets; the responsive UI remains scrollable.
- Review restoration overwriting a newly started review; malformed cache reaching
  rendering; disposed startup retrying over a fresh worker; stale queued policies.
- Preference failures falsely followed by a saved toast; corrupt preferences
  preventing otherwise valid archives from loading.
- Deleted active/backup records being re-saved by later mode navigation.
- Terminal checkmate displayed as an invented mate-in-one and the chart using
  button semantics instead of an accessible position slider.

## Visual evidence and limits

Final production screenshots are kept as `docs/desktop-home.png`,
`docs/desktop-play.png`, `docs/mobile-play.png`, `docs/desktop-review.png`, and
`docs/mobile-review.png`. The published set depicts the `a27443b` shell; the same
files were re-captured on 2026-10-02 from the redesigned shell (Home, Play,
Study/Review) with real engine replies and a real restored record — still actual
WASM-driven play, never fabricated UI data.

Desktop project: Chromium at 1440×1000. Mobile project: touch-enabled iPhone 13
viewport/device emulation at 390×664 **using Chromium**, plus 320×740 checks. This is not a
claim of physical iOS Safari/WebKit, Firefox, Android hardware, screen-reader
certification, or chess-engine strength/playing-quality parity. Automated axe
success is useful evidence, not a complete accessibility conformance guarantee.

No production performance benchmark, cloud sync, multi-tab conflict resolution,
PWA install/offline guarantee, native SMP/Syzygy execution, or calibrated rating
measurement is claimed. A single active play tab is the supported workflow.

The separate engine repository remains at `4e2af5f` and is not modified by this
frontend verification. Its initial local-only release was subsequently approved
for publishing to https://github.com/codewiththiha/chess. CI behavior and
selective-run instructions are documented in docs/ci.md. Vendored binaries/artwork remain checksum-identical to their sources.

## CI extension (2026-10-02)

The publishing update adds full push/PR verification and selectable manual
workflows. Local `npm run verify` passed strict types, lint/provenance, formatting,
71 unit/integration tests, 14 CI-selection/result regression tests, and a
production build. `npm run lint:workflows` passed checksum-pinned actionlint 1.7.12.
The CI-style prebuilt production run passed 47 of 48 desktop/mobile browser
executions (one intentional mobile skip) in about 2 minutes 20 seconds on an
isolated port, with HTML and JUnit reports created. Full and targeted hosted runs are visible in the repository's
[Actions history](https://github.com/codewiththiha/chess/actions). Do not infer a
hosted run result from a locally passing gate; use the actual run conclusion.

See [the CI guide](ci.md) for browser/file filters, intentional skips, build
prerequisites, aggregate failure handling, and source-commit validation. Neither
the personal publishing credential nor credential-bearing URLs are included in
tracked files or workflow secrets. The separate engine repository is unchanged.

### Executed hosted evidence

Verified on 2026-10-02 (local date), source commit `0e455d8`:

- [Full push run 36916203038](https://github.com/codewiththiha/chess/actions/runs/36916203038):
  success. Quality/actionlint, 14 CI-script tests, 55 app unit/integration tests,
  the production build, actual commit checks, and 24 desktop + 24 mobile browser
  cases all passed. The aggregate check was `Verify / Full verification`.
- [Selective manual run 36916345995](https://github.com/codewiththiha/chess/actions/runs/36916345995):
  success. Only browser was selected, with mobile and the regex
  `import, real review|failed engine assets`. Both matching cases passed.
  Quality/unit/commit jobs intentionally skipped, production build still ran as
  the browser prerequisite despite its standalone input being false, and the
  aggregate was `Verify / Selected verification`, not the full merge gate.
- Both runs uploaded the production artifact and Playwright HTML/JUnit reports;
  artifact listing and test counts were confirmed through the actual run/job logs.

These are historical run links for the tested commit; inspect the latest branch
run for subsequent documentation or code changes. Artifacts expire after 7 days.

Verified on 2026-10-02 (local date), source commit `55c24f7` (the board-first
redesign plus the desktop shell):

- [CI push run 36962607639](https://github.com/codewiththiha/chess/actions/runs/36962607639):
  success. Selection, Quality, Production build, Commit messages, Unit and WASM,
  Browser (desktop), Browser (mobile), and the aggregate
  `Verify / Full verification` all passed. The hosted unit job ran the suite in
  **9 files**; Browser (desktop) reported **24 passed (59.4 s)** and Browser
  (mobile) **23 passed plus 1 skipped (52.7 s)** — the same 48 executions as the
  local pre-push run, where the desktop-only viewport check is the one skip.
- [Desktop push run 36962607902](https://github.com/codewiththiha/chess/actions/runs/36962607902):
  success. The single `Desktop shell` job installed the WebKitGTK/GTK
  prerequisites, ran `npm run build`, passed `cargo fmt --all --check`, passed
  `cargo clippy --all-targets --locked -- -D warnings`, and finished
  `cargo build --release --locked` in **2 m 36 s** on rustc 1.99.0, producing
  `target/release/gwaymaegyi-chess` (4,344,080 bytes) uploaded as the
  `desktop-shell-36962607902-1` artifact. No bundle was requested in that
  dispatch, so no installer is claimed.

That desktop job is the first real compilation of `src-tauri/`; treat its log as
the evidence for the shell, and re-run it after any Rust, frontend, or
`Cargo.lock` change.
