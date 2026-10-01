# Verification evidence

Recorded 2026-10-01 after the final `npm run verify:all` production run.
All source/test/build gates completed successfully. This document distinguishes
actual engine/browser execution from isolated test-only fault simulation.

## Suite and executed coverage

The unit suite currently passes **55 tests in 8 files**. It covers:

- Orthodox legal moves/perft, both castling conventions, king-already-on-target
  Chess960 castling, en passant, promotion, and all 960 unique legal starts.
- Legal PGN mainlines, non-starting FEN round trips, Chess960 Variant preservation,
  malformed input, unsupported variants, and bounded imported player names.
- Elapsed clocks, paused snapshots, exact expiry between ticks, pending-promotion
  expiry, timeout insufficient mating material, increments, and complete u64 budgets.
- Side-correct CPL grading, absence of fabricated accuracy, terminal-checkmate
  formatting, and no inferred per-line mate distance from a large numeric score.
- Real Dexie transactions using fake-indexeddb, atomic game/review deletion,
  legal replay instead of trusting saved SAN/FEN, malformed records/preferences,
  corrupt-preference archive isolation, and truthful rejected-write behavior.
- Review identity/history/budget validation, legal cached PVs, finite scores,
  duplicate positions, and false completion rejection.
- Worker startup sharing, immediate cancellation, safe reinitialization, Auto
  fallback, stale-message suppression, clone errors, crash/restart, and stale
  queued-policy cancellation. Worker fault injection is isolated test scaffolding;
  discovery fixtures still come from the real portable binary.
- **Both actual portable and SIMD128 WASM binaries:** complete 11/38 discovery,
  every parameter's minimum/maximum/default, every behavior switch, perft 8,902,
  lossless seed, legal bounded/distinct MultiPV roots, and deterministic score
  agreement on the tested position. No local Rust compilation is involved.

The browser suite passed **24 scenarios × 2 projects = 48 executions** in the
final production run (about 1 minute 48 seconds). Coverage includes:

- Real engine responses to tap/click, mouse drag, CDP touch drag, and keyboard moves.
- Illegal-drop rejection; explicit/cancellable underpromotion; standard and
  Chess960 castling; Black side, custom clocks, and en passant.
- Reload/restoration, pause/resume, elapsed timeout, history/takeback, resignation,
  PGN import/download, rename, delete, analysis-copy isolation, and malformed input.
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

## Final gate results

| Gate                                               | Final status                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Svelte diagnostics + native TS source/config/tests | Passed; 0 Svelte errors/0 warnings                                          |
| Oxlint + authored-code/provenance hygiene          | Passed; 0 warnings/errors; 58 vendored hashes verified                      |
| Prettier                                           | Passed for all authored formatted files                                     |
| Unit/integration suite                             | 55/55 passed in 8 files                                                     |
| Production build                                   | Passed; JS 363.05 kB (119.08 kB gzip), CSS 138.41 kB (23.18 kB gzip)        |
| Desktop + mobile production browser suite          | 48/48 passed; no retries required                                           |
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

Final production screenshots are kept as `docs/desktop-play.png`,
`docs/mobile-play.png`, `docs/desktop-review.png`, and `docs/mobile-review.png`.
They depict actual WASM-driven games/review, not fabricated UI data.

Desktop project: Chromium at 1440×1000. Mobile project: touch-enabled iPhone 13
viewport/device emulation at 390×664 **using Chromium**, plus 320×740 checks. This is not a
claim of physical iOS Safari/WebKit, Firefox, Android hardware, screen-reader
certification, or chess-engine strength/playing-quality parity. Automated axe
success is useful evidence, not a complete accessibility conformance guarantee.

No production performance benchmark, cloud sync, multi-tab conflict resolution,
PWA install/offline guarantee, native SMP/Syzygy execution, or calibrated rating
measurement is claimed. A single active play tab is the supported workflow.

The separate engine repository remains at `4e2af5f` and is not modified by this
frontend verification. The new frontend's initial delivery is local-only with no
remote/push. Vendored binaries/artwork remain checksum-identical to their sources.
