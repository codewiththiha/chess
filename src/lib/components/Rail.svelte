<!-- Keep every mode and utility one icon away without a page header. -->
<script lang="ts">
  import {
    House,
    Swords,
    ScanSearch,
    Upload,
    Settings2,
    Palette,
    CircleHelp,
    Volume2,
    VolumeX,
  } from '@lucide/svelte';
  import type { Session } from '../controllers/session';
  import type { View } from '../domain/types';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const views = [
    { id: 'home', label: 'Home', icon: House },
    { id: 'play', label: 'Play', icon: Swords },
    { id: 'study', label: 'Study', icon: ScanSearch },
  ] as const;
  function go(view: View): void {
    session.navigate(view);
  }
</script>

<nav class="rail" aria-label="Main navigation">
  <img
    class="rail-mark"
    src={`${import.meta.env.BASE_URL}favicon.svg`}
    alt=""
    width="26"
    height="26"
  />
  <div class="rail-group">
    {#each views as view}
      <button
        class="rail-button"
        class:active={s.view === view.id}
        aria-current={s.view === view.id ? 'page' : undefined}
        aria-label={view.label}
        title={view.label}
        onclick={() => go(view.id)}><view.icon size={20} /></button
      >
    {/each}
  </div>
  <div class="rail-group rail-bottom">
    <button
      class="rail-button"
      class:active={s.preferences.speech}
      aria-label="Opponent speech"
      aria-pressed={s.preferences.speech}
      title={s.preferences.speech
        ? 'Opponent speech: on'
        : 'Opponent speech: off'}
      onclick={() => session.toggleSpeech()}
      >{#if s.preferences.speech}<Volume2 size={19} />{:else}<VolumeX
          size={19}
        />{/if}</button
    >
    <button
      class="rail-button rail-optional"
      aria-label="Import PGN"
      title="Import PGN"
      onclick={() => session.openDialog('import')}><Upload size={19} /></button
    >
    <button
      class="rail-button"
      aria-label="Engine settings"
      title="Engine settings"
      onclick={() => session.openDialog('settings')}
      ><Settings2 size={19} /></button
    >
    <button
      class="rail-button"
      aria-label="Board appearance"
      title="Board appearance"
      onclick={() => session.openDialog('appearance')}
      ><Palette size={19} /></button
    >
    <button
      class="rail-button"
      aria-label="Help and licenses"
      title="Help and licenses"
      onclick={() => session.openDialog('help')}
      ><CircleHelp size={19} /></button
    >
  </div>
</nav>
