<!-- State real storage, engine, and licensing facts without marketing copy. -->
<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import { readDesktopHost } from '../../data/desktop';
  import type { DesktopHost } from '../../data/desktop';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let host = $state<DesktopHost | null>(null);
  $effect(() => {
    let live = true;
    void readDesktopHost().then((value) => {
      if (live) host = value;
    });
    return () => {
      live = false;
    };
  });
</script>

<Dialog title="Help" wide onclose={() => session.closeDialog()}>
  <div class="help-content">
    <section>
      <h3>Playing</h3>
      <p>
        Drag or tap to move. Tab into the board to move by keyboard: arrows
        change squares, Enter or Space selects, Escape clears.
      </p>
      <p>Shortcuts: F flips, N opens Home, arrows step, Home and End jump.</p>
    </section>
    <section>
      <h3>Clocks</h3>
      <p>
        Clocks keep running while you look around, so nothing is paused. Pick No
        clock for a timeless game.
      </p>
    </section>
    <section>
      <h3>Storage</h3>
      <p>
        {s.backend
          ? `Games are stored locally in SQLite (${s.backend}).`
          : 'Games are stored locally in SQLite.'}
        Each game is one record with its review; clearing site data erases it. Export
        PGN for a portable copy.
      </p>
      {#if host}
        <p>Desktop shell v{host.version}: {host.storage}.</p>
      {/if}
    </section>
    <section>
      <h3>Engine</h3>
      <p>
        Moves and scores come from the bundled Rust engine running as
        WebAssembly in this device — depth and node budgets are real limits, not
        estimates.
      </p>
      <p>
        Review grades mark the engine's first choice as best and use centipawn
        loss for the rest. They are not calibrated accuracy ratings.
      </p>
    </section>
    <section>
      <h3>Licenses</h3>
      <p>
        <a href="licenses/" target="_blank" rel="noopener"
          >Third-party notices and license texts<ExternalLink size={14} /></a
        >
      </p>
    </section>
  </div>
</Dialog>
