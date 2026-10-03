<!-- Report each side's accuracy once a game is over, from settled evaluations. -->
<script lang="ts">
  import { accuracyReport } from '../domain/review';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const report = $derived(
    s.record.result === '*'
      ? null
      : accuracyReport(s.record, s.review?.points ?? [], s.evals),
  );
</script>

{#if report}
  <div class="accuracy-report">
    <h3>Accuracy</h3>
    <div class="accuracy-sides">
      <div class="accuracy-side">
        <span>{s.record.white}</span>
        <strong>{report.white}%</strong>
      </div>
      <div class="accuracy-side">
        <span>{s.record.black}</span>
        <strong>{report.black}%</strong>
      </div>
    </div>
  </div>
{/if}
