// Verify reactive game orchestration at exact clock and archived-branch boundaries.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { GameActions } from '../../src/lib/controllers/game';
import { makeClock, startClock } from '../../src/lib/domain/clocks';
import { analysisGame } from '../../src/lib/domain/games';
afterEach(() => vi.restoreAllMocks());
describe('game orchestration', () => {
  it('checks exact elapsed time before accepting a move, even between clock ticks', () => {
    const state = new AppState();
    state.ready = true;
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
    const game = analysisGame('7k/P5r1/8/8/8/8/8/7K w - - 0 1');
    game.kind = 'play';
    game.clock = makeClock(1, 0);
    game.clock.whiteMs = 10;
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const actions = new GameActions(state);
    actions.load(game, 'play');
    actions.resume();
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
    const game = analysisGame('7k/P7/8/8/8/8/8/7K w - - 0 1');
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
  it('branches analysis into an independent copy and restores the original paused game', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const state = new AppState();
    state.ready = true;
    const actions = new GameActions(state);
    actions.commit('e2e4');
    actions.commit('e7e5');
    const original = state.snapshot();
    actions.enter('analyze');
    expect(state.record.id).not.toBe(original.id);
    actions.jump(0);
    actions.commit('d2d4');
    expect(state.record.moves).toHaveLength(1);
    actions.enter('play');
    expect(state.record.id).toBe(original.id);
    expect(state.record.moves.map((m) => m.uci)).toEqual(['e2e4', 'e7e5']);
    expect(state.paused).toBe(true);
    expect(state.record.clock.running).toBeNull();
  });
});

it('does not restore a deleted play backup when leaving an analysis copy', () => {
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const state = new AppState();
  state.ready = true;
  const actions = new GameActions(state);
  actions.commit('e2e4');
  const originalId = state.record.id;
  actions.enter('analyze');
  actions.discard(originalId);
  actions.enter('play');
  expect(state.record.id).not.toBe(originalId);
  expect(state.record.moves).toHaveLength(0);
});
