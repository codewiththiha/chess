<!-- Combine position analysis and stored review evidence in one study card. -->
<script lang="ts">
  import {
    Play,
    Square,
    ScanSearch,
    ChartNoAxesCombined,
    ArrowRight,
    ArrowUpRight,
    Upload,
  } from '@lucide/svelte';
  import {
    formatScore,
    compactNodes,
    whiteScore,
    grades,
  } from '../domain/review';
  import { pvSan } from '../domain/chess';
  import { REVIEW_PRESETS } from '../controllers/review';
  import EvaluationChart from './review/EvaluationChart.svelte';
  import Coach from './Coach.svelte';
  import Accuracy from './Accuracy.svelte';
  import type { Session } from '../controllers/session';
  import type { StudyTab } from '../state/app.svelte';
  let {
    session,
    /** The side panel owns the message line; the phone's strip already shows it. */
    notice = true,
  }: { session: Session; notice?: boolean } = $props();
  const s = $derived(session.state);
  let preset = $state<keyof typeof REVIEW_PRESETS>('balanced');
  // A phone gives the graph a tap of its own rather than a wall of chart: it is
  // the one part of the review that reads as detail, so it is asked for.
  let chart = $state(false);
  const tabs: { id: StudyTab; label: string; icon: typeof ScanSearch }[] = [
    { id: 'analyze', label: 'Analyze', icon: ScanSearch },
    { id: 'review', label: 'Review', icon: ChartNoAxesCombined },
  ];
  const cp = $derived(
    s.report ? whiteScore(s.report.scoreCp, s.report.mate, s.pos.turn) : null,
  );
  const mate = $derived(
    s.report?.mate !== null && s.report?.mate !== undefined
      ? s.report.mate * (s.pos.turn === 'white' ? 1 : -1)
      : null,
  );
  const annotations = $derived(grades(s.record, s.review?.points ?? []));
  const selected = $derived(annotations.find((g) => g.ply === s.cursor));
  const turning = $derived(
    annotations
      .filter((g) => g.loss >= 100)
      .toSorted((a, b) => b.loss - a.loss)
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
          annotations.reduce((total, g) => total + g.loss, 0) /
            annotations.length,
        )
      : null,
  );
  const budget = $derived(REVIEW_PRESETS[preset]);
</script>

<section class="study-card" aria-label="Study">
  {#if notice && s.notice && !s.notice.error}
    <p class="notice-line" role="status">{s.notice.text}</p>
  {/if}
  <div class="study-tabs" role="tablist" aria-label="Study mode">
    {#each tabs as tab}
      <button
        role="tab"
        aria-selected={s.studyTab === tab.id}
        class:active={s.studyTab === tab.id}
        onclick={() => {
          s.studyTab = tab.id;
          if (tab.id === 'review') void session.review.restore();
        }}><tab.icon size={15} />{tab.label}</button
      >
    {/each}
  </div>
  <!-- The walkthrough is the part a reader comes back for, so it sits first. -->
  <Coach {session} />
  {#if s.studyTab === 'analyze'}
    <div class="analysis-summary">
      <strong class="evaluation-number">{formatScore(cp, mate)}</strong>
      <div class="engine-line">
        <span class="engine-status" class:working={s.thinking}
          ><span class="status-dot"></span>{s.thinking
            ? 'Analyzing'
            : s.report
              ? s.report.finished
                ? 'Analysis ready'
                : 'Search stopped'
              : 'Ready'}</span
        >
        {#if s.report}<span class="muted"
            >depth {s.report.depth} · {compactNodes(s.report.nodes)} nodes</span
          >{/if}
      </div>
    </div>
    {#if s.report}
      <div class="variation-list">
        {#each s.report.variations as line, index}
          {@const sans = pvSan(s.fen, line.pv)}
          <button
            class="variation"
            disabled={!line.pv[0] || !s.canMove}
            aria-label={`Play line ${index + 1}: ${sans.join(' ')}`}
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
    {/if}
    <div class="study-actions">
      <!-- Analysis is continuous here, so the only useful control is stopping it. -->
      {#if s.thinking}<button
          class="btn btn-outline"
          onclick={() => session.search.cancel()}
          ><Square size={14} />Stop</button
        >{/if}
      <button class="btn btn-ghost" onclick={() => session.openDialog('fen')}
        >Load FEN</button
      >
      <button class="btn btn-ghost" onclick={() => void session.copyFen()}
        >Copy FEN</button
      >
    </div>
  {:else}
    {#if !s.record.moves.length}
      <div class="study-empty">
        <p>Play a game or import a PGN to review it.</p>
        <button
          class="btn btn-primary"
          onclick={() => session.openDialog('import')}
          ><Upload size={15} />Import a game</button
        >
      </div>
    {:else}
      <div class="review-controls">
        <label class="sr-only" for="review-budget">Review search budget</label
        ><select
          id="review-budget"
          class="select"
          bind:value={preset}
          disabled={s.reviewRunning}
          ><option value="quick">Quick · depth 5</option><option
            value="balanced">Balanced · depth 7</option
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
              : s.review
                ? 'Review again'
                : 'Review'}</button
          >{/if}
      </div>
      <Accuracy {session} />
      {#if s.review}
        <div class="review-progress">
          <span
            >{s.reviewRunning
              ? 'Checking positions'
              : s.review.complete
                ? 'Reviewed'
                : 'Partly reviewed'}</span
          ><span>{s.review.points.length} / {s.record.moves.length + 1}</span>
        </div>
        <progress
          class="progress progress-primary"
          value={progress}
          max="100"
          aria-label="Review progress"
        ></progress>
        {#if s.compact}
          <button
            type="button"
            class="text-action chart-toggle"
            aria-expanded={chart}
            aria-controls="review-chart"
            onclick={() => {
              chart = !chart;
            }}>{chart ? 'Hide the graph' : 'Show the graph'}</button
          >
        {/if}
        {#if !s.compact || chart}
          <div id="review-chart"><EvaluationChart {session} /></div>
        {/if}
        <p class="fine-print">
          depth {s.review.depth} · {Number(
            s.review.nodeBudget,
          ).toLocaleString()}
          nodes · {s.review.timeMs} ms per position
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
            <p>{selected.loss} centipawn loss.</p>
            {#if selected.bestSan && selected.grade !== 'best'}<button
                class="text-action"
                onclick={() => session.game.jump(selected.ply - 1)}
                >See {selected.bestSan} instead<ArrowRight size={15} /></button
              >{/if}
          </div>
        {/if}
        {#if turning.length}
          <div class="turning-points">
            <h3>Turning points</h3>
            {#each turning as move}
              <button onclick={() => session.game.jump(move.ply)}
                ><span class="grade-dot grade-{move.grade}"></span><span
                  >{Math.ceil(move.ply / 2)}{s.record.moves[move.ply - 1]
                    ?.color === 'black'
                    ? '…'
                    : '.'}
                  {s.record.moves[move.ply - 1]?.san}</span
                ><span class="muted">−{move.loss} cp</span><ArrowRight
                  size={14}
                /></button
              >
            {/each}
          </div>
        {/if}
      {:else}
        <p class="fine-print">
          Up to {budget.timeMs} ms and {Number(budget.nodes).toLocaleString()}
          nodes per position. Best means the engine’s first choice; other grades use
          centipawn loss. Accuracy is the share of the winning chances each side kept
          across its own moves, not a rating.
        </p>
      {/if}
      {#if s.reviewError}<p class="inline-error" role="alert">
          {s.reviewError}
        </p>{/if}
    {/if}
  {/if}
</section>
