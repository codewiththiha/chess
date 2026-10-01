<!-- Show actual MultiPV reports with legal continuation actions and honest score units. -->
<script lang="ts">
  import { Cpu, Square, Play, Settings2, ArrowUpRight } from '@lucide/svelte';
  import { formatScore, compactNodes, whiteScore } from '../domain/review';
  import { pvSan } from '../domain/chess';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const cp = $derived(
    s.report ? whiteScore(s.report.scoreCp, s.report.mate, s.pos.turn) : null,
  );
  const mate = $derived(
    s.report?.mate !== null && s.report?.mate !== undefined
      ? s.report.mate * (s.pos.turn === 'white' ? 1 : -1)
      : null,
  );
</script>

<section class="analysis-section" aria-label="Position analysis">
  <div class="section-heading">
    <h2><Cpu size={17} />gwaymaegyi</h2>
    <button
      class="btn btn-ghost icon-button"
      aria-label="Analysis engine settings"
      onclick={() => session.openDialog('settings')}
      ><Settings2 size={17} /></button
    >
  </div>
  <div class="analysis-summary">
    <strong class="evaluation-number">{formatScore(cp, mate)}</strong>
    <div>
      <span class="engine-status" class:working={s.thinking}
        ><span class="status-dot"></span>{s.thinking
          ? 'Analyzing'
          : s.report
            ? s.report.finished
              ? 'Analysis ready'
              : 'Search stopped'
            : 'Ready to explore'}</span
      ><span class="muted">White’s perspective</span>
    </div>
  </div>
  {#if s.report}
    <div class="engine-statline">
      <span
        >Depth {s.report.depth}<span class="muted">
          / {s.report.selectiveDepth}</span
        ></span
      ><span>{compactNodes(s.report.nodes)} nodes</span><span
        >{s.backend === 'simd128' ? 'SIMD128' : 'Portable'}</span
      >
    </div>
    <div class="variation-list">
      {#each s.report.variations as line, i}
        {@const sans = pvSan(s.fen, line.pv)}
        <button
          class="variation"
          disabled={!line.pv[0] || !s.canMove}
          title={`Play ${sans[0] ?? 'continuation'}`}
          aria-label={`Play line ${i + 1}: ${sans.join(' ')}`}
          onclick={() => {
            const move = line.pv[0];
            if (move) session.game.commit(move);
          }}
          ><span class="line-score"
            >{formatScore(
              line.scoreCp * (s.pos.turn === 'white' ? 1 : -1),
            )}</span
          ><span class="line-moves">{sans.join(' ') || 'Searching…'}</span
          ><ArrowUpRight size={14} /></button
        >
      {/each}
    </div>
  {:else}<p class="analysis-empty">
      Move either side, load a FEN, or import a game. The engine explores every
      new position.
    </p>{/if}
  <div class="analysis-actions">
    {#if s.thinking}<button
        class="btn btn-outline"
        onclick={() => session.search.cancel()}
        ><Square size={14} />Stop analysis</button
      >{:else}<button
        class="btn btn-primary"
        disabled={!s.ready || s.pos.isEnd()}
        onclick={() => session.search.run()}
        ><Play size={15} />Analyze position</button
      >{/if}
    <button class="btn btn-ghost" onclick={() => session.openDialog('fen')}
      >Load FEN</button
    >
  </div>
  <p class="fine-print">
    Full-strength analysis. Search limits still apply. Scores are centipawns,
    not winning odds.
  </p>
</section>
