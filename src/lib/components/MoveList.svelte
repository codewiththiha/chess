<!-- Group real SAN moves by fullmove number and navigate without scrolling the page. -->
<script lang="ts">
  import { Download } from '@lucide/svelte';
  import { grades } from '../domain/review';
  import { position } from '../domain/chess';
  import type { Session } from '../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let list = $state<HTMLDivElement>();
  const annotations = $derived(
    new Map(grades(s.record, s.review?.points ?? []).map((g) => [g.ply, g])),
  );
  const rows = $derived.by(() => {
    const start = position(s.record.startFen);
    const grouped = new Map<
      number,
      {
        number: number;
        white?: { san: string; ply: number };
        black?: { san: string; ply: number };
      }
    >();
    s.record.moves.forEach((m, i) => {
      const number =
        start.fullmoves +
        Math.floor((i + (start.turn === 'black' ? 1 : 0)) / 2);
      const row = grouped.get(number) ?? { number };
      row[m.color] = { san: m.san, ply: i + 1 };
      grouped.set(number, row);
    });
    return [...grouped.values()];
  });
  $effect(() => {
    const selected = s.cursor;
    const target = list?.querySelector<HTMLElement>(`[data-ply="${selected}"]`);
    if (list && target) {
      if (target.offsetTop < list.scrollTop) list.scrollTop = target.offsetTop;
      else if (
        target.offsetTop + target.offsetHeight >
        list.scrollTop + list.clientHeight
      )
        list.scrollTop =
          target.offsetTop + target.offsetHeight - list.clientHeight;
    }
  });
</script>

<section class="notation-section" aria-label="Game notation">
  <div class="section-heading">
    <h2>Moves</h2>
    <button
      class="btn btn-ghost small-button"
      disabled={!s.record.moves.length}
      onclick={() => session.exportCurrent()}
      title="Export PGN"><Download size={15} />PGN</button
    >
  </div>
  {#if !rows.length}
    <div class="notation-empty">
      <span class="empty-board-symbol" aria-hidden="true"></span>
      <h3>No moves yet.</h3>
      <p>Tap a piece to see its legal squares, or pick it up and move it.</p>
    </div>
  {:else}
    <div class="move-list" bind:this={list}>
      {#each rows as row}
        <div class="move-row">
          <span class="move-number">{row.number}.</span>
          {#each ['white', 'black'] as color}
            {@const move = color === 'white' ? row.white : row.black}
            {#if move}
              {@const annotation = annotations.get(move.ply)}
              <button
                class="move-cell"
                class:current={s.cursor === move.ply}
                data-ply={move.ply}
                aria-label={`Move ${row.number}, ${color}, ${move.san}${annotation ? `, ${annotation.grade}, ${annotation.loss} centipawn loss` : ''}`}
                aria-current={s.cursor === move.ply ? 'step' : undefined}
                onclick={() => session.game.jump(move.ply)}
                ><span>{move.san}</span>{#if annotation}<span
                    class="grade-dot grade-{annotation.grade}"
                    title={`${annotation.grade} · ${annotation.loss} cp loss`}
                  ></span>{/if}</button
              >
            {:else}<span class="move-cell missing">…</span>{/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="notation-caption">
      <span>{s.cursor} / {s.record.moves.length} plies</span><span
        >{s.record.result === '*' ? 'Main line' : s.record.result}</span
      >
    </div>
  {/if}
</section>
