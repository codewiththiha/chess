<!-- Offer actual licensed SVG sets, board finishes, and independent board-aid preferences. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Sun, Moon, Monitor } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import { defaultPreferences } from '../../domain/preferences';
  import type { Preferences } from '../../domain/types';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  let draft = $state<Preferences>(defaultPreferences());
  let busy = $state(false);
  let error = $state('');
  const boards = [
    { id: 'sage', name: 'Sage' },
    { id: 'walnut', name: 'Walnut' },
    { id: 'ocean', name: 'Ocean' },
    { id: 'slate', name: 'Graphite' },
  ] as const;
  const sets = [
    { id: 'chessnut', name: 'Chessnut', by: 'Alexis Luengas · Apache 2.0' },
    { id: 'celtic', name: 'Celtic', by: 'Maurizio Monge · MIT' },
    { id: 'cburnett', name: 'Classic', by: 'Colin M. L. Burnett · GPLv2+' },
  ] as const;
  const aids = [
    {
      key: 'animations',
      title: 'Piece animations',
      detail: 'Move pieces smoothly between squares.',
    },
    {
      key: 'sound',
      title: 'Move sounds',
      detail: 'A quiet cue after a move or capture.',
    },
    {
      key: 'coordinates',
      title: 'Board coordinates',
      detail: 'Show ranks and files.',
    },
    {
      key: 'legalMoves',
      title: 'Legal destinations',
      detail: 'Show where a selected piece can go.',
    },
    {
      key: 'lastMove',
      title: 'Last-move highlight',
      detail: 'Keep the previous move visible.',
    },
    {
      key: 'check',
      title: 'Check highlight',
      detail: 'Mark a king that is in check.',
    },
    {
      key: 'arrows',
      title: 'Study arrows',
      detail: 'Draw suggestion arrows in study, never during play.',
    },
    {
      key: 'premove',
      title: 'Premoves',
      detail: 'Queue a move while the engine is thinking.',
    },
    {
      key: 'speech',
      title: 'Opponent speech',
      detail: 'Let the character say its lines out loud.',
    },
    {
      key: 'evaluation',
      title: 'Evaluation rail',
      detail: 'A compact, signed position evaluation.',
    },
  ] as const;
  /** Theme applies the moment it is picked; Cancel puts the saved value back. */
  let original = $state<Preferences | null>(null);
  function previewAppearance(value: Preferences['appearance']): void {
    draft.appearance = value;
    session.state.preferences.appearance = value;
  }
  function restore(): void {
    if (original) session.state.preferences.appearance = original.appearance;
  }
  onMount(() => {
    const saved = session.state.preferenceSnapshot();
    original = saved;
    draft = { ...saved };
  });
  async function apply(): Promise<void> {
    busy = true;
    try {
      await session.applyPreferences(
        $state.snapshot(draft),
        'Appearance saved.',
      );
      original = session.state.preferenceSnapshot();
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
  function close(): void {
    restore();
    session.closeDialog();
  }
</script>

<Dialog
  title="Make the board yours."
  subtitle="A few considered choices. Nothing to download."
  wide
  canClose={!busy}
  onclose={close}
  ><form
    class="appearance-form"
    onsubmit={(e) => {
      e.preventDefault();
      void apply();
    }}
  >
    <fieldset>
      <legend>Board finish</legend>
      <div class="board-choices">
        {#each boards as board}<button
            type="button"
            class:chosen={draft.board === board.id}
            aria-pressed={draft.board === board.id}
            onclick={() => {
              draft.board = board.id;
            }}
            ><span class="board-swatch board-{board.id}"
              ><i></i><i></i><i></i><i></i></span
            ><span>{board.name}</span></button
          >{/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>Pieces</legend>
      <div class="piece-choices">
        {#each sets as set}<button
            type="button"
            class:chosen={draft.pieces === set.id}
            aria-pressed={draft.pieces === set.id}
            onclick={() => {
              draft.pieces = set.id;
            }}
            ><span class="piece-atlas"
              >{#each ['wK', 'wN', 'wB', 'bQ', 'bP'] as piece}<img
                  src={`${import.meta.env.BASE_URL}pieces/${set.id}/${piece}.svg`}
                  alt=""
                />{/each}</span
            ><span class="piece-set-name"
              >{set.name}<small>{set.by}</small></span
            >{#if draft.pieces === set.id}<Check size={16} />{/if}</button
          >{/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>Appearance</legend>
      <div class="segmented-control theme-choices">
        <button
          type="button"
          class:chosen={draft.appearance === 'light'}
          onclick={() => previewAppearance('light')}
          ><Sun size={16} />Light</button
        ><button
          type="button"
          class:chosen={draft.appearance === 'dark'}
          onclick={() => previewAppearance('dark')}
          ><Moon size={16} />Dark</button
        ><button
          type="button"
          class:chosen={draft.appearance === 'system'}
          onclick={() => previewAppearance('system')}
          ><Monitor size={16} />System</button
        >
      </div>
    </fieldset>
    <fieldset>
      <legend>Board aids & motion</legend>
      <div class="aid-switches">
        {#each aids as aid}<label
            class="toggle-row"
            for={`appearance-${aid.key}`}
            ><span
              ><strong>{aid.title}</strong><small
                id={`appearance-note-${aid.key}`}>{aid.detail}</small
              ></span
            ><input
              id={`appearance-${aid.key}`}
              aria-label={aid.title}
              aria-describedby={`appearance-note-${aid.key}`}
              class="toggle toggle-primary"
              type="checkbox"
              bind:checked={draft[aid.key]}
            /></label
          >{/each}
      </div>
      <div class="arrow-count">
        <label for="arrow-count"
          >Study arrows<strong>{draft.arrowCount}</strong></label
        >
        <input
          id="arrow-count"
          class="range range-primary"
          type="range"
          min="1"
          max="4"
          step="1"
          aria-label="Study arrow count"
          bind:value={draft.arrowCount}
        />
        <p class="fine-print">
          Review still shows exactly one stored move, whatever this is set to.
        </p>
      </div>
      <p class="fine-print">
        Reduced-motion system preferences always take priority over piece
        animations, and bullet games never animate. Sound is off by default.
      </p>
    </fieldset>
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    <div class="dialog-footer">
      <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button
      ><button class="btn btn-primary" disabled={busy}
        ><Check size={16} />Save appearance</button
      >
    </div>
  </form></Dialog
>
