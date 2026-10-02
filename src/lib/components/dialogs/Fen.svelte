<!-- Load a validated position without silently discarding an existing saved game. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from './Dialog.svelte';
  import { INITIAL_FEN } from '../../domain/chess';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  let fen = $state(INITIAL_FEN);
  let chess960 = $state(false);
  let error = $state('');
  onMount(() => {
    fen = session.state.fen;
    chess960 = session.state.record.chess960;
  });
  function load(): void {
    try {
      session.game.loadFen(fen, chess960);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<Dialog title="Load a position" onclose={() => session.closeDialog()}
  ><form
    class="dialog-form"
    onsubmit={(e) => {
      e.preventDefault();
      load();
    }}
  >
    <label for="fen-text"
      >FEN position<textarea
        id="fen-text"
        class="textarea notation-input"
        rows="4"
        bind:value={fen}
        maxlength="256"
        required></textarea></label
    ><label class="toggle-row" for="fen-960"
      ><span
        ><strong>Chess960 castling</strong><small
          >Enable for a Fischer-random position.</small
        ></span
      ><input
        id="fen-960"
        class="toggle toggle-primary"
        type="checkbox"
        bind:checked={chess960}
      /></label
    >{#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    <div class="dialog-footer">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => {
          fen = INITIAL_FEN;
          chess960 = false;
        }}>Starting position</button
      ><button class="btn btn-primary">Load position</button>
    </div>
  </form></Dialog
>
