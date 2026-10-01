<!-- Configure real side, clocks, and Scharnagl Chess960 starts before replacing a game. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Swords, Shuffle } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import { DEFAULT_NEW_GAME } from '../../domain/games';
  import type { NewGameOptions } from '../../domain/types';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  let options = $state<NewGameOptions>({ ...DEFAULT_NEW_GAME });
  let error = $state('');
  const times = [
    { label: '3 + 2', minutes: 3, increment: 2 },
    { label: '5 + 3', minutes: 5, increment: 3 },
    { label: '10 + 0', minutes: 10, increment: 0 },
    { label: '15 + 10', minutes: 15, increment: 10 },
    { label: 'Untimed', minutes: 0, increment: 0 },
  ];
  onMount(() => {
    const r = session.state.record;
    options = {
      side: r.human,
      minutes: r.clock.initialMs / 60000,
      increment: r.clock.incrementMs / 1000,
      chess960: r.chess960,
      position: Number(r.headers.FRCPosition ?? 518),
    };
  });
  function start(): void {
    try {
      session.game.create(options);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<Dialog
  title="A fresh game."
  subtitle="Choose your side and make a little time for chess."
  onclose={() => session.closeDialog()}
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      start();
    }}
    class="dialog-form"
  >
    <fieldset>
      <legend>Your pieces</legend>
      <div class="side-choice">
        <button
          type="button"
          class:chosen={options.side === 'white'}
          aria-pressed={options.side === 'white'}
          onclick={() => {
            options.side = 'white';
          }}
          ><img
            src={`${import.meta.env.BASE_URL}pieces/chessnut/wK.svg`}
            alt=""
          />White</button
        ><button
          type="button"
          class:chosen={options.side === 'random'}
          aria-pressed={options.side === 'random'}
          onclick={() => {
            options.side = 'random';
          }}><Shuffle size={25} />Random</button
        ><button
          type="button"
          class:chosen={options.side === 'black'}
          aria-pressed={options.side === 'black'}
          onclick={() => {
            options.side = 'black';
          }}
          ><img
            src={`${import.meta.env.BASE_URL}pieces/chessnut/bK.svg`}
            alt=""
          />Black</button
        >
      </div>
    </fieldset>
    <fieldset>
      <legend>Time on the clock</legend>
      <div class="time-presets">
        {#each times as time}<button
            type="button"
            class:chosen={options.minutes === time.minutes &&
              options.increment === time.increment}
            onclick={() => {
              options.minutes = time.minutes;
              options.increment = time.increment;
            }}>{time.label}</button
          >{/each}
      </div>
      <div class="field-pair">
        <label for="game-minutes"
          >Minutes<input
            id="game-minutes"
            class="input"
            type="number"
            min="0"
            max="180"
            step="0.5"
            required
            bind:value={options.minutes}
          /></label
        ><label for="game-increment"
          >Increment, seconds<input
            id="game-increment"
            class="input"
            type="number"
            min="0"
            max="120"
            step="1"
            required
            bind:value={options.increment}
          /></label
        >
      </div>
    </fieldset>
    <label class="toggle-row" for="game-960"
      ><span
        ><strong>Chess960</strong><small id="game-960-note"
          >A different back rank, the same game.</small
        ></span
      ><input
        id="game-960"
        aria-label="Chess960"
        aria-describedby="game-960-note"
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={options.chess960}
      /></label
    >
    {#if options.chess960}<div class="field-pair">
        <label for="position-number"
          >Position number (0–959)<input
            id="position-number"
            class="input"
            type="number"
            min="0"
            max="959"
            step="1"
            required
            bind:value={options.position}
          /></label
        ><button
          type="button"
          class="btn btn-outline random-position"
          onclick={() => {
            options.position =
              (crypto.getRandomValues(new Uint16Array(1))[0] ?? 0) % 960;
          }}><Shuffle size={16} />Random start</button
        >
      </div>{/if}
    <p class="fine-print">
      {session.state.record.moves.length && session.state.record.result === '*'
        ? 'Your current game remains in the local library. '
        : ''}Engine strength and personality are adjustable in Engine settings.
    </p>
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    <div class="dialog-footer">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => session.closeDialog()}>Cancel</button
      ><button class="btn btn-primary"><Swords size={17} />Start game</button>
    </div>
  </form>
</Dialog>
