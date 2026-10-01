<!-- Separate strength from exact cooperative search and reporting budgets. -->
<script lang="ts">
  import { COMPUTE_PRESETS } from '../../domain/preferences';
  import type { ComputeSettings } from '../../domain/types';
  import type { Discovery } from '../../engine/types';
  let {
    compute,
    discovery,
    running,
  }: {
    compute: ComputeSettings;
    discovery: Discovery | null;
    running: boolean;
  } = $props();
  function preset(name: 'full' | 'balanced' | 'responsive'): void {
    Object.assign(compute, COMPUTE_PRESETS[name]);
  }
  function custom(): void {
    compute.profile = 'custom';
  }
</script>

<div class="settings-block">
  <h3>Performance preset</h3>
  <div class="compute-presets">
    <button
      type="button"
      class:chosen={compute.profile === 'responsive'}
      onclick={() => preset('responsive')}
      ><strong>Responsive</strong><span>Light, short searches</span></button
    ><button
      type="button"
      class:chosen={compute.profile === 'balanced'}
      onclick={() => preset('balanced')}
      ><strong>Balanced</strong><span>A practical daily budget</span></button
    ><button
      type="button"
      class:chosen={compute.profile === 'full'}
      onclick={() => preset('full')}
      ><strong>Full</strong><span>Maximum limits, no deadline</span></button
    >
  </div>
  <p class="fine-print">
    Full can run until you stop it and use substantial CPU/battery. Presets
    never change the selected skill level.
  </p>
</div>
<div class="settings-block">
  <h3>Search limits</h3>
  <div class="field-pair">
    <label for="compute-depth"
      >Maximum depth<input
        id="compute-depth"
        class="input"
        type="number"
        min="1"
        max={discovery?.capabilities.maxDepth ?? 64}
        step="1"
        required
        bind:value={compute.depth}
        oninput={custom}
      /></label
    ><label for="compute-nodes"
      >Maximum nodes<input
        id="compute-nodes"
        class="input mono"
        type="text"
        inputmode="numeric"
        pattern={'[0-9]{1,20}'}
        maxlength="20"
        required
        bind:value={compute.nodes}
        oninput={custom}
      /></label
    >
  </div>
  <p class="fine-print">
    Node budgets support the full unsigned 64-bit range as decimal strings. The
    first limit reached stops the search.
  </p>
  <label class="toggle-row" for="compute-deadline"
    ><span
      ><strong>Limit thinking time</strong><small
        >A hard per-search deadline, not a chess clock.</small
      ></span
    ><input
      id="compute-deadline"
      class="toggle toggle-primary"
      type="checkbox"
      checked={compute.timeMs !== null}
      onchange={(e) => {
        compute.timeMs = e.currentTarget.checked ? 1500 : null;
        custom();
      }}
    /></label
  >{#if compute.timeMs !== null}<label for="compute-time"
      >Time budget, milliseconds<input
        id="compute-time"
        class="input"
        type="number"
        min="1"
        max="86400000"
        step="1"
        required
        bind:value={compute.timeMs}
        oninput={custom}
      /></label
    >{/if}
</div>
<div class="settings-block">
  <h3>Worker scheduling</h3>
  <div class="field-pair">
    <label for="compute-quantum"
      >Work per slice<input
        id="compute-quantum"
        class="input"
        type="number"
        min="1"
        max={discovery?.capabilities.maxWork ?? 65536}
        step="1"
        required
        bind:value={compute.quantum}
        oninput={custom}
      /></label
    ><label for="compute-report"
      >Report interval, milliseconds<input
        id="compute-report"
        class="input"
        type="number"
        min="0"
        max="5000"
        step="1"
        required
        bind:value={compute.reportIntervalMs}
        oninput={custom}
      /></label
    >
  </div>
  <p class="fine-print">
    Smaller slices make cancellation more responsive. Reports also publish at
    completed depths; 0 requests a report every slice.
  </p>
</div>
<div class="performance-note">
  <strong
    >{running
      ? 'Running analysis can update in place.'
      : 'Budgets are applied to the next search.'}</strong
  >
  <p>
    Performance-only changes preserve an active analysis continuation. Policy or
    position changes replace it. Timed games also cap thinking by the remaining
    clock.
  </p>
</div>
