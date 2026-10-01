<!-- Render a lightweight true position preview without creating another drag controller. -->
<script lang="ts">
  import { position } from '../domain/chess';
  import { makeSquare, roleToChar } from 'chessops/util';
  import type { PieceSet, BoardTheme } from '../domain/types';
  let {
    fen,
    pieces,
    theme,
  }: { fen: string; pieces: PieceSet; theme: BoardTheme } = $props();
  const board = $derived(position(fen).board);
</script>

<div class="mini-board board-{theme}" aria-hidden="true">
  {#each Array.from({ length: 64 }, (_, i) => (7 - Math.floor(i / 8)) * 8 + (i % 8)) as square, i}{@const piece =
      board.get(square)}<span
      class:dark={(Math.floor(i / 8) + (i % 8)) % 2 === 1}
      title={makeSquare(square)}
      >{#if piece}<img
          src={`${import.meta.env.BASE_URL}pieces/${pieces}/${piece.color === 'white' ? 'w' : 'b'}${roleToChar(piece.role).toUpperCase()}.svg`}
          alt=""
        />{/if}</span
    >{/each}
</div>
