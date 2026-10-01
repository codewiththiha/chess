<!-- Compose the board-first application; lifecycle and actions live in dedicated controllers. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShieldCheck,
    ArrowRight,
    AlertCircle,
    RefreshCw,
    Upload,
    CircleHelp,
  } from '@lucide/svelte';
  import { Session } from './lib/controllers/session';
  import Navigation from './lib/components/Navigation.svelte';
  import Board from './lib/components/Board.svelte';
  import PlayerRow from './lib/components/PlayerRow.svelte';
  import EvaluationBar from './lib/components/EvaluationBar.svelte';
  import BoardTools from './lib/components/BoardTools.svelte';
  import PlayPanel from './lib/components/PlayPanel.svelte';
  import AnalysisPanel from './lib/components/AnalysisPanel.svelte';
  import ReviewPanel from './lib/components/ReviewPanel.svelte';
  import MoveList from './lib/components/MoveList.svelte';
  import Library from './lib/components/Library.svelte';
  import Dialogs from './lib/components/dialogs/Dialogs.svelte';
  const session = new Session();
  const s = session.state;
  let systemDark = $state(false);
  const dark = $derived(
    s.preferences.appearance === 'dark' ||
      (s.preferences.appearance === 'system' && systemDark),
  );
  const heading = $derived(
    s.view === 'library'
      ? 'Your chess, kept here.'
      : s.view === 'review'
        ? 'A second look.'
        : s.view === 'analyze'
          ? 'Follow the position.'
          : s.record.result !== '*'
            ? 'The game is complete.'
            : s.paused
              ? 'Pick up where you left off.'
              : s.pos.turn !== s.record.human
                ? 'gwaymaegyi’s move.'
                : 'Your move.',
  );
  const subtitle = $derived(
    s.view === 'library'
      ? 'A collection of games, not a cloud account.'
      : s.view === 'review'
        ? 'Find the turning points. Make the next game a little better.'
        : s.view === 'analyze'
          ? 'Move either side. Try an idea. Let the engine take a look.'
          : s.record.chess960
            ? 'Chess960. A familiar game, a different beginning.'
            : 'Play at your pace. Your games stay on this device.',
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
    void session.mount().catch((e) => session.notify(String(e), true));
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
        session.openDialog('new');
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
  <Navigation {session} />
  <main id="main" class="main-content">
    <div class="workspace-heading">
      <div>
        <h1>{heading}</h1>
        <p>{subtitle}</p>
      </div>
      <div class="workspace-heading-action">
        {#if s.view === 'review' || s.view === 'analyze'}<button
            class="btn btn-outline"
            onclick={() => session.openDialog('import')}
            ><Upload size={16} />Import PGN</button
          >{:else}<span class="local-engine-badge" class:ready={s.ready}
            ><span class="status-dot"></span>{s.ready
              ? 'Local engine'
              : s.engineError
                ? 'Engine offline'
                : 'Loading engine'}</span
          >{/if}
      </div>
    </div>
    {#if s.engineError}<div class="app-banner error-banner" role="alert">
        <AlertCircle size={18} />
        <div>
          <strong>Engine needs attention</strong>
          <p>{s.engineError}</p>
        </div>
        <button
          class="btn btn-outline small-button"
          onclick={() => void session.search.restart()}
          ><RefreshCw size={15} />Restart engine</button
        >
      </div>{/if}
    {#if s.storageError}<div class="app-banner storage-banner" role="alert">
        <AlertCircle size={18} />
        <p>{s.storageError}</p>
        <button class="text-action" onclick={() => session.exportCurrent()}
          >Export game</button
        >
      </div>{/if}
    {#if s.view === 'library'}<Library {session} />{:else}
      <div class="chess-workspace">
        <section class="board-column" aria-label="Board and players">
          <div class="board-shell">
            <PlayerRow
              {session}
              color={s.orientation === 'white' ? 'black' : 'white'}
            />
            <div class="board-with-evaluation">
              {#if s.preferences.evaluation}<EvaluationBar
                  {session}
                />{/if}<Board {session} />
            </div>
            <PlayerRow {session} color={s.orientation} /><BoardTools
              {session}
            />
            <div class="board-caption">
              <span
                >{s.pos.isCheck()
                  ? 'Check'
                  : s.view === 'review'
                    ? `Position ${s.cursor} of ${s.record.moves.length}`
                    : s.pos.turn === 'white'
                      ? 'White to move'
                      : 'Black to move'}</span
              ><button onclick={() => session.openDialog('help')}
                >Tap or drag · keyboard friendly<CircleHelp size={13} /></button
              >
            </div>
          </div>
        </section>
        <aside
          class="side-panel"
          aria-label={s.view === 'play'
            ? 'Game controls and moves'
            : s.view === 'analyze'
              ? 'Engine analysis and moves'
              : 'Game review and moves'}
        >
          {#if s.view === 'play'}<PlayPanel {session} /><MoveList
              {session}
            />{:else if s.view === 'analyze'}<AnalysisPanel
              {session}
            /><MoveList {session} />{:else}<ReviewPanel {session} /><MoveList
              {session}
            />{/if}
        </aside>
      </div>
    {/if}
    <footer class="app-footer">
      <span><ShieldCheck size={14} />No account. No uploads. Just chess.</span
      ><button onclick={() => session.openDialog('help')}
        >About & credits<ArrowRight size={13} /></button
      >
    </footer>
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
