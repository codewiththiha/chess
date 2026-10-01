<!-- Explain live game state and offer only actions backed by real session data. -->
<script lang="ts">
  import {
    Plus,
    ShieldCheck,
    Cpu,
    ScanSearch,
    ChartNoAxesCombined,
    Lightbulb,
    ArrowRight,
  } from '@lucide/svelte';
  import { resultLabel } from '../domain/games';
  import { bestSan } from '../domain/chess';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
</script>

<section class="play-session-panel">
  <div class="session-mode">
    {@render SwordsMark()}<span>Play against the engine</span><span
      class="session-time"
      >{s.record.clock.initialMs
        ? `${s.record.clock.initialMs / 60000} + ${s.record.clock.incrementMs / 1000}`
        : 'Untimed'}</span
    >
  </div>
  <div class="game-state-box">
    {#if s.record.result !== '*'}
      <h2>{s.record.termination || 'Game complete'}</h2>
      <p>{resultLabel(s.record)} · {s.record.result}</p>
      <button class="text-action" onclick={() => session.navigate('review')}
        >Review this game<ArrowRight size={16} /></button
      >
    {:else if !s.latest}
      <h2>An earlier position.</h2>
      <p>
        You’re looking at move history. Return to the latest move to continue.
      </p>
      <button
        class="text-action"
        onclick={() => {
          session.game.jump(s.record.moves.length);
          session.game.resume();
        }}>Return to game<ArrowRight size={16} /></button
      >
    {:else if s.paused}
      <h2>A moment to think.</h2>
      <p>Your game and both clocks are paused.</p>
      <button class="text-action" onclick={() => session.game.resume()}
        >Resume game<ArrowRight size={16} /></button
      >
    {:else if s.thinking && s.pos.turn !== s.record.human}
      <h2>Considering the position.</h2>
      <p>gwaymaegyi is finding its next move.</p>
      <div class="thinking-status">
        <span class="status-dot"></span>{s.report
          ? `Depth ${s.report.depth} · ${s.report.nodes} nodes`
          : 'Starting the search'}
      </div>
    {:else}
      <h2>
        {s.pos.isCheck()
          ? 'Your king is in check.'
          : s.record.moves.length
            ? 'Back to you.'
            : 'White goes first.'}
      </h2>
      <p>
        {s.pos.isCheck()
          ? 'Move out of check, capture the checking piece, or block the attack.'
          : s.record.moves.length
            ? 'Take your time. The next move is yours.'
            : 'A fresh board. Pick a piece and make your first move.'}
      </p>
    {/if}
  </div>
  {#if s.hint?.bestMove}<div class="hint-message">
      <Lightbulb size={17} /><span
        >Try <strong>{bestSan(s.fen, s.hint.bestMove)}</strong>. The arrow shows
        the engine’s suggestion.</span
      >
    </div>{/if}
  <button
    class="btn btn-primary new-game-button"
    onclick={() => session.openDialog('new')}><Plus size={18} />New game</button
  >
  <div class="quiet-actions">
    <button onclick={() => session.navigate('analyze')}
      ><ScanSearch size={16} />Explore position</button
    ><button
      disabled={!s.record.moves.length}
      onclick={() => session.navigate('review')}
      ><ChartNoAxesCombined size={16} />Review game</button
    >
  </div>
  <div class="local-note">
    <ShieldCheck size={16} /><span
      >{s.storageError
        ? 'Storage needs attention'
        : s.saving
          ? 'Saving your game…'
          : s.saved
            ? 'Saved on this device'
            : 'Moves save automatically on this device'}</span
    >
  </div>
  <div class="engine-footnote">
    <Cpu size={13} /><span
      >{s.ready
        ? `gwaymaegyi ${s.discovery?.capabilities.version} · ${s.backend === 'simd128' ? 'SIMD128' : 'Portable'} WASM`
        : s.engineError
          ? 'Engine unavailable'
          : 'Loading local engine…'}</span
    >
  </div>
</section>
{#snippet SwordsMark()}<span class="mini-board-mark" aria-hidden="true"
  ></span>{/snippet}
