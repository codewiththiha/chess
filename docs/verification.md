# Verification evidence

Recorded 2026-10-01 after the final `npm run verify:all` production run of revision
`a27443b`. All source/test/build gates completed successfully. This document
distinguishes actual engine/browser execution from isolated test-only fault
simulation.

**2026-10-02 redesign status.** The gates marked _published_ below describe
`a27443b`, the last pre-redesign revision. The redesign itself is verified as:
unit suite **144 tests in 15 files**; `svelte-check` 0 errors
and 0 warnings; `tsc` for the node and test configs clean; oxlint 0/0 with 58
vendored checksums; Prettier clean; `npm run check` and the production build
successful; and the full production browser suite **55 passed plus one intentional
skip in about 2 minutes 6 seconds** (28 scenarios on each of two projects, see the
counts below). The bot library followed the same way: **98 unit tests in 12 files**
and **61 passed plus one skip of 62 browser executions** (31 scenarios on each of
two projects). The review chat then landed as **112 unit tests in 13 files** and
**67 passed plus one skip of 68 browser executions** (34 scenarios on each of two
projects). The three talking characters followed as **138 unit tests in 15 files**
and **73 passed plus one skip of 74 browser executions** (37 scenarios on each of
two projects). Speaking the lines added the utterance plan to the unit suite
(**144 tests in 15 files**), and the browser suite stayed at **73 passed plus one
skip**. The redesign also
removed pause/resume in favour of a pre-game timeless choice, folded review into
the game card, and replaced IndexedDB with the SQLite database.

The coached review followed that as **181 unit tests in 18 files** and **89 passed
plus one intentional skip of 90 browser executions** (45 scenarios on each of two
projects), with `svelte-check` 0/0, `tsc` clean, oxlint 0/0, Prettier clean, and
the production build successful. This step made the review a walkthrough spoken by
the opponent character, replaced the "{opponent} said" remarks list with that
conversation, marked the piece that just moved with the engine's grade, and moved
every remaining colour into the two daisyUI themes and the token layer in
`styles/theme.css`.

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
passes **144 tests in 15 files**, covering everything below plus:

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
- The shipped bot identities (unique, in range, using discovered styles), bot
  validation for names, Elo targets, and picture data URIs, replacement and
  ordering of stored bots, a bot's own policy outranking the engine dialog, the
  fallback to the Elo captured on the record when a bot has been deleted, and a
  study or two-player record never being claimed by a bot.
- The SQLite bot rows themselves (idempotent writes, Elo ordering, deletion) and
  an in-memory upgrade of a pre-Elo database, which must rename the level column,
  add the opponent and bot columns, and survive a second migration run.
- The three voices: that every character has something to say about a greeting,
  a blunder, its own capture, and a finished game; that a line names the move,
  the piece, or the pawns it cost; that the same position always produces the
  same line while different positions do not; that the three escalate from kind
  to needling to unsparing; and that no line is longer than a bubble or leaves a
  placeholder unfilled.
- The speech plan: that each character gets a voice of the right sort, its own
  rate and pitch, the platform's language, and nothing at all for an empty line —
  and that no platform voice is ever invented.
- The reaction logic: a greeting when a bot game starts, a blunder named only
  after the engine evaluates it, praise only for the move the engine wanted, a
  plan taken from the engine's own line, silence for a quiet ply, an answer to a
  hint, and no talking at all in a two-player, study, or imported game.
- The conditions the coach quotes, read from real positions: a loose piece and the
  cheapest thing attacking it, a piece only the enemy king can take (a queen that
  walks onto f7 while the king stands on e8), absolute and relative pins, a fork
  the side to move can actually play, a skewer with the valuable piece in front, a
  discovered attack, passed/doubled/isolated pawns, king shelter, air, and heavy
  pieces on the back rank, and material counted from the board alone.
- The coach's sentences: the same function describing a fork and a loose knight
  differently, no tactic named that the position does not hold, the loose piece
  named with its real value, praise that does not offer a replacement, one wording
  per character, a review opener that reads the real counts back, and a suggestion
  that names the reason taken from the board it changes.
- The board's verdict mark: the thresholds shared with the review, the tone and
  the word per grade, and no mark at all without a real grade and a real square;
  and the walkthrough picking the reader's worst mistakes and blunders plus the
  moves the engine itself chose, in the order played and never for the opponent.
- The review chat's intent mapping for the questions people actually type, its
  answers quoting the engine's move, line, score, and a graded loss, its refusals
  when an evaluation or a review is missing, the forced-mate and level cases, and
  which questions it offers for the position on screen.
- Worker startup sharing, immediate cancellation, safe reinitialization, Auto
  fallback, stale-message suppression, clone errors, crash/restart, and stale
  queued-policy cancellation. Worker fault injection is isolated test scaffolding;
  discovery fixtures still come from the real portable binary.
