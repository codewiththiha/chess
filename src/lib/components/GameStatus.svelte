<!-- State the live game in one line, wherever the layout puts it. -->
<script lang="ts">
  import { resultText } from '../domain/games';
  import { describeTime } from '../domain/time-controls';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const status = $derived.by(() => {
    if (s.record.result !== '*')
      return {
        title: s.record.termination || resultText(s.record.result),
        detail: `${resultText(s.record.result)} · ${s.record.result}`,
      };
    if (s.thinking && s.pos.turn !== s.record.human)
      return {
        title: 'Engine thinking',
        detail: s.report
          ? `depth ${s.report.depth} · ${Number(s.report.nodes).toLocaleString()} nodes`
          : 'starting the search',
      };
    if (!s.latest)
      return {
        title: `Move ${s.cursor} of ${s.record.moves.length}`,
        detail: 'Step to the latest move to play on',
      };
    if (s.pos.isCheck())
      return { title: 'Check', detail: 'Your king is attacked' };
    // A two-player board names the side instead of calling it "you".
    const side = s.pos.turn === 'white' ? 'White' : 'Black';
    const clock = describeTime(
      s.record.clock.initialMs / 60000,
      s.record.clock.incrementMs / 1000,
    );
    if (s.record.opponent === 'human')
      return { title: `${side} to move`, detail: clock };
    return s.pos.turn === s.record.human
      ? { title: 'Your move', detail: clock }
      : { title: 'Engine to move', detail: 'Waiting for its reply' };
  });
</script>

<div class="play-status" data-thinking={s.thinking}>
  <strong>{status.title}</strong>
  <span>{status.detail}</span>
</div>
