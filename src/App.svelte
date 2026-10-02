<!-- Compose the rail, board workspace, and panels; behavior lives in controllers. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertCircle, RefreshCw } from '@lucide/svelte';
  import { Session } from './lib/controllers/session';
  import Rail from './lib/components/Rail.svelte';
  import Home from './lib/components/Home.svelte';
  import Board from './lib/components/Board.svelte';
  import PlayerRow from './lib/components/PlayerRow.svelte';
  import EvaluationBar from './lib/components/EvaluationBar.svelte';
  import BoardTools from './lib/components/BoardTools.svelte';
  import PlayPanel from './lib/components/PlayPanel.svelte';
  import StudyPanel from './lib/components/StudyPanel.svelte';
  import MoveList from './lib/components/MoveList.svelte';
  import Dialogs from './lib/components/dialogs/Dialogs.svelte';
  const session = new Session();
  const s = session.state;
  let systemDark = $state(false);
  const dark = $derived(
    s.preferences.appearance === 'dark' ||
      (s.preferences.appearance === 'system' && systemDark),
  );
  $effect(() => {
    document.documentElement.dataset.theme = dark
      ? 'chess-dark'
      : 'chess-light';
    document.documentElement.classList.toggle(
      'no-motion',
      !s.preferences.animations,
    );
  });
  onMount(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    systemDark = media.matches;
    const change = () => {
      systemDark = media.matches;
    };
    media.addEventListener('change', change);
    void session.mount().catch((error) => session.notify(String(error), true));
    return () => {
      media.removeEventListener('change', change);
      session.dispose();
    };
  });
  function shortcut(event: KeyboardEvent): void {
    const target = event.target;
    if (
      s.dialog ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (target instanceof HTMLElement &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],.review-chart',
        ))
    )
      return;
    // Character shortcuts are confined to the board widget (WCAG 2.1.4).
    if (target instanceof HTMLElement && target.closest('.board-shell')) {
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        session.flip();
        return;
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        session.navigate('home');
        return;
      }
    }
    if (target instanceof HTMLElement && target.closest('.keyboard-grid'))
      return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      session.game.jump(s.cursor - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      session.game.jump(s.cursor + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      session.game.jump(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      session.game.jump(s.record.moves.length);
    }
  }
</script>

<svelte:window
  onkeydown={shortcut}
  onbeforeunload={() => {
    if (s.loaded && (s.record.clock.running || s.saving))
      void session.storage.save();
  }}
/>
<a class="skip-link" href="#main">Skip to chess</a>
<div class="app-shell">
  <Rail {session} />
  <main id="main">
    {#if s.engineError}
      <div class="app-banner error-banner" role="alert">
        <AlertCircle size={17} />
        <p>{s.engineError}</p>
        <button
          class="btn btn-outline small-button"
          onclick={() => void session.search.restart()}
          ><RefreshCw size={14} />Restart engine</button
        >
      </div>
    {/if}
    {#if s.storageError}
      <div class="app-banner storage-banner" role="alert">
        <AlertCircle size={17} />
        <p>{s.storageError}</p>
        <button class="text-action" onclick={() => session.exportCurrent()}
          >Export game</button
        >
      </div>
    {/if}
    {#if s.view === 'home'}
      <Home {session} />
    {:else}
      <div class="workspace">
        <section class="board-column" aria-label="Board and players">
          <!-- aria-busy: the board is only interactive once the engine is ready. -->
          <div
            class="board-shell"
            aria-busy={!s.ready}
            class:has-talk={s.record.opponent === 'bot' && s.botChat.length > 0}
          >
            <PlayerRow
              {session}
              color={s.orientation === 'white' ? 'black' : 'white'}
            />
            <div class="board-frame">
              <div class="board-with-evaluation">
                {#if s.preferences.evaluation}<EvaluationBar
                    {session}
                  />{/if}<Board {session} />
              </div>
            </div>
            <PlayerRow {session} color={s.orientation} />
            <BoardTools {session} />
          </div>
        </section>
        <aside
          class="side-panel"
          aria-label={s.view === 'play'
            ? 'Game controls and moves'
            : 'Study and moves'}
        >
          {#if s.view === 'play'}<PlayPanel {session} />{:else}<StudyPanel
              {session}
            />{/if}
          <MoveList {session} />
        </aside>
      </div>
    {/if}
  </main>
</div>
<Dialogs {session} />
{#if s.notice}<div
    class="app-toast"
    class:error-toast={s.notice.error}
    role={s.notice.error ? 'alert' : 'status'}
  >
    {s.notice.text}
  </div>{/if}
