<!-- Summarize real review progress, transparent move grades, and better alternatives. -->
<script lang="ts">
  import {
    ChartNoAxesCombined,
    Play,
    Square,
    Upload,
    ArrowRight,
    Sparkles,
  } from '@lucide/svelte';
  import { grades } from '../domain/review';
  import { REVIEW_PRESETS } from '../controllers/review';
  import type { Session } from '../controllers/session';
  import EvaluationChart from './review/EvaluationChart.svelte';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let preset = $state<keyof typeof REVIEW_PRESETS>('balanced');
  const annotations = $derived(grades(s.record, s.review?.points ?? []));
  const selected = $derived(annotations.find((g) => g.ply === s.cursor));
  const turning = $derived(
    annotations
      .filter((g) => g.loss >= 100)
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 3),
  );
  const progress = $derived(
    Math.round(
      ((s.review?.points.length ?? 0) / (s.record.moves.length + 1)) * 100,
    ),
  );
  const average = $derived(
    annotations.length
      ? Math.round(
          annotations.reduce((n, g) => n + g.loss, 0) / annotations.length,
        )
      : null,
  );
  const budget = $derived(REVIEW_PRESETS[preset]);
</script>

<section class="review-section" aria-label="Game review">
  <div class="section-heading">
    <h2><ChartNoAxesCombined size={18} />Game review</h2>
    <span class="subtle-tag">Local engine</span>
  </div>
  {#if !s.record.moves.length}
    <div class="review-empty">
      <h3>Give your game a second look.</h3>
      <p>
        Import a PGN or play a few moves. gwaymaegyi will check every position
        and suggest alternatives.
      </p>
      <button
        class="btn btn-primary"
        onclick={() => session.openDialog('import')}
        ><Upload size={16} />Import a game</button
      ><button class="text-action" onclick={() => session.example()}
        >Explore a tactical example<ArrowRight size={16} /></button
      >
    </div>
  {:else}
    <div class="review-controls">
      <label class="sr-only" for="review-depth">Review search budget</label
      ><select
        id="review-depth"
        class="select"
        bind:value={preset}
        disabled={s.reviewRunning}
        ><option value="quick">Quick · depth 5</option><option value="balanced"
          >Balanced · depth 7</option
        ><option value="thorough">Thorough · depth 10</option></select
      >
      {#if s.reviewRunning}<button
          class="btn btn-outline"
          onclick={() => session.review.cancel()}
          ><Square size={14} />Stop</button
        >{:else}<button
          class="btn btn-primary"
          disabled={!s.ready}
          onclick={() => void session.review.run(preset)}
          ><Play size={14} />{s.review && !s.review.complete
            ? 'Resume'
            : 'Review'}</button
        >{/if}
    </div>
    <p class="fine-print review-budget">
      Next review: up to {budget.timeMs} ms and {Number(
        budget.nodes,
      ).toLocaleString()} nodes per position.
    </p>
    {#if s.review}
      <div class="review-progress">
        <span
          >{s.reviewRunning
            ? 'Checking positions'
            : s.review.complete
              ? 'Review complete'
              : 'Review paused'}</span
        ><span>{s.review.points.length} / {s.record.moves.length + 1}</span>
      </div>
      <progress
        class="progress progress-primary"
        value={progress}
        max="100"
        aria-label="Review progress"
      ></progress>
      <EvaluationChart {session} />
      <p class="fine-print">
        Recorded budget: depth {s.review.depth} · {Number(
          s.review.nodeBudget,
        ).toLocaleString()} nodes · {s.review.timeMs} ms per position.
      </p>
      <div class="review-statistics">
        <div>
          <span>Moves checked</span><strong
            >{annotations.length}<small>
              / {s.record.moves.length}</small
            ></strong
          >
        </div>
        <div>
          <span>Average loss</span><strong
            >{average ?? '—'}<small> cp</small></strong
          >
        </div>
      </div>
      {#if selected}
        <div class="move-insight grade-{selected.grade}">
          <span class="insight-label"
            >{s.record.moves[s.cursor - 1]?.san} ·
            <strong
              >{selected.grade.charAt(0).toUpperCase() +
                selected.grade.slice(1)}</strong
            ></span
          >
          <p>{selected.loss} centipawn loss at this search budget.</p>
          {#if selected.bestSan && selected.grade !== 'best'}<button
              class="text-action"
              onclick={() => session.game.jump(selected.ply - 1)}
              >See {selected.bestSan} instead<ArrowRight size={15} /></button
            >{/if}
        </div>
      {:else}<p class="review-invitation">
          Select a checked move to see its evaluation and an alternative.
        </p>{/if}
      {#if turning.length}<div class="turning-points">
          <h3>Turning points</h3>
          {#each turning as move}<button
              onclick={() => session.game.jump(move.ply)}
              ><span class="grade-dot grade-{move.grade}"></span><span
                >{Math.ceil(move.ply / 2)}{s.record.moves[move.ply - 1]
                  ?.color === 'black'
                  ? '…'
                  : '.'}
                {s.record.moves[move.ply - 1]?.san}</span
              ><span class="muted">−{move.loss} cp</span><ArrowRight
                size={14}
              /></button
            >{/each}
        </div>{/if}
      <p class="fine-print">
        Best = engine’s first choice. Good &lt;50 cp loss; inaccuracy 50–99;
        mistake 100–199; blunder ≥200. Mate transitions use ±30,000 cp
        sentinels. These are depth-dependent heuristics, not a calibrated
        accuracy rating.
      </p>
    {:else}<div class="review-start">
        <Sparkles size={23} />
        <h3>Find the moves worth revisiting.</h3>
        <p>
          Review evaluates the position before and after each move, including
          both sides.
        </p>
      </div>{/if}
    {#if s.reviewError}<p class="inline-error" role="alert">
        {s.reviewError}
      </p>{/if}
  {/if}
</section>
