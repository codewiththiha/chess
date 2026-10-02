<!-- Provide real game actions and historical navigation without crowding the board. -->
<script lang="ts">
  import {
    FlipVertical2,
    Undo2,
    Copy,
    Flag,
    Handshake,
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
  } from '@lucide/svelte';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
</script>

<div class="board-tools">
  <div class="board-utilities">
    <button
      class="tool-button"
      aria-label="Flip board"
      title="Flip board · F"
      onclick={() => session.flip()}><FlipVertical2 size={18} /></button
    >
    <button
      class="tool-button"
      aria-label="Copy FEN"
      title="Copy FEN"
      onclick={() => void session.copyFen()}><Copy size={17} /></button
    >
    <button
      class="tool-button"
      aria-label="Take back move"
      title="Take back move"
      disabled={!s.record.moves.length}
      onclick={() => session.game.takeback()}><Undo2 size={18} /></button
    >
    {#if s.view === 'play'}
      <details class="game-actions-menu">
        <summary
          class="tool-button"
          aria-label="Game actions"
          title="Game actions"><Flag size={17} /></summary
        >
        <div class="action-popover">
          <button
            disabled={s.record.result !== '*'}
            onclick={() =>
              session.confirm(
                'Resign this game?',
                'Your game is saved with the result.',
                'Resign',
                () =>
                  session.game.finish(
                    s.record.human === 'white' ? '0-1' : '1-0',
                    'Resignation',
                  ),
              )}><Flag size={15} />Resign game</button
          >
          <button
            disabled={!s.claims.length ||
              s.record.result !== '*' ||
              s.pos.turn !== s.record.human ||
              !s.latest}
            onclick={() => session.game.finish('1/2-1/2', s.claims.join(' · '))}
            ><Handshake size={15} />Claim draw {s.claims.length
              ? ''
              : '(none)'}</button
          >
        </div>
      </details>
    {/if}
  </div>
  <div class="history-controls" aria-label="Position navigation">
    <button
      class="tool-button"
      aria-label="First position"
      title="First position · Home"
      disabled={s.cursor === 0}
      onclick={() => session.game.jump(0)}><ChevronsLeft size={19} /></button
    >
    <button
      class="tool-button"
      aria-label="Previous move"
      title="Previous move · Left arrow"
      disabled={s.cursor === 0}
      onclick={() => session.game.jump(s.cursor - 1)}
      ><ChevronLeft size={19} /></button
    >
    <button
      class="tool-button"
      aria-label="Next move"
      title="Next move · Right arrow"
      disabled={s.latest}
      onclick={() => session.game.jump(s.cursor + 1)}
      ><ChevronRight size={19} /></button
    >
    <button
      class="tool-button"
      aria-label="Latest position"
      title="Latest position · End"
      disabled={s.latest}
      onclick={() => session.game.jump(s.record.moves.length)}
      ><ChevronsRight size={19} /></button
    >
  </div>
</div>
