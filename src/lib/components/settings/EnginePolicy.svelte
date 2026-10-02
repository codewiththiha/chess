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
  <div class="range-heading">
    <label for="engine-elo">Nominal Elo</label><strong
      >{engine.strength === 'full' ? 'Full strength' : engine.elo}</strong
    >
  </div>
  <input
    id="engine-elo"
    class="range range-primary"
    type="range"
    min={discovery?.capabilities.eloMin ?? 500}
    max={discovery?.capabilities.eloMax ?? 3000}
    step="25"
    aria-label="Nominal Elo"
    disabled={engine.strength === 'full'}
    bind:value={engine.elo}
  />
  <div class="range-captions">
    <span>{discovery?.capabilities.eloMin ?? 500} · gentler</span><span
      >{discovery?.capabilities.eloMax ?? 3000} · strongest target</span
    >
  </div>
  <label class="toggle-row" for="engine-full"
    ><span
      ><strong>Full strength</strong><small
        >Ignore the target and let the engine play uncapped.</small
      ></span
    ><input
      id="engine-full"
      class="toggle toggle-primary"
      type="checkbox"
      aria-label="Full strength"
      checked={engine.strength === 'full'}
      onchange={(event) => {
        engine.strength = event.currentTarget.checked ? 'full' : 'elo';
      }}
    /></label
  >
  <p class="honesty-note">
    <Info size={15} />Elo targets are nominal and uncalibrated—not measured
    ratings. A bot from the library plays at the strength printed on its card.
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
