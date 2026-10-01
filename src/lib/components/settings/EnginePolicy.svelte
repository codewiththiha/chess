<!-- Expose all policy/resource choices within the engine-discovered WASM limits. -->
<script lang="ts">
  import { Info, Settings2 } from '@lucide/svelte';
  import type { EngineSettings, EngineMode } from '../../domain/types';
  import type { Discovery } from '../../engine/types';
  let {
    engine,
    discovery,
    chess960,
    onvariant,
  }: {
    engine: EngineSettings;
    discovery: Discovery | null;
    chess960: boolean;
    onvariant: () => void;
  } = $props();
  const fallback: EngineMode[] = [
    'balanced',
    'aggressive',
    'human-like',
    'analysis',
  ];
  const labels: Record<EngineMode, string> = {
    balanced: 'Balanced',
    aggressive: 'Attacking',
    'human-like': 'Human-like',
    analysis: 'Analysis',
  };
  const notes: Record<EngineMode, string> = {
    balanced: 'A balanced evaluation of the position.',
    aggressive: 'Uses the aggressive model and persistent attacking context.',
    'human-like': 'Adds strength-dependent variety to the move choice.',
    analysis: 'Disables deliberate strength reduction for serious analysis.',
  };
</script>

<div class="settings-block">
  <h3>Playing style</h3>
  <label for="engine-mode"
    >Personality<select
      id="engine-mode"
      aria-label="Personality"
      class="select"
      bind:value={engine.mode}
      >{#each discovery?.capabilities.modes ?? fallback as mode}<option
          value={mode}>{labels[mode]}</option
        >{/each}</select
    ></label
  >
  <p class="fine-print">
    {notes[engine.mode]} Analysis and review views use full-strength analysis regardless
    of this playing preset.
  </p>
</div>
<div class="settings-block">
  <h3>Strength</h3>
  <div class="segmented-control">
    <button
      type="button"
      class:chosen={engine.strength === 'skill'}
      aria-pressed={engine.strength === 'skill'}
      onclick={() => {
        engine.strength = 'skill';
      }}>Skill level</button
    ><button
      type="button"
      class:chosen={engine.strength === 'elo'}
      aria-pressed={engine.strength === 'elo'}
      onclick={() => {
        engine.strength = 'elo';
      }}>Nominal Elo</button
    >
  </div>
  {#if engine.strength === 'skill'}<div class="range-heading">
      <label for="engine-skill">Skill level</label><strong
        >{engine.skillLevel === 21
          ? 'Full strength'
          : `Level ${engine.skillLevel}`}</strong
      >
    </div>
    <input
      id="engine-skill"
      class="range range-primary"
      type="range"
      min="1"
      max="21"
      step="1"
      bind:value={engine.skillLevel}
    />
    <div class="range-captions">
      <span>Gentle · 1</span><span>Full · 21</span>
    </div>{:else}<label for="engine-elo"
      >Nominal Elo<input
        id="engine-elo"
        type="number"
        class="input"
        min={discovery?.capabilities.eloMin ?? 500}
        max={discovery?.capabilities.eloMax ?? 3000}
        step="1"
        required
        bind:value={engine.elo}
      /></label
    >{/if}
  <p class="honesty-note">
    <Info size={15} />Strength presets are approximate and uncalibrated—not
    measured ratings. Compute limits are a separate control.
  </p>
</div>
<div class="settings-block">
  <h3>Memory & variations</h3>
  <div class="field-pair">
    <label for="engine-hash"
      >Hash memory, MiB<input
        id="engine-hash"
        class="input"
        type="number"
        min="1"
        max={discovery?.capabilities.maxHashMiB ?? 64}
        step="1"
        required
        bind:value={engine.hashMiB}
      /></label
    ><label for="engine-pv"
      >MultiPV lines<input
        id="engine-pv"
        class="input"
        type="number"
        min="1"
        max={discovery?.capabilities.maxMultiPv ?? 32}
        step="1"
        required
        bind:value={engine.multiPv}
      /></label
    >
  </div>
  <p class="fine-print">
    Start with 8 MiB on mobile. Higher values use more memory. MultiPV shows no
    more lines than there are legal moves.
  </p>
</div>
<div class="settings-block">
  <h3>Reproducibility & runtime</h3>
  <div class="field-pair">
    <label for="engine-seed"
      >Random seed<input
        id="engine-seed"
        class="input mono"
        type="text"
        inputmode="numeric"
        pattern={'[0-9]{1,20}'}
        maxlength="20"
        required
        bind:value={engine.seed}
      /></label
    ><label for="engine-backend"
      >WASM backend<select
        id="engine-backend"
        aria-label="WASM backend"
        class="select"
        bind:value={engine.backend}
        ><option value="auto">Automatic (SIMD if available)</option><option
          value="portable">Portable</option
        ><option value="simd128">SIMD128</option></select
      ></label
    >
  </div>
  <p class="fine-print">
    Seed: 0–18,446,744,073,709,551,615, stored without precision loss. Automatic
    falls back to portable if SIMD startup fails.
  </p>
</div>
<div class="variant-note">
  <Settings2 size={18} />
  <div>
    <strong>{chess960 ? 'Chess960 is enabled' : 'Standard chess'}</strong>
    <p>Castling convention is tied to the game’s variant.</p>
  </div>
  <button type="button" class="text-action" onclick={onvariant}
    >Change in New game</button
  >
</div>
