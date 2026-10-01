# Architecture

## Ownership

The app is a static Vite/Svelte client. There is no backend, external engine API,
account database, or remote game-upload path. The board is presentation and input;
it does not establish a second source of chess rules.

```text
UI components → Session → GameActions / SearchController / ReviewController
                       → PersistenceController → ChessDatabase → IndexedDB
Rules, PGN, clocks, and grading ← pure domain functions
EngineClient → WorkerTransport → bridge-worker → verified Rust-built WASM
```

| Layer                                        | Responsibility                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `domain/chess.ts`, `chess960.ts`             | Legal chessops positions/moves, SAN/UCI, repetition, material, all 960 starts          |
| `domain/games.ts`, `pgn.ts`                  | Game construction/outcomes and bounded legal mainline import/export                    |
| `domain/clocks.ts`                           | Monotonic elapsed time, settling, increments, paused snapshots                         |
| `domain/preferences.ts`, `review.ts`         | Exact resource validation, defaults, side-correct evaluation and heuristic grading     |
| `data/validation.ts`, `review-validation.ts` | Decode unknown saved data before it can affect playable state or annotations           |
| `data/database.ts`, `errors.ts`              | Dexie tables/transactions; distinguish corrupt data from storage I/O failure           |
| `engine/protocol.ts`, `types.ts`             | Validate cross-worker discovery/report contracts                                       |
| `engine/transport.ts`                        | Worker lifecycle, Auto fallback, request identity, cancellation, timeout/error cleanup |
| `engine/client.ts`                           | Serialize policy changes and translate settings to actual browser SDK commands         |
| `state/app.svelte.ts`                        | One reactive application state, derived positions, plain snapshot boundaries           |
| `controllers/game.ts`                        | Legal actions, turn/history transitions, clock expiry, archived-play backup            |
| `controllers/search.ts`                      | Generation-checked play/hint/analysis searches and clock-aware budgets                 |
| `controllers/review.ts`                      | Independent review worker, per-position evaluation, cache/resume                       |
| `controllers/persistence.ts`                 | Snapshot saves, restoration, import/archive operations, truthful storage errors        |
| `controllers/session.ts`                     | Lifecycle/action orchestration; not engine internals or a second rules implementation  |
| `components/`, `styles/`                     | Accessible input/rendering, staged dialogs, responsive tokens and layout               |

Most authored components/modules stay below 250 lines. Game orchestration is a
small exception because its archived-play backup must remain privately owned;
separation is by responsibility, not arbitrary line splitting. Styles, vendored
code, and license texts are not part of that component-size guideline.

## Position and move invariants

A `GameRecord` retains the **original FEN plus legal UCI history**. The current
position is derived from its cursor. Engine position requests receive the original
FEN and history—not just the current FEN—so repetition and persistent policy context
are not lost. Standard castling is encoded king-to-target for the engine; Chess960
uses king-to-rook. chessops normalizes both legal input conventions.

Stored SAN/FEN are not trusted when a game is loaded: its UCI history is replayed,
legal SAN/FEN are reconstructed, and size/numeric/variant limits are checked.
Archive summaries validate their display fields and preview position without
replaying every game on every autosave; opening a record performs full replay.

Play, study, and review share one legal record, not independent board models.
Entering analysis preserves a paused play backup and creates a new record identity.
Branches truncate only the analysis copy. Opening an archived game for analysis
also copies it. Deletion forgets active/backup snapshots **before** deleting the
IndexedDB row, preventing later navigation/autosaves from resurrecting it.

## Board input

Chessground owns native drag/touch rendering; chessops owns move legality. Native
board events and the roving keyboard grid both call `GameActions.attempt`.
Promotion is a pending choice until a legal selected promotion is committed.
Clock expiry closes that dialog and cannot be bypassed by a late choice.

**Keep Chessground `viewOnly: false` at construction.** That flag determines whether
input listeners are installed at all; changing it later does not recreate them.
Read-only behavior instead gates movable color, draggable/selectable state, and
the legal controller path. Coordinate preference changes explicitly call
`redrawAll`, because the coordinate DOM is not rebuilt by a piece redraw.

The visual renderer is hidden from assistive technology; an equivalent labeled
8×8 grid supplies roving focus, legal destinations, and announcements. Arrow keys
operate inside the board; Enter/Space select and move; Escape clears selection.
Character-only F/N shortcuts are confined to the focused board/tools. The review
chart is an accessible position slider with arrows and Home/End.

Native dialogs own focus trapping/Escape/backdrop dismissal and restore the prior
focus without scrolling. Settings are staged and validated before acceptance.
Reduced motion overrides piece animations; mobile form text is at least 16 px.

## Worker boundary

