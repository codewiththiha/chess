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
  import CompactBar from './lib/components/CompactBar.svelte';
  import Sheet from './lib/components/Sheet.svelte';
  import { COMPACT_QUERY, fitSquare } from './lib/domain/viewport';
  const session = new Session();
  const s = session.state;
  // Decide the layout before the first paint: a phone must never show the wide
  // shell, not even for a frame, or the board is measured against the wrong one.
  if (typeof matchMedia === 'function') {
    s.compact = matchMedia(COMPACT_QUERY).matches;
    if (s.compact) document.body.dataset.compact = 'true';
  }
  let systemDark = $state(false);
  let frame: HTMLDivElement | undefined = $state();
  const talk = $derived(s.record.opponent === 'bot' && s.botChat.length > 0);
  const dark = $derived(
    s.preferences.appearance === 'dark' ||
      (s.preferences.appearance === 'system' && systemDark),
  );
  $effect(() => {
    if (s.compact) document.body.dataset.compact = 'true';
    else document.body.removeAttribute('data-compact');
  });
  $effect(() => {
    document.documentElement.dataset.theme = dark
      ? 'chess-dark'
      : 'chess-light';
    document.documentElement.classList.toggle(
      'no-motion',
      !s.preferences.animations,
    );
  });
  // A phone has no room for the card beside the board, so the shell becomes one
  // screen: board, both players, one line of state, and a control row. What will
  // not fit lives in a sheet behind the menu button.
  $effect(() => {
    const finished = s.record.result !== '*' && s.loaded;
    if (s.compact && finished && s.view === 'play' && !s.dialog)
      s.sheet = 'panel';
  });
  // Fit the board to the space the column actually leaves, on both axes. The
  // result depends on the frame's size and nothing else, so the board can never
  // ask the page to scroll — and nothing here reacts to a move, so the page
  // cannot shift under the reader mid-game.
  $effect(() => {
    const node = frame;
    const compact = s.compact;
    // Read the preference here too: the rail lives inside the frame, so turning
    // it on changes what the board may use without changing the frame's size.
    const railShown = s.preferences.evaluation;
    const paint = () => {
      if (!node || !compact) {
        node?.style.removeProperty('--board-size');
        return;
      }
      const wrap = node.firstElementChild;
      const rail = railShown ? wrap?.querySelector('.evaluation-rail') : null;
      const gap = wrap
        ? Number.parseFloat(getComputedStyle(wrap).columnGap)
        : 0;
      const extra =
        rail && Number.isFinite(gap)
          ? rail.getBoundingClientRect().width + gap
          : 0;
      const size = fitSquare(node.clientWidth, node.clientHeight, extra);
      if (size <= 0) return;
      const next = `${size}px`;
      if (node.style.getPropertyValue('--board-size') !== next)
        node.style.setProperty('--board-size', next);
    };
    paint();
    if (!node || !compact) return;
    // The frame is sized by its parents and by nothing inside it, so this
    // measurement can never feed back into the layout it measures.
    const observer = new ResizeObserver(paint);
    observer.observe(node);
    return () => observer.disconnect();
  });
  onMount(() => {
    const compact = matchMedia(COMPACT_QUERY);
    const syncCompact = () => {
      s.compact = compact.matches;
    };
    syncCompact();
    compact.addEventListener('change', syncCompact);
    const media = matchMedia('(prefers-color-scheme: dark)');
    systemDark = media.matches;
    const change = () => {
      systemDark = media.matches;
    };
    media.addEventListener('change', change);
    void session.mount().catch((error) => session.notify(String(error), true));
    return () => {
      compact.removeEventListener('change', syncCompact);
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
          <div class="board-shell" aria-busy={!s.ready} class:has-talk={talk}>
            <PlayerRow
              {session}
              color={s.orientation === 'white' ? 'black' : 'white'}
            />
            <div class="board-frame" bind:this={frame}>
              <div class="board-with-evaluation">
                {#if s.preferences.evaluation}<EvaluationBar
                    {session}
                  />{/if}<Board {session} />
              </div>
            </div>
            <PlayerRow {session} color={s.orientation} />
            {#if !s.compact}<BoardTools {session} />{/if}
          </div>
        </section>
        {#if s.compact}
          <CompactBar {session} />
        {:else}
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
        {/if}
      </div>
      {#if s.compact && s.sheet === 'panel'}
        <Sheet
          title={s.view === 'play' ? 'Game and moves' : 'Study and moves'}
          onclose={() => (s.sheet = null)}
        >
          {#if s.view === 'play'}
            <PlayPanel {session} status={false} />
          {:else}
            <StudyPanel {session} notice={false} />
          {/if}
          <MoveList {session} />
          <div class="sheet-tools">
            <BoardTools {session} nav={false} />
          </div>
        </Sheet>
      {/if}
    {/if}
  </main>
</div>
<Dialogs {session} />
{#if s.notice && (s.view === 'home' || s.notice.error)}<div
    class="app-toast"
    class:error-toast={s.notice.error}
    role={s.notice.error ? 'alert' : 'status'}
  >
    {s.notice.text}
  </div>{/if}
