<!-- Synchronize Chessground with legal state and provide equivalent roving-keyboard play. -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { Config } from '@lichess-org/chessground/config';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import { chessgroundDests } from 'chessops/compat';
  import { CircleAlert, Sparkles, Check } from '@lucide/svelte';
  import { grades } from '../domain/review';
  import { feedbackFor } from '../domain/feedback';
  import { bulletClock } from '../domain/clocks';
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
  /**
   * Arrows belong to study. Playing a game shows no engine arrows unless the
   * reader explicitly asked for a hint. Review always draws the one stored move;
   * the analyze tab draws as many live suggestions as the arrow setting allows.
   */
  const arrowMoves = $derived.by(() => {
    if (!s.preferences.arrows) return [] as { uci: string; brush: string }[];
    const found: { uci: string; brush: string }[] = [];
    if (s.view !== 'study') {
      if (s.hint?.bestMove) found.push({ uci: s.hint.bestMove, brush: 'blue' });
      return found;
    }
    if (s.studyTab === 'review') {
      const reviewed = s.review?.points.find(
        (point) => point.ply === s.cursor,
      )?.bestMove;
      if (reviewed) found.push({ uci: reviewed, brush: 'green' });
      return found;
    }
    const limit = Math.max(1, Math.min(4, s.preferences.arrowCount));
    for (const line of s.report?.variations ?? []) {
      const uci = line.pv[0];
      if (uci && !found.some((arrow) => arrow.uci === uci))
        found.push({ uci, brush: 'blue' });
      if (found.length >= limit) break;
    }
    if (!found.length && s.hint?.bestMove)
      found.push({ uci: s.hint.bestMove, brush: 'blue' });
    return found;
  });
  /**
   * The verdict mark on the piece that just moved: the stored grade while
   * reviewing, and the engine's own verdict during a bot game. Nothing is drawn
   * without a real grade behind it.
   */
  const feedback = $derived.by(() => {
    if (!s.preferences.feedback) return null;
    const squareAt = (ply: number) =>
      ply > 0 ? (s.record.moves[ply - 1]?.to ?? null) : null;
    if (s.view === 'study' && s.studyTab === 'review') {
      const grade =
        grades(s.record, s.review?.points ?? []).find(
          (entry) => entry.ply === s.cursor,
        )?.grade ?? null;
      return feedbackFor(grade, squareAt(s.cursor));
    }
    const verdict = s.verdict;
    // The live mark belongs to the move on the board, never to an older one.
    if (!verdict || verdict.ply !== s.record.moves.length) return null;
    return feedbackFor(verdict.grade, squareAt(verdict.ply));
  });
  /** Where the mark sits, in the reader's own orientation. */
  const feedbackCell = $derived.by(() => {
    const mark = feedback;
    if (!mark) return null;
    const index = squares.indexOf(mark.square as SquareName);
    if (index < 0) return null;
    return { ...mark, column: index % 8, row: Math.floor(index / 8) };
  });
  /** Bullet runs on reflexes, so the board skips animation for those games. */
  const animated = $derived(
    s.preferences.animations && !reduced && !bulletClock(s.record.clock),
  );
  const premoveReady = $derived(
    s.preferences.premove &&
      s.view === 'play' &&
      s.record.opponent === 'bot' &&
      s.record.result === '*' &&
      s.latest &&
      !s.canMove,
  );
  const configuration = $derived.by((): Config => {
    const shapes: DrawShape[] = arrowMoves.flatMap(({ uci, brush }) => {
      const move = parseUci(uci);
      return move && isNormal(move)
        ? [
            {
              orig: makeSquare(move.from),
              dest: makeSquare(move.to),
              brush,
            },
          ]
        : [];
    });
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
      animation: { enabled: animated, duration: 180 },
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
      premovable: {
        enabled: premoveReady,
        showDests: s.preferences.legalMoves,
        customDests: chessgroundDests(s.pos, { chess960: s.record.chess960 }),
        events: {
          set: (orig, dest) => session.game.setPremove(orig, dest),
          unset: () => session.game.clearPremove(),
        },
      },
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
    // The queue is owned by the game controller; clear the drawn premove with it.
    if (!s.premove) api?.cancelPremove();
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
  {#if feedbackCell}
    <span
      class="move-badge"
      data-tone={feedbackCell.badge.tone}
      data-grade={feedbackCell.badge.grade}
      data-square={feedbackCell.square}
      style={`left: ${(feedbackCell.column + 1) * 12.5}%; top: ${feedbackCell.row * 12.5}%;`}
      title={feedbackCell.badge.label}
      aria-hidden="true"
    >
      {#if feedbackCell.badge.grade === 'best'}
        <Sparkles size={12} />
      {:else if feedbackCell.badge.grade === 'good'}
        <Check size={12} />
      {:else}
        <CircleAlert size={12} />
      {/if}
    </span>
  {/if}
</div>
<p id="board-keyboard-help" class="sr-only">
  Use arrow keys to focus a square. Enter or Space selects a piece, then its
  destination. Escape clears a selection.
</p>
<div class="sr-only" role="status" aria-live="polite">{announcement}</div>
