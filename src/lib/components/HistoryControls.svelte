<!-- Walk the recorded game: first, back, forward, latest, with the ply count. -->
<script lang="ts">
  import {
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
  } from '@lucide/svelte';
  import type { Session } from '../controllers/session';
  let {
    session,
    showCount = false,
  }: { session: Session; showCount?: boolean } = $props();
  const s = $derived(session.state);
</script>

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
  {#if showCount}
    <span
      class="ply-counter"
      aria-live="off"
      aria-label={`Showing ply ${s.cursor} of ${s.record.moves.length}`}
      >{s.cursor}<span class="ply-of">/{s.record.moves.length}</span></span
    >
  {/if}
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
