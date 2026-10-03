<!-- Provide real game actions and historical navigation without crowding the board. -->
<script lang="ts">
  import { FlipVertical2, Undo2, Copy, Flag, Handshake } from '@lucide/svelte';
  import HistoryControls from './HistoryControls.svelte';
  import type { Session } from '../controllers/session';
  let { session, nav = true }: { session: Session; nav?: boolean } = $props();
  const s = $derived(session.state);
</script>

<div class="board-tools" class:utilities-only={!nav}>
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
  {#if nav}<HistoryControls {session} />{/if}
</div>
