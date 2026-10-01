<!-- Explain local storage, review caveats, capabilities, shortcuts, and license provenance. -->
<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
</script>

<Dialog
  title="A little help."
  subtitle="Your board. Your engine. Your device."
  wide
  onclose={() => session.closeDialog()}
>
  <div class="help-content">
    <section>
      <h3>Moving pieces</h3>
      <p>
        Tap a piece and its destination, or grab and drag. Promotion offers
        queen, rook, bishop, or knight. Chess960 supports king-to-rook castling.
      </p>
      <p>
        Tab into the board, use arrow keys to focus a square, and Enter or Space
        to select a piece and destination. Escape clears the selection.
      </p>
    </section>
    <section>
      <h3>Games stay here</h3>
      <p>
        Moves, settings, and review results live in IndexedDB in this browser.
        Refreshing restores your game paused. Clocks run while the tab is open,
        including in the background. Export PGN to keep a portable backup;
        clearing browser data can erase this library.
      </p>
      <p>
        No login, external analysis API, telemetry, or remote game upload is
        required. The bundled engine, SVGs, and fonts load from this app’s own
        origin.
      </p>
    </section>
    <section>
      <h3>What the engine means</h3>
      <p>
        gwaymaegyi runs real Rust-built WebAssembly in a worker. Automatic
        runtime selection uses SIMD128 when available, otherwise portable WASM.
        Strength/Elo presets are nominal and uncalibrated. Analysis and review
        use full-strength analysis with the selected search/tuning limits.
      </p>
      <p>
        Review compares signed before/after evaluations. It does not calculate
        Chess.com accuracy, brilliant moves, or winning probabilities. Results
        depend on depth, nodes, time, and tuning; a deeper review may change an
        annotation.
      </p>
      <p>
        All 11 search behaviors and 38 numeric parameters are adjustable.
        Browser ceilings: Hash 64 MiB, MultiPV 32, depth 64. Native SMP Threads
        and Syzygy are not available here. A review uses its own worker and
        memory allocation, not extra search threads.
      </p>
    </section>
    <section>
      <h3>Shortcuts</h3>
      <dl class="shortcut-list">
        <dt>← / →</dt>
        <dd>Previous / next position (outside the board)</dd>
        <dt>Home / End</dt>
        <dd>First / latest position</dd>
        <dt>F</dt>
        <dd>Flip the board (board/tools focused)</dd>
        <dt>N</dt>
        <dd>New game (board/tools focused)</dd>
      </dl>
    </section>
    <section>
      <h3>Credits & open source</h3>
      <p>
        Chessground: GPL-3.0-or-later. chessops: GPL-3.0-or-later. This frontend
        is GPL-3.0-or-later. gwaymaegyi and its bundled models retain their MIT
        notices.
      </p>
      <p>
        Chessnut pieces: Alexis Luengas (Apache 2.0). Celtic: Maurizio Monge
        (MIT). Classic: Colin M. L. Burnett (GPLv2+). DM Sans, Newsreader, and
        DM Mono fonts: SIL Open Font License.
      </p>
      <div class="license-links">
        <a
          href={`${import.meta.env.BASE_URL}licenses/GPL-3.0.txt`}
          target="_blank"
          rel="noreferrer">Frontend license<ExternalLink size={12} /></a
        ><a
          href={`${import.meta.env.BASE_URL}engine/portable/LICENSE`}
          target="_blank"
          rel="noreferrer">Engine license<ExternalLink size={12} /></a
        ><a
          href={`${import.meta.env.BASE_URL}pieces/manifest.json`}
          target="_blank"
          rel="noreferrer">Artwork provenance<ExternalLink size={12} /></a
        ><a
          href="https://github.com/codewiththiha/gwaymaegyi/tree/4e2af5f068e49bf83fe5f1522636c985355b114a"
          target="_blank"
          rel="noreferrer">Engine source<ExternalLink size={12} /></a
        >
      </div>
      <p class="fine-print">
        Engine revision 4e2af5f. Frontend source is included in this project; a
        public source location must accompany any hosted distribution.
      </p>
    </section>
  </div>
</Dialog>
