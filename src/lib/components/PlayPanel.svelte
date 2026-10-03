<!-- Summarize live game state and expose only actions backed by real session data. -->
<script lang="ts">
  import {
    ScanSearch,
    Lightbulb,
    Plus,
    ChevronDown,
    Clock,
  } from '@lucide/svelte';
  import GameStatus from './GameStatus.svelte';
  import { describeTime } from '../domain/time-controls';
  import { bestSan } from '../domain/chess';
  import type { Session } from '../controllers/session';
  import type { Color } from '../domain/types';
  let {
    session,
    /** The compact strip already shows the state, so the sheet leaves it out. */
    status = true,
  }: { session: Session; status?: boolean } = $props();
  const s = $derived(session.state);
  let editing = $state(false);
  let minutes = $state(10);
  let increment = $state(0);
  function openEditor(): void {
    minutes = Math.round(s.record.clock.initialMs / 60000);
    increment = Math.round(s.record.clock.incrementMs / 1000);
    editing = !editing;
  }
  function apply(): void {
    try {
      session.setTimeControl(Number(minutes) || 0, Number(increment) || 0);
      editing = false;
    } catch (error) {
      session.notify(String(error), true);
    }
  }
  function tune(color: Color, seconds: number): void {
    session.addTime(color, seconds);
  }
</script>

<section class="play-card" aria-label="Game controls">
  {#if status}<GameStatus {session} />{/if}
  {#if s.hint?.bestMove}
    <p class="hint-line">
      <Lightbulb size={15} />Try
      <strong>{bestSan(s.fen, s.hint.bestMove)}</strong>
    </p>
  {/if}
  <div class="clock-row">
    <button class="clock-summary" aria-expanded={editing} onclick={openEditor}
      ><Clock size={15} />{s.timed
        ? describeTime(
            s.record.clock.initialMs / 60000,
            s.record.clock.incrementMs / 1000,
          )
        : 'No clock'}<ChevronDown size={14} /></button
    >
    <button class="small-button" onclick={() => tune('white', 60)}
      >+1m White</button
    >
    <button class="small-button" onclick={() => tune('black', 60)}
      >+1m Black</button
    >
  </div>
  {#if editing}
    <div class="clock-editor">
      <label
        >Minutes<input
          type="number"
          min="0"
          max="180"
          aria-label="Clock minutes"
          bind:value={minutes}
        /></label
      >
      <label
        >Increment<input
          type="number"
          min="0"
          max="120"
          aria-label="Clock increment"
          bind:value={increment}
        /></label
      >
      <button class="btn btn-primary small-button" onclick={apply}>Apply</button
      >
      <span class="fine-print">Resets both clocks; 0 = untimed.</span>
    </div>
  {/if}
  <div class="play-actions">
    <button class="btn btn-outline" onclick={() => session.navigate('home')}
      ><Plus size={16} />New game</button
    >
    <button class="btn btn-ghost" onclick={() => session.openStudy('analyze')}
      ><ScanSearch size={16} />Study</button
    >
    <button
      class="btn btn-ghost"
      disabled={!s.canMove || (s.thinking && !s.hint)}
      onclick={() => {
        if (s.hint) s.hint = null;
        else session.search.run(true);
      }}><Lightbulb size={16} />{s.hint ? 'Hide hint' : 'Hint'}</button
    >
  </div>
</section>
