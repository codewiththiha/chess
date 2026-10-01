# Build plan and acceptance criteria

## Product

A local-first chess app with the actual gwaymaegyi WebAssembly engine, not a
mock analysis service. A board-first desktop/mobile interface supports play,
free analysis, review, and a searchable local game library.

## Delivery sequence

1. Scaffold the current Vite Svelte TypeScript template; pin current compatible
   packages; preserve dependency/asset licenses and engine provenance.
2. Implement typed rules, clocks, records, PGN/FEN validation, and IndexedDB.
3. Wrap the verified WASM SDK with cancellable job identities, discovery metadata,
   automatic SIMD selection, explicit backend choices, and actionable failures.
4. Build board/tap/drag/keyboard/promotion interaction and time-controlled play.
5. Add MultiPV analysis, move arrows, notation navigation, persistent game review,
   evaluation charts, and transparent centipawn-loss classifications.
6. Expose all WASM policy, strength, compute, behavior, and numeric tuning controls.
   Add themes, three real SVG piece sets, and motion/sound/highlight preferences.
7. Verify strict checks, unit tests, actual browser WASM, storage restoration,
   mobile layout, accessibility, production assets, and cancelled work.

## Engine control coverage

| Family         | Controls                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Playing policy | Four modes; skill 1–21 or nominal Elo; lossless seed; Chess960                                               |
| Search         | Hash 1–64 MiB; MultiPV 1–32; depth 1–64; lossless node budgets                                               |
| Scheduling     | Full/balanced/responsive presets; slice work; reporting interval; optional time deadline; live limit updates |
| Behaviors      | All eleven discovered switches; enable/disable all; reset                                                    |
| Tuning         | All 38 discovered numeric parameters, with engine-provided bounds/defaults                                   |
| Runtime        | Automatic/portable/SIMD128 backend; status, stop, restart/error recovery                                     |
| Native-only    | Clearly explain that native SMP Threads and Syzygy are unavailable in WASM; do not invent toggles            |

## Application controls

New game, side, standard/Chess960 start, clock/increment, resignation, draw claims,
takeback, flip, cursor navigation, FEN copy/load, PGN import/export, game rename,
local library search/delete/export, review cancellation/resume, legal destinations,
last/check highlights, best-move arrows, coordinates, animation, sound, board and
piece themes, and light/dark appearance. Settings and completed moves persist.

## Integrity

No unlicensed Chess.com assets, fake ratings, calibrated-accuracy claims, cloud
backup claims, credentials, or remote push. GPL-compatible SVG sets are vendored.
The independent local Git repository has no remote until one is provided.
