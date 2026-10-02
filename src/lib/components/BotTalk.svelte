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

{#if line}
  <div class="bot-talk" aria-live="polite">
    <p class="bot-bubble" data-ply={line.ply} title={line.name}>
      {line.text}
    </p>
  </div>
{/if}