- **Both actual portable and SIMD128 WASM binaries:** complete 11/38 discovery,
  every parameter's minimum/maximum/default, every behavior switch, perft 8,902,
  lossless seed, legal bounded/distinct MultiPV roots, and deterministic score
  agreement on the tested position. No local Rust compilation is involved.

The redesign browser suite runs **34 scenarios × 2 projects = 68 executions**:
**67 passed and one intentional skip**. The added scenarios cover two-player mode
(both colours moved by hand, no engine reply), a bot game that keeps playing while
study is on screen, arrows that appear in study and never during play, and premoves
that stay off until the setting is enabled, and the bot library: shipped bots on
Home, a custom bot with a picture that survives a reload and starts a game, and a
deleted bot leaving the finished game with its own name and Elo, and the review
chat answering a suggested and a typed question from the live line while
declining to grade a game that was never reviewed, and the characters themselves:
a greeting on the board, a new line after a real move, and no bubbles in a
two-player game. The coached review added five scenarios: the walkthrough opening
with the real move counts and then a bubble per moment, each one tap from the move
it is about, the board following that jump, the mark drawn on the top-right corner
of the square the piece landed on with a tone that matches its grade, the aid
switch turning the mark off and staying off across a reload, and a question
answered from the stored review in the same thread. The same run asserts the
absence of the removed list: no "Opponent remarks" region, no `.opponent-line`,
and no " said" inside the review panel. The skipped case is the desktop-only "fits the viewport without page
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

Verified on 2026-10-02 (local date), source commit `264b52f` (the study/bot
redesign, pushed after the notes above were written):

