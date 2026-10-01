# gwaymaegyi chess

A board-first chess studio for playing, exploring, and keeping your games.
Real Rust-built WebAssembly. Licensed SVG pieces. Your browser, not a cloud account.

![Desktop play](docs/desktop-play.png)

## What works

- **Play against gwaymaegyi:** White or Black, standard chess or any of the 960
  starting positions, custom clocks/increments, promotion, castling, en passant,
  takeback, resignation, and current-position draw claims.
- **Move naturally:** tap/click, mouse drag, touch drag, or the accessible
  keyboard board. Piece motion respects both your toggle and reduced-motion
  system preferences. Move sound is opt-in.
- **Study a position:** legal moves for both sides, FEN loading/copying,
  full-strength analysis, MultiPV continuations, hints, arrows, and signed
  evaluation. Every engine result comes from the bundled WASM worker.
- **Keep your games:** automatic IndexedDB recording, paused restoration after
  refresh, searchable local archive, rename/delete, and PGN import/export.
  Analysis copies do not overwrite the original archived game.
- **Review real moves:** cancellable, resumable per-position engine searches,
  evaluation chart with keyboard navigation, and transparent centipawn-loss
  annotations. Search budgets accompany cached results.
- **Tune the actual engine:** all 11 discovered behavior switches and 38 numeric
  parameters, policy/strength/seed/hash/MultiPV, scheduling and search limits,
  live performance updates, and Automatic/Portable/SIMD128 selection.
- **Make it yours:** Sage, Walnut, Ocean, and Graphite boards; Chessnut, Celtic,
  and Classic pieces; Light/Dark/System; independent board-aid preferences.

There is no external analysis API, account, telemetry, or game-upload backend.
Assets load from the app's own origin. This is not a service-worker-backed PWA:
initial loading still requires the static app files to be available.

**Initial delivery is an independent, local-only repository. No GitHub remote
or push is configured.** The Rust engine repository is separate and unchanged.

## Run locally

Use Node.js **24 or newer** and npm. Python 3 is needed for repository checks.

```sh
npm ci
npm run dev
```

For the production build:

```sh
npm run build
npm run preview -- --port 5173
```

Open the address printed by Vite. Keep the same origin/port to see the same
IndexedDB library. Do not open `index.html` directly with `file://`.

No Rust compiler, engine compilation, API keys, or external engine service is
needed. Verified portable and SIMD128 packages are included in `public/engine`.

## Verification

```sh
npm run verify              # strict Svelte/TS, lint, format, unit tests, build
npx playwright install --only-shell chromium
npm run test:e2e            # production app, desktop + touch-enabled mobile
npm run verify:all          # both gates together
npm run check:commit        # validate the actual HEAD commit message
```

On Linux, Playwright may also require `npx playwright install-deps chromium`.
The browser suite uses port 5173; use a dedicated preview for this project rather
than an unrelated application on that port.

The verification suite contains **55 unit/integration tests** and **48 browser
executions** (24 scenarios on desktop and emulated mobile). The actual WASM
binaries are exercised, not replaced with production mocks. Fault simulations
are confined to tests. See [verification evidence](docs/verification.md).

## Engine controls and honest limits

| Family         | Browser controls                                                                          |
| -------------- | ----------------------------------------------------------------------------------------- |
| Playing policy | Balanced, Attacking, Human-like, Analysis; skill 1–21 or nominal Elo 500–3000             |
| Resources      | Hash 1–64 MiB; MultiPV 1–32; depth 1–64                                                   |
| Exact integers | Seed 0–18,446,744,073,709,551,615; node budget 1–the same maximum, stored as decimal text |
| Scheduling     | Work/slice 1–65,536; report interval 0–5,000 ms; optional deadline 1–86,400,000 ms        |
| Tuning         | Every discovered behavior and numeric parameter, with actual bounds/defaults              |
| Runtime        | Auto fallback, explicit Portable/SIMD128, stop/restart, actionable startup errors         |

Native SMP Threads, Syzygy, and the native engine's larger resource ranges are
**not available in this WASM build**. They are explained, not represented by
pretend browser toggles. Review uses an independent worker, not search threads.

Hints, analysis, and review use full-strength analysis. Playing presets apply to
engine play. Nominal Elo is **uncalibrated**, not a measured rating.

Review is not Chess.com accuracy, a brilliant-move detector, or a winning
probability. Categories use before/after centipawn loss: first choice is Best;
otherwise <50 Good, <100 Inaccuracy, <200 Mistake, and ≥200 Blunder. Mate
transitions use ±30,000 cp grading sentinels, which can dominate averages.
Only reported mate metadata is formatted as a mate distance; an already finished
checkmate is labeled as the winning side.

## Storage, clocks, and portability

- Moves and settings persist locally in IndexedDB. A new timed game starts its
  clock when the engine is ready; restored games stay paused until resumed.
  Clocks use elapsed monotonic time, not a decrement-per-render counter.
- Changing modes/history pauses play. An analysis branch is a separate record;
  opening a saved game for analysis creates a copy.
- Export PGN before clearing browser data or moving to another browser/origin.
  Private-mode storage, quotas, or browser cleanup can make IndexedDB unavailable;
  failures are surfaced rather than reported as a successful save.
- PGN import supports legal **standard/Chess960 mainlines**, not comments or
  variations. Limits: 2 MB input, 100 games/import, 2,048 plies/game; displayed
  player names are bounded to 120 characters. Use FEN for a position without moves.
- Draw claims cover the current threefold/50-move position; intended-move claims
  are not implemented. Fivefold/75-move draws are automatic.
- Use one active play tab per game. Cross-tab conflict resolution/cloud sync is
  outside this release. Closing a tab is not a guarantee that its final pending
  IndexedDB write will complete.

## Project map

- [Architecture and invariants](docs/architecture.md)
- [Build plan and acceptance criteria](docs/plan.md)
- [Research and decisions](docs/research.md)
- [Verification and known coverage limits](docs/verification.md)
- [Contributor instructions](agents.md)
- [Original researched interface-design skill](.agents/skills/chess-interface-design/SKILL.md)
- [Artwork, engine, and dependency notices](THIRD_PARTY_NOTICES.md)

Scaffolded from Vite's Svelte + TypeScript template, using Svelte 5, Tailwind 4,
daisyUI 5, Chessground, chessops, Dexie, Lucide, and self-hosted fonts. Current
compatible dependency versions are pinned in `package.json` and the npm lockfile.
TypeScript 7 supplies the native checks; TypeScript 6 is the documented compiler-API
bridge required by current Svelte tooling, not an accidental downgrade.

## License and publishing

Authored frontend code: **GPL-3.0-or-later**, with the complete [license](LICENSE).
Bundled engine/models, artwork, fonts, and dependencies retain their own notices.
Do not remove them. A hosted/distributed build must be accompanied by the
corresponding GPL-compatible frontend source, license notices, and a source
location users can actually access. Read [third-party notices](THIRD_PARTY_NOTICES.md)
before publishing; this initial delivery does not publish or push anything.
