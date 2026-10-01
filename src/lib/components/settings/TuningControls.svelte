<!-- Generate every adjustable behavior and parameter from actual WASM discovery. -->
<script lang="ts">
  import { Search, RotateCcw } from '@lucide/svelte';
  import type { EngineSettings } from '../../domain/types';
  import type { Discovery } from '../../engine/types';
  let {
    engine,
    discovery,
  }: { engine: EngineSettings; discovery: Discovery | null } = $props();
  let query = $state('');
  const names: Record<string, string> = {
    aspiration: 'Aspiration windows',
    'null-move': 'Null-move pruning',
    'reverse-futility': 'Reverse futility',
    'quiet-pruning': 'Quiet-move pruning',
    'late-reductions': 'Late-move reductions',
    razoring: 'Razoring',
    'internal-reductions': 'Internal iterative reductions',
    'exchange-pruning': 'Static-exchange pruning',
    'history-pruning': 'History pruning',
    probcut: 'ProbCut',
    'singular-extensions': 'Singular extensions',
  };
  const parameters = $derived(
    discovery?.controls.parameters.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()),
    ) ?? [],
  );
  function setAll(enabled: boolean): void {
    if (discovery)
      engine.behaviors = Object.fromEntries(
        discovery.controls.behaviors.map((name) => [name, enabled]),
      );
  }
  function reset(): void {
    if (discovery) {
      engine.behaviors = { ...discovery.defaults.behaviors };
      engine.parameters = { ...discovery.defaults.parameters };
    }
  }
</script>

{#if discovery}
  <div class="settings-block">
    <div class="section-heading">
      <h3>
        Search behaviors <span class="count-label"
          >{discovery.controls.behaviors.length}</span
        >
      </h3>
      <button type="button" class="text-action" onclick={reset}
        ><RotateCcw size={14} />Reset defaults</button
      >
    </div>
    <p class="fine-print">
      These change search heuristics, not legal rules. Turning them off can slow
      or weaken the engine.
    </p>
    <div class="behavior-actions">
      <button
        type="button"
        class="btn btn-outline small-button"
        onclick={() => setAll(true)}>Enable all</button
      ><button
        type="button"
        class="btn btn-outline small-button"
        onclick={() => setAll(false)}>Disable all</button
      >
    </div>
    <div class="behavior-grid">
      {#each discovery.controls.behaviors as name}<label
          class="behavior-row"
          for={`behavior-${name}`}
          ><span>{names[name] ?? name}</span><input
            id={`behavior-${name}`}
            class="toggle toggle-sm toggle-primary"
            type="checkbox"
            checked={engine.behaviors[name] ??
              discovery.defaults.behaviors[name] ??
              true}
            onchange={(e) => {
              engine.behaviors[name] = e.currentTarget.checked;
            }}
          /></label
        >{/each}
    </div>
  </div>
  <details class="tuning-details" open>
    <summary>{discovery.controls.parameters.length} tuning parameters</summary>
    <p class="fine-print">
      Exact engine names, inclusive bounds, and defaults. Non-default values are
      for experimentation, not a guaranteed strength improvement.
    </p>
    <div class="parameter-search">
      <Search size={16} /><label class="sr-only" for="parameter-search"
        >Find an engine parameter</label
      ><input
        id="parameter-search"
        placeholder="Find a parameter"
        bind:value={query}
      />
    </div>
    <div class="parameter-grid">
      {#each parameters as parameter}<label for={`parameter-${parameter.name}`}
          ><code>{parameter.name}</code><input
            id={`parameter-${parameter.name}`}
            aria-label={parameter.name}
            aria-describedby={`parameter-note-${parameter.name}`}
            class="input"
            type="number"
            min={parameter.min}
            max={parameter.max}
            step="1"
            required
            value={engine.parameters[parameter.name] ?? parameter.default}
            oninput={(e) => {
              engine.parameters[parameter.name] = e.currentTarget.valueAsNumber;
            }}
          /><small id={`parameter-note-${parameter.name}`}
            >{parameter.min}–{parameter.max} · default {parameter.default}</small
          ></label
        >{/each}
    </div>
    {#if !parameters.length}<p>No matching parameters.</p>{/if}
  </details>
{:else}<p class="inline-error">
    Start the engine to load its supported behaviors and parameters. No
    placeholder controls are shown.
  </p>{/if}
<div class="native-note">
  <strong>Native-only capabilities</strong>
  <p>
    WASM does not expose SMP Threads or Syzygy tablebases. Native gwaymaegyi
    supports larger resource ranges; browser ceilings are deliberately separate.
  </p>
</div>