`public/engine/{portable,simd128}` are immutable, checksum-recorded upstream
packages. The authored `bridge-worker.mjs` adds discovery metadata while using the
unchanged cooperative runtime. It does not emulate search, modify the engine, or
invent unsupported configuration capabilities.

- Discovery supplies capabilities, behavior names, parameter bounds, and defaults.
- Worker job IDs and controller generations suppress stale progress/results.
- Dispose rejects pending startup/search requests immediately and clears timers.
  An old failed startup cannot terminate or retry over a newer worker.
- Engine-client configuration is serialized and generation-checked; old queued
  policies cannot configure a newly initialized worker.
- Auto selects SIMD when supported and retries Portable on SIMD startup failure.
  Explicit SIMD failures remain actionable errors, not silent strength changes.
- Seed/nodes travel as lossless decimal strings. No conversion to JS `number`
  occurs for authoritative unsigned-64-bit values.
- Policy changes cancel incompatible work. Ordinary progress does not restart it.
  Performance-only edits update the retained search through the real SDK.
- Playing time is capped by the remaining clock. Hints/study use full-strength
  analysis. User policy/strength is respected in engine play.

The browser build is cooperative, not native SMP. A review worker has a separate
engine/hash allocation and may add memory pressure; it is not extra search threads.

## Clocks and persistence

Clock state stores remaining values, running color, and a monotonic anchor.
UI ticks update display at 100 ms, but remaining time derives from elapsed time.
A move rechecks expiry before acceptance. Increments belong to the completed actor.
Timeout is a draw when the opponent has insufficient mating material.

Clocks start for a ready new game, pause for history/mode changes, and restore
paused. IndexedDB receives snapshots with no live anchor. Completed actions save
immediately; active clocks also autosave every 10 seconds. Before-unload saving
is best effort and only occurs after initialization for a running/pending game.
It never writes the initial placeholder over unread saved preferences.

Dexie database `gwaymaegyi-chess`, schema v1:

- `games`: `id, updatedAt, createdAt, kind, result`
- `reviews`: `gameId, updatedAt`
- `settings`: `key` (`preferences` contains a versioned value)

Game/review deletion is one read-write transaction. Multi-game import is atomic
and legally validated before insertion. Zero-ply records are omitted from the
archive listing, not treated as completed games.

Corrupt preferences fall back to defaults while the archive still loads. An
invalid active record is not installed. Corrupt reviews are rejected with a
fresh-review action. I/O failures get a storage banner; preferences that cannot
be stored are described as session-only, never toasted as successfully saved.

## Review evidence

Review evaluates ply 0 through the final position using a dedicated worker/PV1.
Each finished position is persisted. Its fingerprint includes engine revision,
starting FEN, variant, complete UCI history, selected policy/tuning, and review
budget. Matching partial evidence can resume; different budgets/policies start
fresh evidence. Restoration checks identity, bounded fields, unique plies,
legal best moves/PVs, and honest completion before exposing annotations.

| Preset   | Depth | Nodes/position | Deadline/position |
| -------- | ----: | -------------: | ----------------: |
| Quick    |     5 |         10,000 |            300 ms |
| Balanced |     7 |         25,000 |            750 ms |
| Thorough |    10 |        100,000 |          2,000 ms |

Any budget may stop before the nominal depth. A rules-terminal position is known
without searching. Checkmate is a zero-distance terminal result, not an invented
mate-in-one. Mate transitions use ±30,000 cp grading sentinels; the chart clips
its visual range at ±5 pawns and is not a probability graph.

Grades are recomputed from before/after White-oriented scores for the actual
actor. Best means the first engine choice; other categories use explicit CPL
thresholds. No calibrated Elo, accuracy percentage, brilliant-move classifier,
or per-variation mate distance is manufactured.

## Distribution and upgrade discipline

Run strict checks and actual-browser tests against production output. Unit fault
simulation is separate from the actual portable/SIMD engine tests. See
`docs/verification.md` for executed coverage and limitations.

To update the engine: obtain verified upstream packages, update checksums and
revision metadata together, rediscover/validate control bounds, preserve notices,
and rerun both binaries plus browser recovery/cancellation tests. Do not edit
vendor files to make frontend tests pass. No frontend build compiles Rust.

Serve static production output with WASM MIME support and module workers. Relative
base URLs are used for UI assets/worker boot; choose Vite's base at build time for
a subdirectory deployment. No cross-origin isolation/SharedArrayBuffer requirement
is introduced. A CSP must allow own-origin module workers, WASM compilation, and
the board's inline style attributes; do not block the intended embedding context.

IndexedDB belongs to the browser origin. Multi-tab conflict resolution, remote
sync, offline PWA installation, and authentication are outside this release.
Preserve GPL-compatible corresponding source and all retained notices when hosting.
