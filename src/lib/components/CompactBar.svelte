<!-- The phone's board chrome: the state of the game, the ply control, one menu button. -->
<script lang="ts">
  import { Menu } from '@lucide/svelte';
  import GameStatus from './GameStatus.svelte';
  import HistoryControls from './HistoryControls.svelte';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  // The remark about the ply on the board is the sentence the reader is on, so
  // it is the one the strip carries; the rest of the conversation is a tap away.
  const remark = $derived(
    s.coach.find((message) => message.ply === s.cursor) ??
      (s.cursor === 0
        ? s.coach.find((message) => message.walk && !message.ply)
        : undefined),
  );
  function openSheet(): void {
    s.sheet = 'panel';
  }
</script>

<div class="compact-bar">
  <div class="compact-state">
    {#if s.notice && !s.notice.error}
      <!-- A message about the game belongs where the game's state is, not in a
           layer over the controls. -->
      <p class="compact-notice" role="status">{s.notice.text}</p>
    {:else if s.view === 'play'}
      <GameStatus {session} />
    {:else}
      <!-- In study the strip carries the sentence about the move on the board,
           or an invitation when the review has nothing to say about it. Either
           way a tap brings up the study card. -->
      <button
        class="compact-remark"
        class:quiet={!remark}
        aria-haspopup="dialog"
        title={remark ? 'Open the walkthrough' : 'Open the study card'}
        onclick={openSheet}
        >{remark?.text ??
          (s.review
            ? 'Step through the game to read each remark.'
            : 'Open the study card to analyze or review this game.')}</button
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