- [CI push run 36967546135](https://github.com/codewiththiha/chess/actions/runs/36967546135):
  success on every job — Selection, Commit messages, Quality, Unit and WASM,
  Production build, Browser (desktop), Browser (mobile), and the aggregate
  `Verify / Full verification`. The hosted browser jobs reported
  **Browser (desktop) 28 passed (1.1 m)** and **Browser (mobile) 27 passed plus 1
  skipped (57.0 s)** against the same 56 executions the local pre-push run
  produced (55 passed, 1 skipped, 2.1 m), with the desktop-only viewport check as
  the skip.
- The intermediate commit `e71f47f` failed the same suite once, on mobile only:
  the history count was read the moment Home opened, before the SQLite worker had
  written the newest record. The cause was a missing wait in the test helper, not
  app behaviour, so `savedGames()` now polls the list; the failing scenario then
  passed three consecutive local repeats (12/12 with `--repeat-each=2`) and both
  hosted projects before this revision was pushed.
- [Desktop push run 36966958295](https://github.com/codewiththiha/chess/actions/runs/36966958295):
  success for the same app revision. The `Desktop shell` job passed
  `cargo fmt --all --check`, `cargo clippy --all-targets --locked -- -D warnings`,
  and finished `cargo build --release --locked` in **2 m 39 s** on rustc 1.99.0,
  uploading the `desktop-shell-36966958295-1` artifact (1,763,465 bytes). The
  later revision `264b52f` changes tests only, so this remains the newest
  compilation of `src-tauri/`; re-dispatch the workflow after any Rust, frontend,
  or `Cargo.lock` change.

Verified on 2026-10-02 (local date), source commits `f206dae` (the bot library)
and `b33d207` (the review chat), both pushed after the notes above:

- [CI push run 36969611876](https://github.com/codewiththiha/chess/actions/runs/36969611876)
  for `f206dae`: success on every job. The hosted unit job reported **12 files /
  98 tests passed**; Browser (desktop) **31 passed (1.2 m)** and Browser (mobile)
  **30 passed plus 1 skipped (1.2 m)** — the same 62 executions as the local
  pre-push run. Artifacts: `production-36969611876-1` (7,419,518 bytes),
  `playwright-desktop-1` (257,055 bytes), `playwright-mobile-1` (258,048 bytes).
- [Desktop push run 36969611677](https://github.com/codewiththiha/chess/actions/runs/36969611677)
  for the same revision: success, `cargo build --release --locked` finished in
  **2 m 45 s** on rustc 1.99.0 and uploaded `desktop-shell-36969611677-1`
  (1,763,465 bytes) after the frontend that ships the bot library was built.
- [CI push run 36970056358](https://github.com/codewiththiha/chess/actions/runs/36970056358)
  for `b33d207`: success on every job. Hosted unit job **13 files / 112 tests
  passed**; Browser (desktop) **34 passed (1.3 m)** and Browser (mobile) **33
  passed plus 1 skipped (1.0 m)** — the same 68 executions as the local run.
  Artifacts: `production-36970056358-1` (7,430,202 bytes),
  `playwright-desktop-1` (262,015 bytes), `playwright-mobile-1` (262,478 bytes).
- [Desktop push run 36970056147](https://github.com/codewiththiha/chess/actions/runs/36970056147)
  for `b33d207`: success, release build in **2 m 47 s**, artifact
  `desktop-shell-36970056147-1` (1,763,465 bytes). That run is the most recent
  compilation of `src-tauri/` at the time of writing.

Every count above is the value printed by the job that produced it; none is
estimated from a local run.

Verified on 2026-10-02 (local date), source commit `6446b2f` (the three named
characters and their voices):

- [CI push run 36973467685](https://github.com/codewiththiha/chess/actions/runs/36973467685):
  success on every job. The hosted unit job printed **15 files / 138 tests
  passed**; Browser (desktop) **37 passed (1.4 m)** and Browser (mobile) **36
  passed plus 1 skipped (1.4 m)** — the same 74 executions as the local pre-push
  run (73 passed, 1 skipped, 2.9 m). Artifacts: `production-36973467685-1`
  (7,446,562 bytes), `playwright-desktop-1` (267,985 bytes), `playwright-mobile-1`
  (270,230 bytes).
- [Desktop push run 36973467465](https://github.com/codewiththiha/chess/actions/runs/36973467465):
  success, artifact `desktop-shell-36973467465-1` (1,763,465 bytes). The Rust
  shell built against the frontend that ships the characters.
- Two regressions were caught by the browser suite before that push and fixed
  rather than papered over: the bubble strip pushed the desktop page past the
  viewport (the board now gives back the reserved height) and the dark theme
  needed the bubble's text at full opacity to clear the contrast gate.
- The same revision then had three more voice bugs found by reading a real
  transcript from the running app rather than by trusting the unit fixtures: a
  late engine report was filed against the ply that arrived, not the ply it
  described; a deepening report earned a verdict before the search settled; and a
  one-move principal variation made the character claim a plan in the reader's
  own voice. The controller now files reports by the ply the search started from,
  waits for `finished`, judges each ply at most once, and says nothing rather than
  claiming a plan the engine never gave it. Regression tests cover all three, and
  the same transcript then read `I intend Nc6` — a move for its own side.

Verified on 2026-10-02 (local date), source commit `8738c8b` (the opponents speak
their lines):

- [CI push run 36976059490](https://github.com/codewiththiha/chess/actions/runs/36976059490):
  success on every job. The hosted unit job printed **15 files / 144 tests
  passed** — the six new ones plan the utterance a character speaks; Browser
  (desktop) **37 passed (1.9 m)** and Browser (mobile) **36 passed plus 1 skipped
  (2.1 m)**, matching the local pre-push run (73 passed, 1 skipped, 3.5 m).
  Artifacts: `production-36976059490-1` (7,450,489 bytes),
  `playwright-desktop-1` (267,842 bytes), `playwright-mobile-1` (270,466 bytes).
- [Desktop push run 36976059114](https://github.com/codewiththiha/chess/actions/runs/36976059114):
  success (3.2 m), artifact `desktop-shell-36976059114-1` (1,763,465 bytes). The
  Rust shell still compiles against the frontend that now speaks.
- Local pre-push gates at `8738c8b`: `npm run check` 0 errors 0 warnings,
  `npm run lint` clean, `format:check` clean, **144 unit tests in 15 files**,
  **73 passed plus one skip of 74 browser executions**, `npm run build` green.
- One regression test in the browser suite failed once and passed on its own
  four repeats, so its cause was not the speech work; it is left unweakened
  rather than papered over with a longer timeout.

At `8738c8b` plus the speech follow-up (before the commit that carries this
paragraph), the local gates read **145 unit tests in 15 files** and **79 passed
plus one skip of 80 browser executions**, `npm run check` 0 errors 0 warnings and
`npm run lint` clean.

- The browser suite now drives speech through a stubbed platform engine, because
  the headless browser has no voices: `tests/e2e/speech.spec.ts` records what
  would be said and asserts the words match the bubble, the pitch and pace match
  the character (Kyar Nyo warm and pitched up, Kyaw Gyi slow and pitched down),
  the platform voice matches the character's gender, staying silent until the
  reader turns the switch on, and no line is repeated back to back.
- That test found a real defect before the push: the character-to-voice match
  looked for the word "man" inside voice names, and "Samantha" contains "man", so
  the ruthless character was given a woman's voice on any platform that lists
  Samantha before Daniel. General words now have to stand alone and known voice
  names still match anywhere in the name; `tests/unit/chat.test.ts` pins both
  halves.
- The platform call itself is wrapped: a browser that refuses a voice, an
  utterance, or the call at all leaves the game alone. The first version assigned
  the voice outside the guard, which the stubbed engine exposed.

A documentation-only push does not build the desktop shell: that workflow is
filtered to `src-tauri/**`, `src/**`, `public/**`, `index.html`, and the package
manifests. [CI run 36976450261](https://github.com/codewiththiha/chess/actions/runs/36976450261)
for the doc commit after `8738c8b` shows exactly that — the verify workflow
passed and no desktop run was created.

Verified on 2026-10-02 (local date), source commit `3b295eb` (the voice fix and
the spoken lines driven in a real browser):

- [CI push run 36978282533](https://github.com/codewiththiha/chess/actions/runs/36978282533):
  success on every job. The hosted unit job printed **15 files / 145 tests
  passed**; Browser (desktop) **40 passed (1.5 m)** and Browser (mobile) **39
  passed plus 1 skipped (1.5 m)** — the same 80 executions as the local pre-push
  run (79 passed, 1 skipped, 3.2 m), three of them new speech scenarios on each
  project. Artifacts: `production-36978282533-1` (7,450,915 bytes),
  `playwright-desktop-1` (273,154 bytes), `playwright-mobile-1` (275,177 bytes).
- [Desktop push run 36978282282](https://github.com/codewiththiha/chess/actions/runs/36978282282):
  success (4.8 m), artifact `desktop-shell-36978282282-1` (1,763,465 bytes).
- Local gates at `3b295eb` before the push: `npm run check` 0 errors 0 warnings,
  `npm run lint` clean, `format:check` clean, **145 unit tests in 15 files**,
  **79 passed plus one skip of 80 browser executions**, `npm run verify` green.

Verified on 2026-10-02 (local date), source commit `59ed95c` (the talk rewrite:
advice, jokes about big pieces, no filler, no names in bubbles):

- [CI push run 36988473727](https://github.com/codewiththiha/chess/actions/runs/36988473727):
  success on every job. The hosted unit job printed **15 files / 151 tests
  passed**; Browser (desktop) **40 passed (1.2 m)** and Browser (mobile) **39
  passed plus 1 skipped (1.3 m)**, matching the local pre-push run (79 passed, 1
  skipped, 3.5 m). Artifacts: `production-36988473727-1` (7,459,430 bytes),
  `playwright-desktop-1` (272,430 bytes), `playwright-mobile-1` (274,985 bytes).
- [Desktop push run 36988474509](https://github.com/codewiththiha/chess/actions/runs/36988474509):
  success (4.4 m), artifact `desktop-shell-36988474509-1` (1,763,465 bytes).
- Local gates at `59ed95c` before the push: `npm run check` 0 errors 0 warnings,
  `npm run lint` clean, `format:check` clean, **151 unit tests in 15 files**,
  **79 passed plus one skip of 80 browser executions**, `npm run verify` green.
- The conversation was read from the running app again rather than trusted to
  fixtures. A real game (1. e4 d5 2. Qh5 dxe4 3. Qxf7+ Kxf7 4. g4 e5 5. a4 Nc6)
  produced exactly six remarks, each matching the move in the record: the loose
  queen at ply 3, the pawn the character took at ply 4 (`dxe4`), the advice
  naming `d3` for the position the reader then blundered in, the queen it won at
  ply 6, a slip for `g4`, and advice for `a4` two mistakes later. The ordinary
  plies stayed silent, the queue of utterances out loud matched the bubbles word
  for word, and no bubble carried the speaker's name.

The two pushes that carried the talk rewrite's tests were not green first time,
and both failures were real:

- [CI run 36989006041](https://github.com/codewiththiha/chess/actions/runs/36989006041)
  failed on Browser (mobile): the scenario still waited for a new remark after two
  ordinary opening moves, which the rewrite stopped producing on purpose. The
  scenario now plays into a real blunder and waits for that, and the rule that an
  ordinary ply stays quiet is left to the unit tests, which can drive the engine
  directly (`d146d44`).
- [CI run 36989843763](https://github.com/codewiththiha/chess/actions/runs/36989843763)
  failed on Browser (desktop) in `settings.spec.ts`: saving new performance limits
  closes the dialog only once the engine has taken them, and a no-deadline search
  that is being stopped can outlast the default five-second wait. The assertion
  now waits for the real event instead of a short default (`098f770`).

Verified on 2026-10-02 (local date), source commit `098f770` (the green run after
both fixes):

- [CI push run 36990652463](https://github.com/codewiththiha/chess/actions/runs/36990652463):
  success on every job. The hosted unit job printed **15 files / 151 tests
  passed**; Browser (desktop) **40 passed (1.7 m)** and Browser (mobile) **39
  passed plus 1 skipped (1.6 m)**, matching the local pre-push run (79 passed, 1
  skipped, 3.6 m). Artifacts: `production-36990652463-1` (7,459,430 bytes),
  `playwright-desktop-1` (273,557 bytes), `playwright-mobile-1` (275,341 bytes).
