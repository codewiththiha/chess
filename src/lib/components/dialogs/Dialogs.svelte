<!-- Mount only the requested modal so draft state and native focus traps stay isolated. -->
<script lang="ts">
  import Settings from './Settings.svelte';
  import Appearance from './Appearance.svelte';
  import Import from './Import.svelte';
  import Fen from './Fen.svelte';
  import Promotion from './Promotion.svelte';
  import Confirm from './Confirm.svelte';
  import Help from './Help.svelte';
  import type { Session } from '../../controllers/session';
  let { session }: { session: Session } = $props();
  const s = $derived(session.state);
</script>

{#if s.dialog === 'settings'}<Settings
    {session}
  />{:else if s.dialog === 'appearance'}<Appearance
    {session}
  />{:else if s.dialog === 'import'}<Import
    {session}
  />{:else if s.dialog === 'fen'}<Fen
    {session}
  />{:else if s.dialog === 'promotion'}<Promotion
    {session}
  />{:else if s.dialog === 'confirm'}<Confirm
    {session}
  />{:else if s.dialog === 'help'}<Help {session} />{/if}
