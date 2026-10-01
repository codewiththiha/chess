<!-- Synchronize Chessground with legal state and provide equivalent roving-keyboard play. -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { Config } from '@lichess-org/chessground/config';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import { chessgroundDests } from 'chessops/compat';
  import { makeSquare, parseSquare, parseUci } from 'chessops/util';
  import { isNormal } from 'chessops/types';
  import type { SquareName } from 'chessops/types';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let host: HTMLDivElement;
  let api = $state.raw<Api | null>(null);
  let reduced = $state(false);
  let focused = $state<SquareName>('e2');
  let selected = $state<SquareName | null>(null);
  let announcement = $state('');
  const squares = $derived(
    Array.from({ length: 64 }, (_, i) =>
      makeSquare(
        s.orientation === 'white'
          ? (7 - Math.floor(i / 8)) * 8 + (i % 8)
          : Math.floor(i / 8) * 8 + 7 - (i % 8),
      ),
    ),
  );
  const rows = $derived(
    Array.from({ length: 8 }, (_, r) => squares.slice(r * 8, r * 8 + 8)),
  );
  const suggested = $derived(
    s.view === 'review'
      ? s.review?.points.find((p) => p.ply === s.cursor)?.bestMove
      : s.view === 'analyze'
        ? s.report?.bestMove
        : s.hint?.bestMove,
  );
  const configuration = $derived.by((): Config => {
    const move = suggested ? parseUci(suggested) : undefined;
    const shapes: DrawShape[] =
      s.preferences.arrows && move && isNormal(move)
        ? [
            {
              orig: makeSquare(move.from),
              dest: makeSquare(move.to),
              brush: 'green',
            },
          ]
        : [];
    return {
      fen: s.fen,
      orientation: s.orientation,
      turnColor: s.pos.turn,
      check: s.preferences.check && s.pos.isCheck(),
      lastMove: s.lastMove
        ? [s.lastMove.from, s.lastMove.to].map((v) =>
            makeSquare(parseSquare(v) ?? 0),
          )
        : [],
      coordinates: s.preferences.coordinates,
      // Chessground only installs input listeners at construction; keep them bound.
      viewOnly: false,
      disableContextMenu: true,
      animation: {
        enabled: s.preferences.animations && !reduced,
        duration: 180,
      },
      highlight: {
        lastMove: s.preferences.lastMove,
        check: s.preferences.check,
      },
      movable: {
        free: false,
        color: s.canMove ? s.pos.turn : undefined,
        dests: chessgroundDests(s.pos, { chess960: s.record.chess960 }),
        showDests: s.preferences.legalMoves,
        rookCastle: true,
        events: { after: (from, to) => session.game.attempt(from, to) },
      },
      draggable: { enabled: s.canMove, showGhost: true },
      selectable: { enabled: s.canMove },
      premovable: { enabled: false },
      drawable: { enabled: true, visible: true, autoShapes: shapes },
      blockTouchScroll: true,
    };
  });
  $effect(() => {
    const config = configuration;
    if (api) {
      const coordinatesChanged = api.state.coordinates !== config.coordinates;
      api.set(config);
      // Coordinates are built by Chessground's DOM rebuild, not its piece redraw.
      if (coordinatesChanged) api.redrawAll();
    }
  });
  $effect(() => {
    s.fen;
    selected = null;
  });
  $effect(() => {
    s.orientation;
    if (document.activeElement?.closest('.keyboard-grid'))
      void tick().then(() =>
        document.getElementById(`square-${focused}`)?.focus(),
      );
  });
  onMount(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    reduced = media.matches;
    const change = () => {
      reduced = media.matches;
    };
    media.addEventListener('change', change);
    api = Chessground(host, configuration);
    return () => {
      media.removeEventListener('change', change);
      api?.destroy();
    };
  });
  function label(key: SquareName): string {
    const p = s.pos.board.get(parseSquare(key));
    return `${key}${p ? `, ${p.color} ${p.role}` : ', empty'}`;
  }
  function activate(key: SquareName): void {
    if (!s.canMove) {
      announcement =
        'This position is read-only. Use analysis mode or resume your game.';
      return;
    }
    const dests = chessgroundDests(s.pos, { chess960: s.record.chess960 });
    if (selected && dests.get(selected)?.includes(key)) {
      const from = selected;
      selected = null;
      api?.selectSquare(null);
      session.game.attempt(from, key);
      announcement = `Move ${from} to ${key}.`;
      return;
    }
    const piece = s.pos.board.get(parseSquare(key));
    if (piece?.color === s.pos.turn) {
      selected = selected === key ? null : key;
      api?.selectSquare(selected);
      announcement = selected
        ? `Selected ${label(key)}. Legal destinations: ${(dests.get(key) ?? []).join(', ') || 'none'}.`
        : 'Selection cleared.';
    } else {
      selected = null;
      api?.selectSquare(null);
      announcement = 'Select a piece belonging to the side to move.';
    }
  }
  function keyboard(event: KeyboardEvent, key: SquareName): void {
    const index = squares.indexOf(key);
    let next = index;
    if (event.key === 'ArrowLeft')
      next = Math.max(Math.floor(index / 8) * 8, index - 1);
    else if (event.key === 'ArrowRight')
      next = Math.min(Math.floor(index / 8) * 8 + 7, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 8);
    else if (event.key === 'ArrowDown') next = Math.min(63, index + 8);
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      activate(key);
      return;
    } else if (event.key === 'Escape') {
      selected = null;
      api?.selectSquare(null);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    focused = squares[next] ?? key;
    document.getElementById(`square-${focused}`)?.focus();
  }
</script>

<div
  class="board-surface board-{s.preferences.board} pieces-{s.preferences
    .pieces}"
  class:read-only={!s.canMove}
  data-testid="chessboard"
>
  <div class="cg-wrap" bind:this={host} aria-hidden="true"></div>
  <div
    class="keyboard-grid"
    role="grid"
    aria-label="Chessboard"
    aria-describedby="board-keyboard-help"
    aria-rowcount="8"
    aria-colcount="8"
  >
    {#each rows as row, r}
      <div role="row" class="keyboard-rank">
        {#each row as key, c}
          <button
            type="button"
            id="square-{key}"
            role="gridcell"
            aria-rowindex={r + 1}
            aria-colindex={c + 1}
            aria-label={label(key)}
            aria-selected={selected === key}
            tabindex={focused === key ? 0 : -1}
            onfocus={() => {
              focused = key;
            }}
            onkeydown={(e) => keyboard(e, key)}
            onclick={() => activate(key)}
          ></button>
        {/each}
      </div>
    {/each}
  </div>
</div>
<p id="board-keyboard-help" class="sr-only">
  Use arrow keys to focus a square. Enter or Space selects a piece, then its
  destination. Escape clears a selection.
</p>
<div class="sr-only" role="status" aria-live="polite">{announcement}</div>
