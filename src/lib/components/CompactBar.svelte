<!-- The phone's board chrome: the state of the game, the ply control, quick actions. -->
<script lang="ts">
  import { Flag, Menu } from '@lucide/svelte';
  import GameStatus from './GameStatus.svelte';
  import HistoryControls from './HistoryControls.svelte';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  function openSheet(): void {
    s.sheet = 'panel';
  }
  /** Resigning is a real result in the record, so it asks before it happens. */
  function resign(): void {
    session.confirm(
      'Resign this game?',
      'Your game is saved with the result.',
      'Resign',
      () =>
        session.game.finish(
          s.record.human === 'white' ? '0-1' : '1-0',
          'Resignation',
        ),
    );
  }
</script>

<div class="compact-bar">
  <div class="compact-state">
    {#if s.notice && !s.notice.error}
      <!-- A message about the game belongs where the game's state is, not in a
           layer over the controls. -->
      <p class="notice-line" role="status">{s.notice.text}</p>
    {:else}
      <!-- The strip states the game in both views; what the review has to say
           about the board sits beside the board, under the row above it. -->
      <GameStatus {session} />
    {/if}
    {#if s.view === 'play'}
      <!-- Resigning is the one game action a reader may need in a hurry, so it
           is not behind the sheet: one confirmed tap ends the game. -->
      <button
        class="tool-button resign-button"
        aria-label="Resign this game"
        title="Resign"
        data-quick-resign
        disabled={s.record.result !== '*'}
        onclick={resign}><Flag size={18} /></button
      >
    {/if}
  </div>
  <div class="compact-actions">
    <HistoryControls {session} showCount />
    <button
      class="tool-button sheet-toggle"
      data-sheet-toggle="panel"
      aria-haspopup="dialog"
      aria-expanded={s.sheet === 'panel'}
      aria-label={s.view === 'play'
        ? 'Move data and controls'
        : 'Study and moves'}
      title="Move data"
      onclick={openSheet}><Menu size={20} /></button
    >
  </div>
</div>
