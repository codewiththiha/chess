<!-- Validate uploaded or pasted PGN completely before changing the active game. -->
<script lang="ts">
  import { Upload, FileText } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  let pgn = $state('');
  let error = $state('');
  let busy = $state(false);
  async function file(event: Event): Promise<void> {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const selected = input.files?.[0];
    if (!selected) return;
    if (selected.size > 2_000_000) {
      error = 'Choose a PGN file smaller than 2 MB.';
      return;
    }
    pgn = await selected.text();
    error = '';
  }
  async function load(): Promise<void> {
    busy = true;
    error = '';
    try {
      await session.importGames(pgn);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog
  title="Bring a game."
  subtitle="Import a PGN file, or paste its notation."
  canClose={!busy}
  onclose={() => session.closeDialog()}
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void load();
    }}
    class="dialog-form"
  >
    <label class="file-picker" for="pgn-file"
      ><FileText size={25} /><span
        >Choose a .pgn file<small>Up to 100 games · 2 MB maximum</small></span
      ><input
        id="pgn-file"
        type="file"
        accept=".pgn,text/plain,application/x-chess-pgn"
        onchange={(e) => void file(e)}
      /></label
    ><label for="pgn-text"
      >PGN notation<textarea
        id="pgn-text"
        class="textarea notation-input"
        rows="8"
        required
        maxlength="2000000"
        bind:value={pgn}
        placeholder={`[White "You"]
[Black "gwaymaegyi"]

1. e4 e5 2. Nf3 Nc6 *`}></textarea></label
    >
    <p class="fine-print">
      Legal mainlines are imported. Side variations and comments are not
      retained; export your original PGN separately if you need them.
    </p>
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    <div class="dialog-footer">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={busy}
        onclick={() => session.closeDialog()}>Cancel</button
      ><button class="btn btn-primary" disabled={busy || !pgn.trim()}
        >{#if busy}<span class="loading loading-spinner loading-xs"
          ></span>{:else}<Upload size={16} />{/if}Import game</button
      >
    </div>
  </form>
</Dialog>
