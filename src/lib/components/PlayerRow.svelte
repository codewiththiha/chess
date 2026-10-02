<!-- Present actual identities, captures, material, and running chess clocks. -->
<script lang="ts">
  import { Bot, UserRound, Infinity as InfinityIcon } from '@lucide/svelte';
  import { formatClock } from '../domain/clocks';
  import { material } from '../domain/chess';
  import { roleToChar } from 'chessops/util';
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
  const engineLabel = $derived(
    s.preferences.engine.mode === 'analysis' ||
      (s.preferences.engine.strength === 'skill' &&
        s.preferences.engine.skillLevel === 21)
      ? 'Full strength'
      : s.preferences.engine.strength === 'skill'
        ? `Level ${s.preferences.engine.skillLevel}`
        : `Nominal ${s.preferences.engine.elo}`,
  );
</script>

<div class="player-row" class:player-active={running}>
  <div
    class="player-avatar"
    class:engine-avatar={s.view === 'play' && opponent}
  >
    {#if s.view === 'play' && opponent}<Bot size={19} />{:else}<UserRound
        size={18}
      />{/if}
  </div>
  <div class="player-details">
    <div class="player-name">
      <span class="player-name-text">{name}</span><span
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
          >{s.view === 'play' && opponent
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
