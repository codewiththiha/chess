<!-- Choose a time control, start a game, and browse the games saved on this device. -->
<script lang="ts">
  import {
    Download,
    Pencil,
    Play,
    ScanSearch,
    Trash2,
    Upload,
    Check,
    X,
    Zap,
    Timer,
    Hourglass,
    Infinity as InfinityIcon,
    SlidersHorizontal,
    FolderOpen,
    Plus,
  } from '@lucide/svelte';
  import {
    TIME_CONTROL_GROUPS,
    TIME_LIMITS,
    UNTIMED,
    sameTimeControl,
  } from '../domain/time-controls';
  import type { TimeControl } from '../domain/time-controls';
  import { resultText } from '../domain/games';
  import { botSummary, orderedBots } from '../domain/bots';
  import { voiceById } from '../domain/chat';
  import { exportPgn } from '../domain/pgn';
  import { download } from '../data/files';
  import MiniBoard from './MiniBoard.svelte';
  import Sheet from './Sheet.svelte';
  import type { Session } from '../controllers/session';
  import type { Color, Opponent, Result } from '../domain/types';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
  const icons: Record<string, typeof Timer> = {
    bullet: Zap,
    blitz: Timer,
    rapid: Hourglass,
  };
  let selected = $state<TimeControl>({
    minutes: 5,
    increment: 0,
    label: '5 min',
  });
  let custom = $state(false);
  let untimed = $state(false);
  let minutes = $state(10);
  let increment = $state(0);
  let side = $state<Color | 'random'>('white');
  let opponent = $state<Opponent>('bot');
  let chess960 = $state(false);
  let position = $state(518);
  let query = $state('');
  // On a phone the saved games live in a sheet, so the picker and the primary
  // action keep the whole screen for themselves.
  let gamesOpen = $state(false);
  let renaming = $state<string | null>(null);
  let name = $state('');
  const chosen = $derived<TimeControl>(
    custom
      ? {
          minutes: Number(minutes),
          increment: Number(increment),
          label: 'Custom',
        }
      : selected,
  );
  const invalid = $derived(
    custom &&
      !untimed &&
      (!Number.isFinite(chosen.minutes) ||
        chosen.minutes < 1 ||
        chosen.minutes > TIME_LIMITS.minutes ||
        !Number.isFinite(chosen.increment) ||
        chosen.increment < 0 ||
        chosen.increment > TIME_LIMITS.increment),
  );
  const control = $derived(untimed ? UNTIMED : chosen);
  // Shipped bots first in their published order, then the reader's own by Elo.
  const bots = $derived(orderedBots(s.bots));
  const bot = $derived(s.selectedBot);
  const games = $derived(
    s.library.filter((game) =>
      `${game.title} ${game.white} ${game.black}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  function start(): void {
    if (invalid) return;
    session.startGame({
      // A two-player board has no engine side, so the reader is White.
      side: opponent === 'human' ? 'white' : side,
      minutes: control.minutes,
      increment: control.increment,
      chess960,
      position: chess960
        ? Math.min(959, Math.max(0, Number(position) || 0))
        : 518,
      opponent,
      botId: opponent === 'bot' ? (bot?.id ?? null) : null,
    });
  }
  function pick(preset: TimeControl): void {
    selected = preset;
    custom = false;
    untimed = false;
  }
  async function rename(id: string): Promise<void> {
    try {
      await session.storage.rename(id, name);
      renaming = null;
    } catch (error) {
      session.notify(String(error), true);
    }
  }
  function remove(id: string): void {
    session.confirm(
      'Delete this saved game?',
      'The game and its review are removed from this device. Export a PGN first if you want a backup.',
      'Delete game',
      () => {
        void session
          .removeSaved(id)
          .then(() => session.notify('Game deleted.'))
          .catch((error) => session.notify(String(error), true));
      },
    );
  }
  async function exportOne(id: string): Promise<void> {
    try {
      const record = await session.storage.db.game(id);
      if (record) download(exportPgn(record), `${record.title}.pgn`);
    } catch (error) {
      session.notify(String(error), true);
    }
  }
</script>

<div class="home">
  <h1 class="sr-only">gwaymaegyi chess</h1>
  <section class="home-start" aria-label="New game">
    <div class="home-options">
      <div class="time-groups">
        {#each TIME_CONTROL_GROUPS as group}
          {@const Icon = icons[group.id] ?? Timer}
          <div class="time-group">
            <div class="time-group-head">
              <Icon size={17} />
              <div>
                <strong>{group.label}</strong>
                <span>{group.detail}</span>
              </div>
            </div>
            <div class="time-chips">
              {#each group.options as option}
                {@const active =
                  !untimed && !custom && sameTimeControl(selected, option)}
                <button
                  class="time-chip"
                  class:active
                  onclick={() => pick(option)}>{option.label}</button
                >
              {/each}
            </div>
          </div>
        {/each}
        <div class="time-group">
          <div class="time-group-head">
            <InfinityIcon size={17} />
            <div>
              <strong>Untimed</strong>
              <span>No clocks</span>
            </div>
          </div>
          <div class="time-chips">
            <button
              class="time-chip"
              class:active={untimed}
              onclick={() => {
                untimed = true;
                custom = false;
              }}>No clock</button
            >
          </div>
        </div>
      </div>
      <div class="start-row">
        <div class="custom-control">
          <button
            class="time-chip"
            class:active={custom}
            aria-pressed={custom}
            onclick={() => {
              custom = true;
              untimed = false;
            }}><SlidersHorizontal size={14} />Custom</button
          >
          <input
            type="number"
            min="1"
            max={TIME_LIMITS.minutes}
            step="1"
            bind:value={minutes}
            aria-label="Custom minutes"
          /><span class="unit">min</span>
          <input
            type="number"
            min="0"
            max={TIME_LIMITS.increment}
            step="1"
            bind:value={increment}
            aria-label="Custom increment seconds"
          /><span class="unit">+ s</span>
        </div>
        <div class="segmented" role="group" aria-label="Opponent">
          <button
            class:active={opponent === 'bot'}
            aria-pressed={opponent === 'bot'}
            onclick={() => {
              opponent = 'bot';
            }}>Play a bot</button
          ><button
            class:active={opponent === 'human'}
            aria-pressed={opponent === 'human'}
            onclick={() => {
              opponent = 'human';
            }}>Two players</button
          >
        </div>
        {#if opponent === 'bot'}
          <div class="segmented" role="group" aria-label="Your side">
            {#each [['white', 'White'], ['black', 'Black'], ['random', 'Any']] as option}
              <button
                class:active={side === option[0]}
                aria-pressed={side === option[0]}
                onclick={() => {
                  side = option[0] as Color | 'random';
                }}>{option[1]}</button
              >
            {/each}
          </div>
        {/if}
        <label class="chess960-toggle"
          ><input type="checkbox" bind:checked={chess960} /> Chess960</label
        >
        {#if opponent === 'bot'}
          <div class="bot-picker" role="group" aria-label="Bot">
            {#each bots as option (option.id)}
              <span class="bot-card" class:active={option.id === bot?.id}>
                <button
                  type="button"
                  class="bot-pick"
                  aria-pressed={option.id === bot?.id}
                  title={`${option.blurb ? `${option.blurb} ` : ''}${voiceById(option.voice).about}`}
                  onclick={() => session.selectBot(option.id)}
                  ><span class="bot-identity"
                    >{#if option.avatar}<img
                        class="bot-pfp"
                        src={option.avatar}
                        alt=""
                      />{/if}<span class="bot-name">{option.name}</span></span
                  ><span class="bot-meta"
                    ><span class="bot-strength-label">{botSummary(option)}</span
                    ><span class="bot-voice-label"
                      >{voiceById(option.voice).name}</span
                    ></span
                  ></button
                >{#if option.category === 'custom'}<button
                    type="button"
                    class="bot-edit"
                    aria-label={`Edit ${option.name}`}
                    onclick={() => session.openBotDialog(option)}
                    ><Pencil size={13} /></button
                  >{/if}
              </span>
            {/each}
            <button
              type="button"
              class="bot-card bot-new"
              onclick={() => session.openBotDialog(null)}
              ><Plus size={15} />Add bot</button
            >
          </div>
        {/if}
        {#if chess960}<input
            class="position-input"
            type="number"
            min="0"
            max="959"
            bind:value={position}
            aria-label="Chess960 start position"
          />{/if}
      </div>
    </div>
    <div class="start-dock">
      {#if invalid}
        <p class="inline-error" role="alert">
          1–{TIME_LIMITS.minutes} minutes and 0–{TIME_LIMITS.increment} seconds.
        </p>
      {/if}
      <button
        class="btn btn-outline small-button games-toggle"
        data-games-toggle
        onclick={() => (gamesOpen = true)}
        ><FolderOpen size={15} />Your games{#if s.library.length}<span
            class="games-count">{s.library.length}</span
          >{/if}</button
      >
      <button
        class="btn btn-primary start-button"
        disabled={invalid}
        onclick={start}><Play size={17} />Start</button
      >
    </div>
  </section>
  {#snippet gamesPanel()}
    <section class="home-games" aria-label="Saved games">
      <div class="games-head">
        <div class="library-search">
          <label class="sr-only" for="library-search">Search saved games</label
          ><input
            id="library-search"
            placeholder="Search games"
            bind:value={query}
          />
        </div>
        <button
          class="btn btn-ghost small-button"
          onclick={() => session.openDialog('import')}
          ><Upload size={15} />Import</button
        >
        <button
          class="btn btn-ghost small-button"
          disabled={!s.library.length}
          onclick={() => void session.exportAll()}
          ><Download size={15} />Export all</button
        >
      </div>
      {#if !games.length}
        <p class="games-empty">
          {s.library.length
            ? 'No saved game matches that search.'
            : 'Played games and imported PGNs appear here with their reviews.'}
        </p>
      {:else}
        <ul class="saved-games">
          {#each games as game (game.id)}
            <li class="saved-game">
              <MiniBoard
                fen={game.plies ? game.fen : s.record.startFen}
                pieces={s.preferences.pieces}
                theme={s.preferences.board}
              />
              <div class="saved-meta">
                {#if renaming === game.id}
                  <div class="rename-row">
                    <input
                      aria-label="Game name"
                      bind:value={name}
                      onkeydown={(event) => {
                        if (event.key === 'Enter') void rename(game.id);
                      }}
                    />
                    <button
                      class="icon-action"
                      aria-label="Save game name"
                      onclick={() => void rename(game.id)}
                      ><Check size={15} /></button
                    >
                    <button
                      class="icon-action"
                      aria-label="Cancel rename"
                      onclick={() => {
                        renaming = null;
                      }}><X size={15} /></button
                    >
                  </div>
                {:else}
                  <strong>{game.title}</strong>
                  <span class="saved-detail">
                    {game.white} vs {game.black} · {Math.ceil(game.plies / 2)}
                    {Math.ceil(game.plies / 2) === 1 ? 'move' : 'moves'} ·
                    {game.result === '*'
                      ? 'unfinished'
                      : resultText(game.result as Result)}
                  </span>
                {/if}
              </div>
              {#if game.reviewComplete}
                <span class="reviewed-badge">Reviewed</span>
              {/if}
              <div class="saved-actions">
                <button
                  class="icon-action"
                  aria-label={`Open ${game.title}`}
                  title="Open"
                  onclick={() => void session.openSaved(game.id, 'play')}
                  ><Play size={15} /></button
                >
                <button
                  class="icon-action"
                  aria-label={`Study ${game.title}`}
                  title="Study"
                  onclick={() => void session.openSaved(game.id, 'study')}
                  ><ScanSearch size={15} /></button
                >
                <button
                  class="icon-action"
                  aria-label={`Export ${game.title}`}
                  title="Export PGN"
                  onclick={() => void exportOne(game.id)}
                  ><Download size={15} /></button
                >
                <button
                  class="icon-action"
                  aria-label={`Rename ${game.title}`}
                  title="Rename"
                  onclick={() => {
                    renaming = game.id;
                    name = game.title;
                  }}><Pencil size={15} /></button
                >
                <button
                  class="icon-action danger"
                  aria-label={`Delete ${game.title}`}
                  title="Delete"
                  onclick={() => remove(game.id)}><Trash2 size={15} /></button
                >
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/snippet}
  {#if !s.compact}
    {@render gamesPanel()}
  {/if}
</div>

{#if s.compact && gamesOpen}
  <Sheet title="Your games" onclose={() => (gamesOpen = false)}>
    {@render gamesPanel()}
  </Sheet>
{/if}
