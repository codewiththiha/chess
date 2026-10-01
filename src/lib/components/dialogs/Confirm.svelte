<!-- Require a deliberate confirmation for destructive game/library actions. -->
<script lang="ts">
  import Dialog from './Dialog.svelte';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
</script>

{#if s.confirmation}<Dialog
    title={s.confirmation.title}
    onclose={() => session.closeDialog()}
    ><p class="confirmation-detail">{s.confirmation.detail}</p>
    <div class="dialog-footer">
      <button class="btn btn-ghost" onclick={() => session.closeDialog()}
        >Cancel</button
      ><button
        class="btn btn-error"
        onclick={() => {
          const action = s.confirmation?.action;
          session.closeDialog();
          action?.();
        }}>{s.confirmation.label}</button
      >
    </div></Dialog
  >{/if}
