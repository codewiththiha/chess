# Architecture

## Ownership

The app is a static Vite/Svelte client. There is no backend, external engine API,
account database, or remote game-upload path. The board is presentation and input;
it does not establish a second source of chess rules.

```text
UI components → Session → GameActions / SearchController / ReviewController
                       → PersistenceController → ChessDatabase → SQLite (wasm worker)
Rules, PGN, clocks, and grading ← pure domain functions
EngineClient → WorkerTransport → bridge-worker → verified Rust-built WASM
```

| Layer                                            | Responsibility                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `domain/chess.ts`, `chess960.ts`                 | Legal chessops positions/moves, SAN/UCI, repetition, material, all 960 starts             |
| `domain/games.ts`, `pgn.ts`                      | Game construction/outcomes and bounded legal mainline import/export                       |
| `domain/clocks.ts`                               | Monotonic elapsed time, continuous running clocks, settling, increments                   |
| `domain/time-controls.ts`, `identity.ts`         | Presets/classification and the start-date + move-sequence game identity                   |
| `domain/preferences.ts`, `review.ts`             | Exact resource validation, defaults, side-correct evaluation and heuristic grading        |
| `data/validation.ts`, `review-validation.ts`     | Decode unknown saved data before it can affect playable state or annotations              |
| `data/sql-handle.ts`, `sqlite-worker.ts`         | SQL schema, duplicate merging, one-review-per-game rows; OPFS worker with memory fallback |
| `data/sql-client.ts`, `database.ts`, `errors.ts` | Request identity, validated decode/encode, corrupt data versus storage I/O failure        |
| `engine/protocol.ts`, `types.ts`                 | Validate cross-worker discovery/report contracts                                          |
| `engine/transport.ts`                            | Worker lifecycle, Auto fallback, request identity, cancellation, timeout/error cleanup    |
| `engine/client.ts`                               | Serialize policy changes and translate settings to actual browser SDK commands            |
| `state/app.svelte.ts`                            | One reactive application state, derived positions, plain snapshot boundaries              |
| `controllers/game.ts`                            | Legal actions, turn/history transitions, clock expiry, one-record play/study switching    |
| `controllers/search.ts`                          | Generation-checked play/hint/analysis searches and clock-aware budgets                    |
| `controllers/review.ts`                          | Independent review worker, per-position evaluation, cache/resume                          |
| `controllers/persistence.ts`                     | Snapshot saves, restoration, import/archive operations, truthful storage errors           |
| `controllers/session.ts`                         | Lifecycle/action orchestration; not engine internals or a second rules implementation     |
| `components/`, `styles/`                         | Accessible input/rendering, staged dialogs, responsive tokens and layout                  |

Most authored components/modules stay below 250 lines. Separation is by
responsibility, not arbitrary line splitting. Styles, vendored code, and license
texts are not part of that component-size guideline.

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

Play, study, and review share **one** legal record, not independent board models.
Switching to Study keeps the same record identity; a move made from an earlier
cursor truncates that record's tail, exactly like a real branch. Opening a saved
game loads that record instead of copying it, so a game is never stored twice.
Identity is `startedAt` + start position + the exact UCI sequence, so a genuinely
identical replay merges into the surviving row (its review moves with it).
Deletion forgets the active record **before** deleting the row, preventing later
navigation/autosaves from resurrecting it.

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
A queued premove is validated when the engine hands the turn back: a legal queue is
committed at once, an impossible one is dropped with a notice, and neither path can
write an illegal move.
Timeout is a draw when the opponent has insufficient mating material.

