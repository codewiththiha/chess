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
  /** The ply a remark is about, as the attribute the board follows. */
  function plyAttribute(ply: number | null | undefined): string | undefined {
    return ply ? String(ply) : undefined;
  }
  // A new answer is worth scrolling to; the walkthrough itself is read from the
  // top down, so the remark the reader is standing on is the one that follows
  // them: it is lit, and it is brought into view.
  $effect(() => {
    const ply = s.cursor;
    if (!log || !s.coach.length) return;
    const remark = log.querySelector<HTMLElement>(`[data-ply="${ply}"]`);
    if (remark) {
      remark.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (s.coach.at(-1)?.walk) return;
    log.lastElementChild?.scrollIntoView({ block: 'nearest' });
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
      {@const move = message.ply ? label(message.ply) : ''}
      <p
        class="coach-message"
        class:coach-you={message.role === 'you'}
        class:coach-answer={message.role !== 'you'}
        class:coach-moment={Boolean(message.ply)}
        class:coach-current={message.ply === s.cursor}
        data-ply={plyAttribute(message.ply)}
        aria-current={message.ply === s.cursor ? 'true' : undefined}
      >
        {#if message.ply}<span class="coach-chip" aria-hidden="true"
            >{move}</span
          >{/if}{message.text}{#if message.ply}<button
            type="button"
            class="coach-jump"
            aria-label={`Go to move ${move}`}
            title={`Go to move ${move}`}
            onclick={() => session.game.jump(message.ply ?? 0)}
          ></button>{/if}
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
