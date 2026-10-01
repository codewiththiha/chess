<!-- Plot recorded evaluations with a keyboard-equivalent position selector. -->
<script lang="ts">
  import { formatScore } from '../../domain/review';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const points = $derived(
    [...(s.review?.points ?? [])].sort((a, b) => a.ply - b.ply),
  );
  const x = (ply: number) =>
    12 + (ply / Math.max(1, s.record.moves.length)) * 316;
  const y = (cp: number) => 61 - (Math.max(-500, Math.min(500, cp)) / 500) * 45;
  const line = $derived(
    points
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.ply)},${y(p.whiteCp)}`)
      .join(' '),
  );
  const area = $derived(
    points.length
      ? `M${x(points[0]?.ply ?? 0)},61 ${line.replace(/^M/, 'L')} L${x(points.at(-1)?.ply ?? 0)},61 Z`
      : '',
  );
  const current = $derived(points.find((p) => p.ply === s.cursor));
  function select(event: MouseEvent): void {
    const bounds =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getBoundingClientRect()
        : null;
    if (!bounds || !points.length) return;
    const ply = Math.round(
      ((event.clientX - bounds.left) / bounds.width) * s.record.moves.length,
    );
    const first = points[0];
    if (!first) return;
    const point = points.reduce(
      (best, p) =>
        Math.abs(p.ply - ply) < Math.abs(best.ply - ply) ? p : best,
      first,
    );
    session.game.jump(point.ply);
  }
  function key(event: KeyboardEvent): void {
    const keys: Record<string, number> = {
      ArrowLeft: s.cursor - 1,
      ArrowDown: s.cursor - 1,
      ArrowRight: s.cursor + 1,
      ArrowUp: s.cursor + 1,
      Home: 0,
      End: s.record.moves.length,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    session.game.jump(next);
  }
</script>

<div
  class="review-chart"
  role="slider"
  tabindex="0"
  aria-label="Game position on evaluation chart"
  aria-orientation="horizontal"
  aria-valuemin="0"
  aria-valuemax={s.record.moves.length}
  aria-valuenow={s.cursor}
  aria-valuetext={`Position ${s.cursor} of ${s.record.moves.length}${current ? `: ${formatScore(current.whiteCp, current.whiteMate)}` : ''}`}
  onclick={select}
  onkeydown={key}
>
  <svg
    viewBox="0 0 340 130"
    role="img"
    aria-label="White’s evaluation through the game, clipped at plus or minus five pawns"
  >
    <line x1="12" y1="61" x2="328" y2="61" class="chart-zero" />
    <line x1="12" y1="16" x2="328" y2="16" class="chart-guide" /><line
      x1="12"
      y1="106"
      x2="328"
      y2="106"
      class="chart-guide"
    />
    <path d={area} class="chart-area" /><path d={line} class="chart-line" />
    {#if current}<line
        x1={x(current.ply)}
        y1="12"
        x2={x(current.ply)}
        y2="110"
        class="chart-cursor"
      /><circle
        cx={x(current.ply)}
        cy={y(current.whiteCp)}
        r="4"
        class="chart-point"
      />{/if}
    <text x="12" y="125">Start</text><text x="328" y="125" text-anchor="end"
      >Ply {s.record.moves.length}</text
    >
  </svg>
</div>
<div class="chart-legend">
  <span>White’s perspective</span><span
    >{current
      ? formatScore(current.whiteCp, current.whiteMate)
      : 'Select a reviewed position'}</span
  >
</div>
