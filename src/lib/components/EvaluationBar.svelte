<!-- Visualize signed evaluation, explicitly not a probability of winning. -->
<script lang="ts">
  import { whiteScore, formatScore } from '../domain/review';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const point = $derived(
    s.view === 'review'
      ? s.review?.points.find((p) => p.ply === s.cursor)
      : undefined,
  );
  const report = $derived(s.view === 'play' && s.hint ? s.hint : s.report);
  const value = $derived(
    point?.whiteCp ??
      (report ? whiteScore(report.scoreCp, report.mate, s.pos.turn) : null),
  );
  const mate = $derived(
    point?.whiteMate ??
      (report?.mate !== null && report?.mate !== undefined
        ? report.mate * (s.pos.turn === 'white' ? 1 : -1)
        : null),
  );
  const extent = $derived(
    value === null ? 50 : 50 + Math.tanh(value / 550) * 46,
  );
</script>

<div
  class="evaluation-rail"
  class:unknown={value === null}
  title={`White’s evaluation: ${formatScore(value, mate)}. Not a win probability.`}
>
  <div class="evaluation-white" style:height={`${extent}%`}></div>
  <span class="sr-only">White’s evaluation {formatScore(value, mate)}</span>
</div>
