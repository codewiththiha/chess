<!-- Keep primary modes and real engine/appearance controls reachable on every screen. -->
<script lang="ts">
  import {
    Swords,
    ScanSearch,
    ChartNoAxesCombined,
    LibraryBig,
    Settings2,
    Palette,
    CircleHelp,
  } from '@lucide/svelte';
  import type { Session } from '../controllers/session';
  import type { View } from '../domain/types';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const tabs = [
    { id: 'play', label: 'Play', icon: Swords },
    { id: 'analyze', label: 'Analysis', icon: ScanSearch },
    { id: 'review', label: 'Review', icon: ChartNoAxesCombined },
    { id: 'library', label: 'Library', icon: LibraryBig },
  ] as const;
  function navigate(view: View) {
    session.navigate(view);
  }
</script>

<header class="app-header">
  <button
    class="brand"
    onclick={() => navigate('play')}
    aria-label="gwaymaegyi chess, go to Play"
  >
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      alt=""
      width="36"
      height="36"
    />
    <span class="wordmark">gwaymaegyi<span class="brand-kind">chess</span></span
    >
  </button>
  <nav class="desktop-nav" aria-label="Main navigation">
    {#each tabs as tab}
      <button
        class:active={s.view === tab.id}
        aria-current={s.view === tab.id ? 'page' : undefined}
        onclick={() => navigate(tab.id)}
        ><tab.icon size={17} />{tab.label}</button
      >
    {/each}
  </nav>
  <div class="header-actions">
    <button
      class="btn btn-ghost icon-button"
      aria-label="Board appearance"
      title="Board appearance"
      onclick={() => session.openDialog('appearance')}
      ><Palette size={20} /></button
    >
    <button
      class="btn btn-ghost icon-button"
      aria-label="Engine settings"
      title="Engine settings"
      onclick={() => session.openDialog('settings')}
      ><Settings2 size={20} /></button
    >
    <button
      class="btn btn-ghost icon-button help-button"
      aria-label="Help and licenses"
      title="Help and licenses"
      onclick={() => session.openDialog('help')}
      ><CircleHelp size={20} /></button
    >
  </div>
</header>
<nav class="mobile-nav" aria-label="Mobile navigation">
  {#each tabs as tab}
    <button
      class:active={s.view === tab.id}
      aria-current={s.view === tab.id ? 'page' : undefined}
      onclick={() => navigate(tab.id)}
      ><tab.icon size={21} /><span>{tab.label}</span></button
    >
  {/each}
</nav>
