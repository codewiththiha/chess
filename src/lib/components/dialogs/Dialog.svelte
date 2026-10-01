<!-- Use a native modal for focus trapping, Escape, backdrop dismissal, and focus restoration. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  let {
    title,
    subtitle = '',
    wide = false,
    canClose = true,
    onclose,
    children,
  }: {
    title: string;
    subtitle?: string;
    wide?: boolean;
    canClose?: boolean;
    onclose: () => void;
    children: Snippet;
  } = $props();
  let element: HTMLDialogElement;
  onMount(() => {
    const previous = document.activeElement;
    element.showModal();
    const backdrop = (event: MouseEvent) => {
      if (event.target === element && canClose) onclose();
    };
    element.addEventListener('click', backdrop);
    return () => {
      element.removeEventListener('click', backdrop);
      element.close();
      if (previous instanceof HTMLElement)
        previous.focus({ preventScroll: true });
    };
  });
</script>

<dialog
  class="modal"
  bind:this={element}
  aria-labelledby="dialog-title"
  oncancel={(e) => {
    e.preventDefault();
    if (canClose) onclose();
  }}
>
  <div class="modal-box" class:wide>
    <div class="dialog-heading">
      <div>
        <h2 id="dialog-title">{title}</h2>
        {#if subtitle}<p>{subtitle}</p>{/if}
      </div>
      <button
        type="button"
        class="btn btn-ghost icon-button"
        aria-label="Close dialog"
        disabled={!canClose}
        onclick={onclose}><X size={20} /></button
      >
    </div>
    {@render children()}
  </div>
</dialog>
