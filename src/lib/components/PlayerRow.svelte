<!-- Present actual identities, captures, material, and running chess clocks. -->
<script lang="ts">
  import { Infinity as InfinityIcon } from '@lucide/svelte';
  import { formatClock } from '../domain/clocks';
  import { material } from '../domain/chess';
  import { roleToChar } from 'chessops/util';
  import { gameOpponentLabel } from '../domain/bots';
  import type { Session } from '../controllers/session';
  import type { Color } from '../domain/types';
  let { session, color }: { session: Session; color: Color } = $props();
  const s = $derived(session.state);
  const opponent = $derived(color !== s.record.human);
  const name = $derived(color === 'white' ? s.record.white : s.record.black);
  const running = $derived(s.record.clock.running === color);
  const captures = $derived(
    s.record.moves
      .slice(0, s.cursor)
      .filter((move) => move.color === color && move.captured)
      .map((move) => move.captured),
  );
  const advantage = $derived(material(s.fen) * (color === 'white' ? 1 : -1));
  const time = $derived(s.getClock(color));
  // A bot game shows the bot's own strength; the analysis policy leaves none.
  const engineLabel = $derived(
    s.record.opponent === 'human'
      ? 'Second player'
      : s.gameBot || s.record.opponent === 'bot'
        ? gameOpponentLabel(s.record, s.bots)
        : '',
  );
  const picture = $derived(opponent && s.gameBot ? s.gameBot.avatar : null);
</script>

<div class="player-row" class:player-active={running}>
  <div class="player-details">
    <div class="player-name">
      {#if picture}<img class="player-pfp" src={picture} alt="" />{/if}<span
        class="player-name-text">{name}</span
      ><span
        class="color-pebble"
        role="img"
        class:white={color === 'white'}
        aria-label={`${color} pieces`}
      ></span>
    </div>
    <div class="player-meta">
      {#if captures.length}
        <span
          class="captured-pieces"
          role="img"
          aria-label={`Captured ${captures.join(', ')}`}
        >
          {#each captures as role}{#if role}<img
                src={`${import.meta.env.BASE_URL}pieces/${s.preferences.pieces}/${color === 'white' ? 'b' : 'w'}${roleToChar(role).toUpperCase()}.svg`}
                alt=""
              />{/if}{/each}
        </span>
        {#if advantage > 0}<span class="material-count">+{advantage}</span>{/if}
      {:else}
        <span
          >{opponent && s.record.opponent === 'bot'
            ? engineLabel
            : color === s.pos.turn && s.record.result === '*'
              ? 'To move'
              : ''}</span
        >
      {/if}
    </div>
  </div>
  {#if s.timed}
    <div
      class="chess-clock"
      role="timer"
      class:running
      class:low-time={time < 30000}
      aria-label={`${name}, ${formatClock(time)} remaining`}
    >
      {#if running}<span class="clock-dot"></span>{/if}<span
        >{formatClock(time)}</span
      >
    </div>
  {:else}
    <div class="untimed"><InfinityIcon size={16} /></div>
  {/if}
</div>
