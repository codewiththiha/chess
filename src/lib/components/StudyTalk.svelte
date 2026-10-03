<!-- Keep the review's own line beside the board while a game is studied. -->
<script lang="ts">
  import type { Session } from '../controllers/session';
  import type { CoachMessage } from '../domain/coach';
  import type { Color } from '../domain/types';
  let { session, color }: { session: Session; color: Color } = $props();
  const s = $derived(session.state);
  // The remark sits under the row above the board, where the opponent talks
  // during a game — the same place, for the same reason: it is about the board.
  const top = $derived(color !== s.orientation);
  const studying = $derived(top && s.view !== 'play');
  const remark = $derived(studying ? s.remark : null);
  /** Number the ply the way notation does, so two plies never share a label. */
  function moveLabel(message: CoachMessage): string {
    return `Go to move ${Math.ceil((message.ply ?? 0) / 2)}`;
  }
  function read(message: CoachMessage): void {
    if (message.ply) session.game.jump(message.ply);
  }
</script>

{#if studying}
  <!-- An empty strip keeps its height: the board is measured once, so a remark
       arriving must not resize anything. -->
  <div class="study-talk" class:idle={!remark}>
    {#if remark}
      <p
        class="study-remark"
        data-ply={remark.ply ?? undefined}
        aria-live="polite"
      >
        {#if remark.ply}<button
            type="button"
            class="remark-jump"
            aria-label={moveLabel(remark)}
            title="Go to this move"
            onclick={() => read(remark)}
          ></button>{/if}{remark.text}
      </p>
    {/if}
  </div>
{/if}
