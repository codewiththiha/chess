<!-- Let the coach talk the reader through the game, and answer questions about it. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { CornerDownLeft } from '@lucide/svelte';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let draft = $state('');
  let log: HTMLDivElement;
  const topics = $derived(session.coach.topics());
  onMount(() => session.coach.open());
  // A finished review changes what the coach can talk about, so reopen then.
  $effect(() => {
    s.review?.points.length;
    session.coach.open();
  });
  function ask(text: string): void {
    session.coach.ask(text);
    draft = '';
  }
  /** Number the ply the way notation does, so two plies never share a label. */
  function label(ply: number): string {
    const move = s.record.moves[ply - 1];
    return `${Math.ceil(ply / 2)}${move?.color === 'black' ? '…' : '.'}`;
  }
  // Keep the newest answer in view without moving focus away from the input.
  $effect(() => {
    if (s.coach.length && log) log.scrollTop = log.scrollHeight;
  });
</script>

<div class="coach">
  <div
    class="coach-log"
    bind:this={log}
    role="log"
    aria-label="Review chat"
    aria-live="polite"
  >
    {#each s.coach as message (message.id)}
      <p
        class="coach-message"
        class:coach-you={message.role === 'you'}
        class:coach-answer={message.role !== 'you'}
      >
        {#if message.ply}
          <button
            type="button"
            class="coach-jump"
            aria-label={`Go to move ${label(message.ply)}`}
            onclick={() => session.game.jump(message.ply ?? 0)}
            >{label(message.ply)}</button
          >
        {/if}{message.text}
      </p>
    {/each}
  </div>
  <div class="coach-topics">
    {#each topics as topic}
      <button type="button" class="topic-chip" onclick={() => ask(topic)}
        >{topic}</button
      >
    {/each}
  </div>
  <form
    class="coach-ask"
    onsubmit={(event) => {
      event.preventDefault();
      ask(draft);
    }}
  >
    <label class="sr-only" for="coach-question">Ask about this position</label
    ><input
      id="coach-question"
      bind:value={draft}
      placeholder="Ask about this position"
      autocomplete="off"
    /><button
      type="submit"
      class="btn btn-primary"
      disabled={!draft.trim()}
      aria-label="Send question"><CornerDownLeft size={15} /></button
    >
  </form>
</div>
