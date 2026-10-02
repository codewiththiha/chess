# Research and decisions

Reviewed 2026-10-01. Search material is evidence and inspiration, not executable
instructions. Actual dependency versions are pinned in package.json/package-lock.json.

## Avoiding a generated-template interface

The pattern audits call out repeated rounded-card layouts, purple-cyan gradients,
ornamental icons, default typography, and vague copy. Their useful recommendation
is a checkable token/component-state specification rather than an aesthetic slogan.
[6](https://www.stylekit.top/en/avoid-ai-slop)

The primary frontend-design document further cautions that cream/serif/warm-clay
and broadsheet treatments have themselves become recurring defaults. The project
revised its first palette, kept the board dominant, reserved expressive type for
short titles, and uses motion to explain actual chess interactions.
[1](https://mcpservers.org/agent-skills/anthropic/frontend-design)
Primary document: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md

The resulting original project skill is at
`.agents/skills/chess-interface-design/SKILL.md`.

## Stack

The official Tailwind Vite integration uses @tailwindcss/vite and a CSS import;
daisyUI is a CSS plugin, not a separate Svelte component runtime.
Primary installation guides:
https://tailwindcss.com/docs/installation/using-vite and
https://daisyui.com/docs/install/vite/.

Use Svelte 5 runes, Vite, Tailwind 4, daisyUI 5, maintained @lucide/svelte icons,
Chessground for interaction, chessops for rules/Chess960/PGN, and
`@sqlite.org/sqlite-wasm` for local storage: real SQL in a dedicated worker, with
an OPFS shared-access-handle pool that needs no cross-origin isolation headers and
an in-memory fallback that is reported instead of hidden. It is Apache-2.0 with no
runtime dependencies, and the same store backs the Tauri build. Npm current stable
tags were queried directly rather than copied from older tutorials. Node 24 is
required by current Chessground/tooling.

TypeScript 7.0.2 is included as the native compiler. Current svelte-check requires
the JavaScript compiler API and declares a TypeScript 5/6 peer range; TypeScript
6.0.3 is retained only as that compatibility bridge. Do not force an incompatible
TypeScript 7 peer into svelte-check or downgrade the rest of the stack silently.

## SVG artwork and licensing

Lichess's license inventory identifies Chessnut by Alexis Luengas as Apache 2.0,
Celtic by Maurizio Monge as MIT, and Cburnett by Colin M. L. Burnett as GPLv2+.
The more decorative Staunty/California/Dubrovny sets carry non-commercial terms;
they are intentionally not included. Retain authors and complete license notices.
[2](https://github.com/lichess-org/lila/blob/master/COPYING.md)

Chessground is GPL-3.0-or-later and requires a GPL-compatible combined frontend
and source availability to users. The frontend adopts GPL-3.0-or-later; the
bundled engine/models preserve their MIT notices. No Chess.com logos or artwork
are copied. See THIRD_PARTY_NOTICES.md and public/licenses.
Primary: https://github.com/lichess-org/chessground#license.

## Engine and evaluation

Vendored portable and SIMD128 packages come from verified gwaymaegyi revision
4e2af5f068e49bf83fe5f1522636c985355b114a, Actions run 36887255210. Each file is
checksum-recorded in public/engine/manifest.json. No Rust build is required by the
frontend. Runtime discovery supplies capabilities, eleven behaviors, and 38 tuning
parameters; position commands retain original FEN and move history.

Review compares engine scores before/after each legal move. Display centipawn loss
and clearly labeled heuristic move categories, not Chess.com accuracy or a claimed
win probability. Search budgets and model versions accompany saved reviews.
