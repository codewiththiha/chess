<!-- Group real SAN moves by fullmove number and navigate without scrolling the page. -->
<script lang="ts">
  import { grades } from '../domain/review';
  import { gradeWords } from '../domain/coachtalk';
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
    s.record.moves.forEach((move, index) => {
      const number =
        start.fullmoves +
        Math.floor((index + (start.turn === 'black' ? 1 : 0)) / 2);
      const row = grouped.get(number) ?? { number };
      row[move.color] = { san: move.san, ply: index + 1 };
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

<section class="move-section" aria-label="Moves">
  {#if !s.record.moves.length}
    <p class="moves-empty">No moves yet. Tap a piece to see where it can go.</p>
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
                aria-label={`Move ${row.number}, ${color}, ${move.san}${annotation ? `, ${gradeWords(annotation.grade)}` : ''}`}
                aria-current={s.cursor === move.ply ? 'step' : undefined}
                onclick={() => session.game.jump(move.ply)}>{move.san}</button
              >
              <span class="move-dot"
                >{#if annotation}<span
                    class="grade-dot grade-{annotation.grade}"
                    title={gradeWords(annotation.grade)}
                  ></span>{/if}</span
              >
            {:else}<span class="move-cell missing">…</span><span
                class="move-dot"
              ></span>{/if}
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
