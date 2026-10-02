<!-- Create or change one locally stored bot: name, strength, style, and picture. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ImagePlus, Trash2 } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import {
    BOT_BLURB_MAX,
    BOT_NAME_MAX,
    botSummary,
    validateBot,
    type BotProfile,
  } from '../../domain/bots';
  import { ELO_MAX, ELO_MIN } from '../../domain/strength';
  import { readPicture } from '../../data/files';
  import type { EngineMode } from '../../domain/types';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  let draft = $state<BotProfile | null>(null);
  let busy = $state(false);
  let error = $state('');
  // Editing means the draft already exists in the library, not that it is custom.
  const editing = $derived(
    Boolean(draft && session.state.bots.some((bot) => bot.id === draft?.id)),
  );
  const styles: { id: EngineMode; name: string }[] = [
    { id: 'balanced', name: 'Balanced' },
    { id: 'aggressive', name: 'Attacking' },
    { id: 'human-like', name: 'Human-like' },
  ];
  onMount(() => {
    draft = session.state.draftBot ?? null;
  });
  async function picture(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !draft) return;
    try {
      draft.avatar = await readPicture(file);
      error = '';
    } catch (e) {
      error = String(e);
    } finally {
      input.value = '';
    }
  }
  async function save(): Promise<void> {
    if (!draft) return;
    busy = true;
    try {
      validateBot(draft);
      await session.saveBot($state.snapshot(draft));
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog
  title={editing ? 'Edit this bot.' : 'Add a bot.'}
  subtitle="Strength, style, and a picture stay on this device."
  canClose={!busy}
  onclose={() => session.closeDialog()}
  ><form
    class="bot-form"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    {#if draft}
      <div class="bot-identity">
        <label class="bot-picture">
          <span class="sr-only">Bot picture</span>
          <input type="file" accept="image/*" onchange={picture} />
          {#if draft.avatar}<img src={draft.avatar} alt="" />{:else}<ImagePlus
              size={20}
            />{/if}
        </label>
        <div class="bot-fields">
          <label
            >Name<input
              type="text"
              maxlength={BOT_NAME_MAX}
              required
              placeholder="Rook Robot"
              bind:value={draft.name}
            /></label
          >
          <label
            >Description<input
              type="text"
              maxlength={BOT_BLURB_MAX}
              placeholder="Plays fast, trades early."
              bind:value={draft.blurb}
            /></label
          >
        </div>
        {#if draft.avatar}<button
            type="button"
            class="btn btn-ghost small-button"
            onclick={() => {
              if (draft) draft.avatar = null;
            }}><Trash2 size={15} />Remove picture</button
          >{/if}
      </div>
      <fieldset>
        <legend>Style</legend>
        <div class="bot-styles">
          {#each styles as style}<button
              type="button"
              class:active={draft.mode === style.id}
              aria-pressed={draft.mode === style.id}
              onclick={() => {
                if (draft) draft.mode = style.id;
              }}>{style.name}</button
            >{/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Strength</legend>
        <div class="bot-strength">
          <button
            type="button"
            class:active={draft.strength === 'elo'}
            aria-pressed={draft.strength === 'elo'}
            onclick={() => {
              if (draft) draft.strength = 'elo';
            }}>Nominal Elo</button
          ><button
            type="button"
            class:active={draft.strength === 'full'}
            aria-pressed={draft.strength === 'full'}
            onclick={() => {
              if (draft) draft.strength = 'full';
            }}>Full strength</button
          >
          <input
            type="number"
            min={ELO_MIN}
            max={ELO_MAX}
            step="50"
            aria-label="Bot Elo"
            disabled={draft.strength === 'full'}
            bind:value={draft.elo}
          />
          <span class="bot-summary">{botSummary(draft)}</span>
        </div>
      </fieldset>
      {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
      <div class="dialog-footer">
        {#if editing}<button
            type="button"
            class="btn btn-ghost"
            disabled={busy}
            onclick={() => void session.deleteBot(draft?.id ?? '')}
            ><Trash2 size={15} />Delete</button
          >{/if}
        <button
          type="button"
          class="btn btn-ghost"
          disabled={busy}
          onclick={() => session.closeDialog()}>Cancel</button
        >
        <button type="submit" class="btn btn-primary" disabled={busy}>
          Save bot
        </button>
      </div>
    {/if}
  </form></Dialog
>
