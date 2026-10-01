# Contributor guide

Read README.md, docs/architecture.md, docs/plan.md, and the design skill at
`.agents/skills/chess-interface-design/SKILL.md` before changing the interface.

## Boundaries

- Use current stable Svelte, TypeScript, Vite, Tailwind CSS, and daisyUI. Keep
  exact dependency versions and a committed npm lockfile. Read compatibility
  notes before upgrades; do not bypass peer conflicts with force flags.
- Keep rules/PGN, engine transport, persistence, clocks, review, and presentation
  separate. Components render state; they must not own a second rules engine.
- Use Svelte 5 runes and strict typed contracts. No `any`, unchecked assertions,
  suppressed accessibility warnings, placeholder handlers, or fake engine data.
- Prefer modules/components below 250 lines. Split by responsibility, not by
  arbitrary line count. Vendored code, styles, licenses, and generated files
  are exempt. Do not edit verified vendored engine files.
- Start authored code with a brief responsibility summary. JSON and binary
  formats are exempt. Comments explain invariants and non-obvious decisions.
- Treat imported PGN/FEN and saved records as untrusted. Validate legal moves,
  sizes, numbers, and schema before committing replacement state.
- Use relative asset/worker URLs; no third-party runtime CDN dependencies.
  Keep IndexedDB local-first and expose failures rather than pretending to save.
- Worker job identities must suppress stale replies. Changing position or policy
  cancels incompatible work. Ordinary reporting must not restart a search.
- Preserve engine, artwork, font, and library licenses and provenance. Source
  distribution must remain compatible with GPL-3.0-or-later.

## Interface

- The board is the primary interaction. No decorative dashboard metrics or
  generic marketing sections. Apply the project skill's tokens and critique gates.
- Support drag, tap, and keyboard play. All controls need meaningful labels,
  visible focus, disabled/error/loading states, and comfortable touch targets.
- Respect reduced motion and the user's animation preference. Sound is opt-in.
  Themes and piece choices must preserve contrast and legibility.
- Never claim calibrated Elo, Chess.com accuracy, a probability of winning, or
  a server backup. Review classifications are transparent engine heuristics.
- Derive adjustable behavior/parameter controls from the bundled engine's
  discovery metadata. Distinguish WASM capabilities from native-only features.

## Verification

Run `npm run verify:all` for functional or workflow changes. See docs/ci.md for
selective diagnostic runs; a partial run must not be reported as full verification. Review desktop
and mobile screenshots, console errors, keyboard paths, promotion, engine
cancellation, storage restoration, and production asset loading. Record evidence
in docs/verification.md; never claim a check that was not executed.

## Commits

Use Conventional Commits: `<type>(optional-scope): imperative description`.
Use lowercase descriptions, no trailing period, maximum 72 characters, preferably 50. Separate an optional wrapped body with exactly one blank line. Describe the
change, not who or what generated it. Check the staged diff and validate the
actual commit with `python3 scripts/check_commit.py`. Do not add credentials,
personal configuration, generated output, or dependency directories.
