<!-- Present actual identities, captures, material, and monotonic chess clocks. -->
<script lang="ts">
  import {
    Bot,
    UserRound,
    Pause,
    Infinity as InfinityIcon,
  } from '@lucide/svelte';
  import { formatClock } from '../domain/clocks';
  import { material } from '../domain/chess';
  import { roleToChar } from 'chessops/util';
  import type { Session } from '../controllers/session';
  import type { Color } from '../domain/types';
  let { session, color }: { session: Session; color: Color } = $props();
  const s = $derived(session.state);
  const opponent = $derived(s.view === 'play' && color !== s.record.human);
  const name = $derived(
    s.view === 'analyze'
      ? color === 'white'
        ? 'White'
        : 'Black'
      : color === 'white'
        ? s.record.white
        : s.record.black,
  );
  const active = $derived(
    s.view === 'play' &&
      s.record.result === '*' &&
      s.latest &&
      !s.paused &&
      s.pos.turn === color,
  );
  const captures = $derived(
    s.record.moves
      .slice(0, s.cursor)
      .filter((m) => m.color === color && m.captured)
      .map((m) => m.captured),
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
        : `Nominal Elo ${s.preferences.engine.elo}`,
  );
</script>

<div class="player-row" class:player-active={active}>
  <div class="player-avatar" class:engine-avatar={opponent}>
    {#if opponent}<Bot size={20} />{:else}<UserRound size={19} />{/if}
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
          >{opponent
            ? `${engineLabel} · ${s.preferences.engine.mode === 'human-like' ? 'Human-like' : s.preferences.engine.mode.charAt(0).toUpperCase() + s.preferences.engine.mode.slice(1)}`
            : s.view === 'play'
              ? 'You’re playing here'
              : `${color === 'white' ? 'White' : 'Black'} pieces`}</span
        >
      {/if}
    </div>
  </div>
  {#if s.record.clock.initialMs && s.view !== 'analyze'}
    <div
      class="chess-clock"
      role="timer"
      class:running={active}
      class:low-time={time < 30000}
      aria-label={`${name}, ${formatClock(time)} remaining`}
    >
      {#if s.paused && s.record.result === '*'}<Pause
          size={12}
        />{:else if active}<span class="clock-dot"></span>{/if}
      <span>{formatClock(time)}</span>
    </div>
  {:else}
    <div class="untimed">
      <InfinityIcon size={17} /><span
        >{s.view === 'play'
          ? 'Untimed'
          : color === s.pos.turn
            ? 'To move'
            : ''}</span
      >
    </div>
  {/if}
</div>
