<!-- A bottom sheet: what will not fit on a phone screen, one tap away. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { ChevronDown } from '@lucide/svelte';
  let {
    title,
    onclose,
    children,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
  } = $props();
  let element: HTMLDialogElement;
  // The native modal gives the trap, Escape, backdrop dismissal, and focus
  // restoration for free; the styling is what makes it rise from the bottom.
  onMount(() => {
    const previous = document.activeElement;
    element.showModal();
    const backdrop = (event: MouseEvent) => {
      if (event.target === element) onclose();
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
  class="modal sheet"
  bind:this={element}
  aria-labelledby="sheet-title"
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  <div class="sheet-handle" aria-hidden="true"></div>
  <div class="sheet-heading">
    <h2 id="sheet-title">{title}</h2>
    <button
      type="button"
      class="btn btn-ghost icon-button"
      aria-label="Close {title.toLowerCase()}"
      onclick={onclose}><ChevronDown size={22} /></button
    >
  </div>
  <div class="sheet-body">
    {@render children()}
  </div>
</dialog>
