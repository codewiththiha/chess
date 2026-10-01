<!-- Complete a pending legal promotion with an explicit piece choice. -->
<script lang="ts">
  import Dialog from './Dialog.svelte';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const choices = [
    { letter: 'q', name: 'Queen' },
    { letter: 'r', name: 'Rook' },
    { letter: 'b', name: 'Bishop' },
    { letter: 'n', name: 'Knight' },
  ];
</script>

<Dialog
  title="Choose your promotion."
  subtitle="Your pawn has reached the last rank."
  onclose={() => session.closeDialog()}
  ><div class="promotion-choices">
    {#each choices as choice}<button
        class="promotion-choice"
        onclick={() => {
          const p = session.state.promotion;
          if (p) session.game.attempt(p.from, p.to, choice.letter);
        }}
        ><img
          src={`${import.meta.env.BASE_URL}pieces/${session.state.preferences.pieces}/${session.state.pos.turn === 'white' ? 'w' : 'b'}${choice.letter.toUpperCase()}.svg`}
          alt=""
        /><span>{choice.name}</span></button
      >{/each}
  </div>
  <p class="fine-print">Escape cancels the move.</p></Dialog
>
