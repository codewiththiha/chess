<!-- Show the newest thing the opponent said, next to the opponent's own row. -->
<script lang="ts">
  import type { Session } from '../controllers/session';
  import type { Color } from '../domain/types';
  let { session, color }: { session: Session; color: Color } = $props();
  const s = $derived(session.state);
  // Only the talking side has a bubble, and only while a character is on the board.
  const mine = $derived(
    s.record.opponent === 'bot' && color !== s.record.human,
  );
  const line = $derived(mine ? (s.botChat.at(-1) ?? null) : null);
</script>

{#if mine}
  <!-- The strip keeps its place between lines: on a phone the board is sized
       once, so a bubble arriving must not resize anything. -->
  <div class="bot-talk" class:idle={!line} aria-live="polite">
    {#if line}
      <p class="bot-bubble" data-ply={line.ply} title={line.name}>
        {line.text}
      </p>
    {/if}
  </div>
{/if}
