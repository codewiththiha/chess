<!-- Visualize signed evaluation, explicitly not a probability of winning. -->
<script lang="ts">
  import {
    evaluationLabel,
    evaluationSeries,
    railExtent,
    railValue,
    resultValue,
  } from '../domain/review';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const series = $derived(
    evaluationSeries(s.record, s.review?.points ?? [], s.evals),
  );
  /** A game that is over fills the rail for its winner, wherever it ended. */
  const decided = $derived(
    s.record.result !== '*' && s.cursor === s.record.moves.length,
  );
  const whiteCp = $derived(
    decided ? resultValue(s.record) : railValue(series, s.cursor),
  );
  const extent = $derived(railExtent(whiteCp));
  /** The rail says what it shows, and never claims to be a probability. */
  function railText(result: string, cp: number | null): string {
    if (result === '1-0') return 'White wins — the evaluation rail is full.';
    if (result === '0-1') return 'Black wins — the evaluation rail is full.';
    if (result === '1/2-1/2') return 'Drawn — the evaluation rail is level.';
    return `White’s evaluation: ${evaluationLabel(cp)}. Not a win probability.`;
  }
  const text = $derived(railText(s.record.result, whiteCp));
</script>

<div class="evaluation-rail" class:unknown={whiteCp === null} title={text}>
  <div class="evaluation-white" style:height={`${extent}%`}></div>
  <span class="sr-only">{text}</span>
</div>
