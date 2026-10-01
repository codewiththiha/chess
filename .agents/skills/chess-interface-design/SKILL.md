---
name: chess-interface-design
description: Build and critique the board-first gwaymaegyi chess interface without generic generated-UI patterns.
---

# A considered chess interface

Use this skill for every interface change. These are project-specific design and
review constraints, not a promise that an interface's authorship can be detected.

## Direction

A small, contemporary chess club: cool porcelain, quiet forest tones, tactile
squares, readable notation, beautifully drawn pieces. The memorable object is a
real interactive board, not a hero illustration or a collection of cards.

The first design pass proposed cream, large serif headings, and warm accents.
Research identified that combination as another recurring generated-template
look. The revised direction uses cool fog and botanical green, compact app
hierarchy, and wood only as an optional board finish. A serif is reserved for
the wordmark and short page titles, not used as decorative emphasis everywhere.

## Tokens and composition

- Fog `#edf1ef`, paper `#ffffff`, ink `#23352f`, forest `#295e49`, muted
  `#66776f`, selection brass `#b79157`. Never use arbitrary accent colors.
- Newsreader for the wordmark and display titles; DM Sans for controls and prose;
  DM Mono only for clocks and genuinely numerical engine output. Self-host fonts.
- Board squares carry material/color. The surrounding page stays quiet. Avoid
  purple gradients, mesh blobs, glow, glass panels, stock illustrations, and emojis.
- Desktop: a generous board with a narrower notation/analysis column. Mobile:
  board first, player clocks kept visible, tools below, navigation thumb-accessible.
- Use distinct radii by purpose: a small board edge, comfortable buttons, restrained
  dialogs. Do not put every sentence or statistic into the same rounded card.
- Use sentence case, specific verbs, and plain errors. No slogan filler, tracked
  all-caps eyebrows, gratuitous arrows, fake opponent ratings, or fake activity.
- Borders separate content or states; they are not decoration. Numerals belong
  to move numbers, clocks, and real progress, not ornamental section numbering.

## Interaction standards

A drag follows the pointer; a committed move animates once; illegal drops restore
the position. Promotion asks for a real choice. Tap and keyboard are equivalent
ways to play. Display legal destinations, last move, check, and optional engine
arrows with distinct treatments. Engine thinking must not freeze navigation.

Animate consequences, not everything on arrival. Respect reduced motion and the
animation toggle. No bouncing clocks, automatic card reveals, or decorative
spinners unrelated to actual work. Loading/errors, save state, and review progress
come from real state. Keep control labels stable across buttons and notifications.

## Critique gate

Before delivery, examine desktop, tablet, and 390/320 px layouts. Ask:

1. Is the board the obvious primary task without a giant marketing header?
2. Are pieces, notation, clocks, focus, check, and selections readable?
3. Is every apparent control functional, and are destructive actions reversible
   or confirmed? Are import/storage/engine failures actionable?
4. Does the page still work with animations disabled and at keyboard-only input?
5. Can unnecessary decoration or repeated containers be removed?
6. Are review metrics explained honestly and local-only storage clearly labeled?
7. Does the same design survive real long notation, MultiPV, mobile dialogs,
   empty archives, and terminal games—not just a pristine starting screenshot?

Record concrete revisions and executed visual checks in docs/verification.md.

## Research

- Primary frontend-design guidance (reviewed 2026-10-01):
  https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Checkable anti-template rules and component-state guidance:
  https://www.stylekit.top/en/avoid-ai-slop
- Related pattern audit:
  https://mcpservers.org/agent-skills/anthropic/frontend-design

This skill is original project guidance distilled from the research. It does not
vendor another project's prompt or override repository security/code rules.