A record also stores which bot it was started against (`bot_id`) and the nominal
Elo that bot played at, so the game keeps its opponent even if the bot is later
edited or deleted. A record stores who the opponent is: `bot` (the bundled engine) or `human`
(two players, where both colours are the reader's and no search is ever started).
Study is a view, not a pause: for a bot game the search makes the engine's game
move in either view whenever the latest position is on screen, and only steps back
to full-strength analysis when it is the reader's turn or the cursor is historical.
While a bot game is on screen the engine plays with that bot's policy and
nominal Elo (`policyForGame`), falling back to the Elo stored on the record when
the bot has been deleted; every analysis, hint, and review search still runs at
full strength. Clocks start when a timed game is ready and keep running while the app is open,
including while another view is on screen; there is no pause control and a
timeless game (0 minutes) is chosen before the first move. The database receives
snapshots with no live anchor. Completed actions save immediately; active clocks
also autosave every 10 seconds. Before-unload saving is best effort and never
writes the initial placeholder over unread saved preferences.

SQLite database `gwaymaegyi-chess.sqlite3` (OPFS shared-access-handle pool inside
the SQLite worker, `/gwaymaegyi-chess` directory):

The colour system has one home: the two daisyUI themes in `src/app.css` (which
name every base, primary, success, warning, and error colour) and the token
layer in `src/styles/theme.css`, where the board finishes, the square highlights,
the coordinate ink, the evaluation rail, the card and sheet shadows, and the
grade colours are declared per appearance. Grade colours are aliases for the
theme's own success, warning, and error tokens, so a mark, a grade dot, and a
dropdown agree by construction, and no sheet below those two files names a colour
of its own.

- `bots`: `id` PK, name, category, Elo, strength, style, description, picture
  data URI, behaviors/parameters, timestamps. Shipped bots are code, not rows, so
  only the reader's own bots are stored and a lost row can never remove them.
- `botchat.ts` (controller + `domain/chat.ts`): the opponent's voice. The
  controller folds every engine report into a verdict per ply (score plus the
  move the engine wanted), files the move that created the position, and judges
  it only once the engine has answered for that position — so a blunder is named
  with its real centipawn cost and its real replacement, and praise is reserved
  for the move the engine itself chose. Lines are pure functions of voice, event,
  ply, and the lines already used in this game, so the same position always
  produces the same remark and a remark is never repeated; a line that wants a
  fact the event does not have (the better move, the piece that fell, what it was
  worth) is skipped rather than guessed at, and a ply with nothing worth saying
  produces no line at all. A mistake is answered with a remark, and every second
  to fourth mistake — the cadence is the character's own `teaches` number, gentler
  means more often — is answered with the engine's own move in the position the
  reader was looking at. A capture of a rook or a queen gets its own joke, and the
  joke counts what the piece was worth. Two-player and study records are never
  claimed. A
  `SpeechController` may then say the line through the platform's own speech
  engine: the utterance plan is a pure function (text, character, available
  voices) so it can be tested without a speaking platform, it prefers a voice
  that matches the character, it never repeats the last line, and a platform that
  refuses to speak is ignored rather than allowed to break a game. A known voice
  name is enough to match the character's gender, but a general word such as
  "male" only counts on its own — otherwise "Samantha" would be picked to sound
  like a man. Speech is on by default, and the one switch lives in the rail as
  well as in Appearance, so a reader can silence the character without opening a
  dialog; the bubble never repeats the name of the opponent already named in the
  row above it.
- `coach.ts` (controller + `domain/coach.ts` + `domain/coachtalk.ts`): the review
  chat, spoken by the bot the game was played against. `open()` writes the
  walkthrough: a summary read off the stored counts, then up to five moments —
  the reader's worst mistakes and blunders, plus up to two moves the engine
  itself chose — each carrying the ply it is about, so tapping anywhere in the
  bubble jumps the board to that move. The conversation is the first block in the
  study card, above the controls, and it has no scrollbar of its own: the card
  scrolls, so the walkthrough is never buried under the review panel. `ask()`
  answers a typed or suggested question. Both build one
  `CoachPosition` from the live report when the analysis describes the position
  on screen and from the stored review point otherwise, and never mix the two.
  `domain/coachtalk.ts` turns a moment into a sentence: the verdict in the
  character's manner, the engine's score, then the evidence — the piece a move
  left loose and what attacks it, a pin it walked into, the material swing — and
  finally what the engine had instead, with the reason taken from the board it
  changes (the fork the better move makes, the discoverer it uncovers, the piece
  it keeps safe, the pin it breaks, the piece it develops, the castling it
  plays). No sentence is written for a position: every noun, square, and tactic
  comes from the board or the engine's own line, and a phrase that wants evidence
  the position does not hold is left out rather than guessed at. The measurements
  are never spoken as measurements: `gradeWords` names the grade in plain words,
  `scoreWords` turns the evaluation into a condition ("you are clearly worse
  here", "the game is still level"), and a loose piece is named with what wins it
  rather than with what it is worth — so a reader is never asked to weigh a
  centipawn, read a depth, or know what an engine is. The same vocabulary is used
  by the question answering in `domain/coach.ts`, and the unit and browser suites
  both assert that no remark contains `engine`, `centipawn`, `depth`, or `points`.
- `domain/tactics.ts`: the conditions behind those sentences, all read off a FEN —
  loose pieces with the cheapest attacker named as well as priced, so a sentence
  can say a pawn wins it or the king simply takes it; pins and skewers,
  forks, discovered attacks, pawn structure per pawn, king shelter and air, and
  material. Each is a pure function over the board, so a remark works for any
  position instead of any game.
- The board's verdict mark (`domain/feedback.ts`): the grade the piece that just
  moved earned — blue for the engine's own choice, amber for an inaccuracy, red
  for a mistake, orange-red for a blunder — drawn on the top-right corner of the
  square it landed on. Review uses the stored grade; play uses the controller's
  verdict for the last judged ply, so a mark never outlives the move it belongs
  to and none is drawn without a real grade. It is a board-aid preference and can
  be switched off.
- `games`: `id` PK, `dedupe` (identity), title/kind, `opponent`, `bot_id`, `created_at`/
  `updated_at`, start FEN, chess960, sides, result/termination, moves, clock,
  engine Elo, headers, `reviewed`
- `reviews`: `game_id` PK referencing one game, fingerprint, engine revision,
  depth, node budget, time limit, completeness, points
- `settings`: key/value rows (`preferences` holds a versioned value)

Indexes cover the dedupe key, recency, and bot Elo. Databases written before the
Elo, opponent, and bot columns existed are upgraded in place: `engine_level` is
renamed to `engine_elo`, `opponent` is added defaulting to `bot`, and `bot_id` is
added as null, so old records stay one record each and keep their review. Stored preferences that used a skill level are
decoded through the engine's published level-to-Elo presets. Duplicate play merges into the oldest
row, keeping a single review. Multi-game import is legally validated before
insertion. Zero-ply records are omitted from the listing, not treated as games.

Corrupt preferences fall back to defaults while the archive still loads. An
invalid active record is not installed. Corrupt reviews are rejected with a
fresh-review action. I/O failures get a storage banner; preferences that cannot
be stored are described as session-only, never toasted as successfully saved.

## Desktop shell

`src-tauri/` hosts the identical production bundle in a Tauri window. The shell
adds no storage, rules, or interface code: the embedded `dist/` runs the same
SQLite WASM database, the same engine packages, and the same one-record rules.
The only native surface is `desktop_info`, which answers with the shell name,
version, and storage wording so the Help dialog can describe its host; the browser
build never loads that module because the Tauri API is imported lazily behind a
host check.

Storage therefore stays origin-scoped (the webview's OPFS, or the reported
session-only fallback) rather than becoming a second, native-only database that
could drift from the browser semantics. Rust is compiled only by the `Desktop`
workflow, which builds the real frontend first and then lints and compiles the
shell with warnings denied; the ordinary web gates never require a Rust toolchain.

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
`docs/verification.md` for executed coverage and limitations. GitHub Actions
uses the same production artifact for isolated desktop/mobile jobs;
`docs/ci.md` documents full/default and explicit partial verification.

To update the engine: obtain verified upstream packages, update checksums and
revision metadata together, rediscover/validate control bounds, preserve notices,
and rerun both binaries plus browser recovery/cancellation tests. Do not edit
vendor files to make frontend tests pass. The website build never compiles Rust;
the desktop shell is compiled separately by its own workflow.

Serve static production output with WASM MIME support and module workers. Relative
base URLs are used for UI assets/worker boot; choose Vite's base at build time for
a subdirectory deployment. The shared-access-handle pool exists precisely so no
cross-origin isolation/SharedArrayBuffer headers are required. A CSP must allow own-origin module workers, WASM compilation, and
the board's inline style attributes; do not block the intended embedding context.

The SQLite database belongs to the browser origin (OPFS, or memory for the
session when persistence is unavailable). Multi-tab conflict resolution, remote
sync, offline PWA installation, and authentication are outside this release.
Preserve GPL-compatible corresponding source and all retained notices when hosting.
