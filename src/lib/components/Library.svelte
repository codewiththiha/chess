<!-- Browse, rename, export, and delete genuine local games with explicit safeguards. -->
<script lang="ts">
  import {
    Search,
    Upload,
    Download,
    Trash2,
    Pencil,
    Check,
    X,
    ArrowRight,
    ShieldCheck,
    FolderOpen,
    ScanSearch,
  } from '@lucide/svelte';
  import { download } from '../data/files';
  import type { Session } from '../controllers/session';
  import MiniBoard from './MiniBoard.svelte';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  let query = $state('');
  let filter = $state('all');
  let renaming = $state<string | null>(null);
  let name = $state('');
  let busy = $state(false);
  let persistent = $state<boolean | null>(null);
  const filtered = $derived(
    s.library.filter(
      (g) =>
        (filter === 'all' || g.kind === filter) &&
        `${g.title} ${g.white} ${g.black}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
  );
  async function rename(id: string): Promise<void> {
    try {
      await session.storage.rename(id, name);
      renaming = null;
    } catch (e) {
      session.notify(String(e), true);
    }
  }
  async function exportAll(): Promise<void> {
    busy = true;
    try {
      download(await session.storage.exportAll(), 'gwaymaegyi-games.pgn');
      session.notify('Library exported.');
    } catch (e) {
      session.notify(String(e), true);
    } finally {
      busy = false;
    }
  }
  async function keep(): Promise<void> {
    persistent = (await navigator.storage?.persist?.()) ?? false;
    session.notify(
      persistent
        ? 'Browser granted persistent storage.'
        : 'Browser did not grant persistent storage. Keep a PGN backup.',
    );
  }
  function remove(id: string): void {
    session.confirm(
      'Delete this saved game?',
      'The game and its review will be removed from this device. Export a PGN first if you want a backup.',
      'Delete game',
      () => {
        void session
          .removeSaved(id)
          .then(() => session.notify('Game deleted.'))
          .catch((e) => session.notify(String(e), true));
      },
    );
  }
</script>

<section class="library-section">
  <div class="library-toolbar">
    <div class="library-search">
      <Search size={18} /><label class="sr-only" for="library-search"
        >Search saved games</label
      ><input
        id="library-search"
        placeholder="Search games or players"
        bind:value={query}
      />
    </div>
    <div class="library-buttons">
      <button
        class="btn btn-outline"
        onclick={() => session.openDialog('import')}
        ><Upload size={16} />Import PGN</button
      ><button
        class="btn btn-primary"
        disabled={!s.library.length || busy}
        onclick={() => void exportAll()}
        ><Download size={16} />Export all</button
      >
    </div>
  </div>
  <div class="library-filters" aria-label="Game filters">
    <button
      class:active={filter === 'all'}
      onclick={() => {
        filter = 'all';
      }}>All games <span>{s.library.length}</span></button
    ><button
      class:active={filter === 'play'}
      onclick={() => {
        filter = 'play';
      }}>Played</button
    ><button
      class:active={filter === 'analysis'}
      onclick={() => {
        filter = 'analysis';
      }}>Analysis & imports</button
    >
  </div>
  {#if !s.library.length}<div class="library-empty">
      <FolderOpen size={38} />
      <h2>Your next game belongs here.</h2>
      <p>
        Games and reviews are saved in this browser’s IndexedDB. No account, no
        server. Play a game or bring a PGN to get started.
      </p>
      <div>
        <button
          class="btn btn-primary"
          onclick={() => session.openDialog('new')}
          >Start a game<ArrowRight size={16} /></button
        ><button class="btn btn-ghost" onclick={() => session.example()}
          >Try an example game</button
        >
      </div>
    </div>
  {:else if !filtered.length}<p class="empty-search">
      No games match “{query}”. Try another player or game name.
    </p>
  {:else}<div class="game-library">
      {#each filtered as game}<article class="saved-game">
          <button
            class="mini-board-button"
            aria-label={`Review ${game.title}`}
            onclick={() => void session.openSaved(game.id)}
            ><MiniBoard
              fen={game.fen}
              pieces={s.preferences.pieces}
              theme={s.preferences.board}
            /></button
          >
          <div class="saved-game-info">
            {#if renaming === game.id}<form
                class="rename-form"
                onsubmit={(e) => {
                  e.preventDefault();
                  void rename(game.id);
                }}
              >
                <label class="sr-only" for={`rename-${game.id}`}
                  >Game name</label
                ><input
                  id={`rename-${game.id}`}
                  class="input"
                  bind:value={name}
                  maxlength="120"
                  required
                /><button
                  class="btn btn-ghost icon-button"
                  aria-label="Save game name"><Check size={17} /></button
                ><button
                  type="button"
                  class="btn btn-ghost icon-button"
                  aria-label="Cancel rename"
                  onclick={() => {
                    renaming = null;
                  }}><X size={17} /></button
                >
              </form>{:else}<button
                class="saved-game-title"
                onclick={() => void session.openSaved(game.id)}
                >{game.title}</button
              >{/if}
            <p>{game.white} <span class="muted">vs</span> {game.black}</p>
            <div class="saved-game-meta">
              <span
                >{new Date(game.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}</span
              ><span>{Math.ceil(game.plies / 2)} moves</span><span
                >{game.result === '*' ? 'In progress' : game.result}</span
              >{#if game.chess960}<span>Chess960</span>{/if}
            </div>
          </div>
          <div class="saved-game-actions">
            <button
              class="btn btn-ghost icon-button"
              aria-label={`Analyze ${game.title}`}
              title="Open analysis copy"
              onclick={() => void session.openSaved(game.id, 'analyze')}
              ><ScanSearch size={18} /></button
            ><button
              class="btn btn-ghost icon-button"
              aria-label={`Rename ${game.title}`}
              title="Rename"
              onclick={() => {
                renaming = game.id;
                name = game.title;
              }}><Pencil size={17} /></button
            ><button
              class="btn btn-ghost icon-button"
              aria-label={`Delete ${game.title}`}
              title="Delete"
              onclick={() => remove(game.id)}><Trash2 size={17} /></button
            >
          </div>
        </article>{/each}
    </div>{/if}
  <div class="storage-note">
    <ShieldCheck size={18} />
    <div>
      <strong>Only on this device.</strong>
      <p>
        Clearing browser data can remove your games. Export a PGN backup for
        anything you want to keep.
      </p>
    </div>
    <button
      class="text-action"
      onclick={() => void keep()}
      disabled={persistent === true}
      >{persistent === true
        ? 'Persistent storage granted'
        : 'Ask browser to keep games'}</button
    >
  </div>
</section>
