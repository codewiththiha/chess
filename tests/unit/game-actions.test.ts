// Verify reactive game orchestration at exact clock and single-record boundaries.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { GameActions } from '../../src/lib/controllers/game';
import { makeClock, startClock } from '../../src/lib/domain/clocks';
import { studyGame } from '../../src/lib/domain/games';

afterEach(() => vi.restoreAllMocks());

describe('game orchestration', () => {
  it('checks exact elapsed time before accepting a move, even between clock ticks', () => {
    const state = new AppState();
    state.ready = true;
    state.view = 'play';
    state.record.clock = makeClock(1, 0);
    state.record.clock.whiteMs = 10;
    startClock(state.record.clock, 'white', 100);
    vi.spyOn(performance, 'now').mockReturnValue(115);
    const actions = new GameActions(state);
    expect(() => actions.commit('e2e4')).toThrow('Time expired');
    expect(state.record.moves).toHaveLength(0);
    expect(state.record.result).toBe('0-1');
  });
  it('closes a pending promotion when the flag falls, without accepting a late selection', () => {
    const state = new AppState();
    state.ready = true;
    state.view = 'play';
    const game = studyGame('7k/P5r1/8/8/8/8/8/7K w - - 0 1');
    game.kind = 'play';
    game.clock = makeClock(1, 0);
    game.clock.whiteMs = 10;
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const actions = new GameActions(state);
    actions.load(game, 'play');
    actions.resumeClock();
    actions.attempt('a7', 'a8');
    expect(state.dialog).toBe('promotion');
    state.now = 115;
    actions.expire();
    expect(state.dialog).toBeNull();
    expect(state.promotion).toBeNull();
    actions.attempt('a7', 'a8', 'q');
    expect(state.record.moves).toHaveLength(0);
    expect(state.record.result).toBe('0-1');
  });
  it('awards a timeout draw when the opponent cannot possibly mate', () => {
    const state = new AppState();
    state.view = 'play';
    const game = studyGame('7k/P7/8/8/8/8/8/7K w - - 0 1');
    game.kind = 'play';
    game.clock = makeClock(1, 0);
    game.clock.whiteMs = 0;
    startClock(game.clock, 'white', 100);
    state.record = game;
    state.now = 101;
    new GameActions(state).expire();
    expect(state.record.result).toBe('1/2-1/2');
    expect(state.record.termination).toContain('insufficient');
  });
  it('studies the active game as one record instead of forking a second one', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const state = new AppState();
    state.ready = true;
    state.view = 'play';
    const actions = new GameActions(state);
    actions.commit('e2e4');
    actions.commit('e7e5');
    const original = state.snapshot();
    actions.enter('study');
    expect(state.record.id).toBe(original.id);
    expect(state.cursor).toBe(2);
    expect(state.record.moves).toHaveLength(2);
    actions.jump(0);
    actions.commit('d2d4');
    expect(state.record.moves.map((m) => m.uci)).toEqual(['d2d4']);
    actions.enter('play');
    expect(state.record.id).toBe(original.id);
    expect(state.cursor).toBe(1);
  });
  it('keeps the clock running while another view is open', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const state = new AppState();
    state.ready = true;
    state.view = 'play';
    state.record.clock = makeClock(3, 0);
    const actions = new GameActions(state);
    actions.startIfNeeded();
    expect(state.record.clock.running).toBe('white');
    actions.enter('study');
    expect(state.record.clock.running).toBe('white');
    expect(state.getClock('white')).toBe(180000);
    state.now = 1_500;
    expect(state.getClock('white')).toBe(178500);
  });
});

it('removing the active game leaves an empty board without resurrecting it', () => {
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const state = new AppState();
  state.ready = true;
  state.view = 'play';
  const actions = new GameActions(state);
  actions.commit('e2e4');
  const originalId = state.record.id;
  actions.discard(originalId);
  expect(state.record.id).not.toBe(originalId);
  expect(state.record.moves).toHaveLength(0);
  actions.enter('play');
  expect(state.record.moves).toHaveLength(0);
});
