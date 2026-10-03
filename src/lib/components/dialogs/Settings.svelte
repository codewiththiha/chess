<!-- Stage typed settings and apply them atomically, including live compute-only updates. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Cpu, Gauge, SlidersHorizontal } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import EnginePolicy from '../settings/EnginePolicy.svelte';
  import ComputeControls from '../settings/ComputeControls.svelte';
  import TuningControls from '../settings/TuningControls.svelte';
  import { defaultPreferences } from '../../domain/preferences';
  import type { Preferences } from '../../domain/types';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let draft = $state<Preferences>(defaultPreferences());
  // A bot on the board plays to its own card, and that is the only time these
  // settings would not be the ones in force: so it is the only time the dialog
  // stops offering them.
  const bot = $derived(s.gameBot);
  let tab = $state('engine');
  let error = $state('');
  let busy = $state(false);
  onMount(() => {
    draft = s.preferenceSnapshot();
  });
  async function apply(): Promise<void> {
    busy = true;
    error = '';
    try {
      await session.applyPreferences($state.snapshot(draft));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog
  title="Engine settings."
  subtitle="A real engine, with room to experiment."
  wide
  canClose={!busy}
  onclose={() => session.closeDialog()}
>
  <form
    class="settings-form"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      void apply();
    }}
  >
    <div
      class="settings-tabs"
      role="tablist"
      aria-label="Engine setting sections"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'engine'}
        class:active={tab === 'engine'}
        onclick={() => {
          tab = 'engine';
        }}><Cpu size={16} />Engine</button
      ><button
        type="button"
        role="tab"
        aria-selected={tab === 'performance'}
        class:active={tab === 'performance'}
        onclick={() => {
          tab = 'performance';
        }}><Gauge size={16} />Performance</button
      ><button
        type="button"
        role="tab"
        aria-selected={tab === 'advanced'}
        class:active={tab === 'advanced'}
        onclick={() => {
          tab = 'advanced';
        }}><SlidersHorizontal size={16} />Advanced</button
      >
    </div>
    <div
      class="settings-content"
      role="tabpanel"
      aria-label={`${tab} settings`}
    >
      {#if tab === 'engine'}<EnginePolicy
          engine={draft.engine}
          discovery={s.discovery}
          chess960={s.record.chess960}
          governedBy={bot?.name ?? null}
          onvariant={() => {
            session.closeDialog();
            session.navigate('home');
          }}
        />{:else if tab === 'performance'}<ComputeControls
          compute={draft.engine.compute}
          discovery={s.discovery}
          running={s.thinking && s.view === 'study'}
        />{:else}<TuningControls
          engine={draft.engine}
          discovery={s.discovery}
        />{/if}
    </div>
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    <div class="dialog-footer settings-footer">
      <span class="fine-print"
        >{s.ready
          ? `${s.backend === 'simd128' ? 'SIMD128' : 'Portable'} · v${s.discovery?.capabilities.version}`
          : 'Engine not ready'}</span
      >
      <div>
        <button
          type="button"
          class="btn btn-ghost"
          disabled={busy}
          onclick={() => session.closeDialog()}>Cancel</button
        ><button class="btn btn-primary" disabled={busy}
          >{#if busy}<span class="loading loading-spinner loading-xs"
            ></span>{:else}<Check size={16} />{/if}Save settings</button
        >
      </div>
    </div>
  </form>
</Dialog>
