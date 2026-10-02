// Verify the new game modes: bot answers in study, two-player boards, premoves.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { GameActions } from '../../src/lib/controllers/game';
import { makeClock } from '../../src/lib/domain/clocks';
import {
  createGame,
  DEFAULT_NEW_GAME,
  studyGame,
} from '../../src/lib/domain/games';

function playState(opponent: 'bot' | 'human'): AppState {
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const state = new AppState();
  state.ready = true;
  const actions = new GameActions(state);
  actions.create({ ...DEFAULT_NEW_GAME, minutes: 0, opponent });
  return state;
}

afterEach(() => vi.restoreAllMocks());

describe('game modes', () => {
  it('lets a two-player board move both sides and never claims a bot turn', () => {
    const state = playState('human');
    expect(state.record.opponent).toBe('human');
    expect(state.record.white).toBe('Player 1');
    expect(state.canMove).toBe(true);
    new GameActions(state).commit('e2e4');
    // White moved, so Black - still a person - is free to answer for themselves.
    expect(state.canMove).toBe(true);
    expect(state.record.opponent).toBe('human');
  });

  it('keeps a bot game live while study is the view on screen', () => {
    const state = playState('bot');
    const actions = new GameActions(state);
    actions.commit('e2e4');
    actions.enter('study');
    expect(state.view).toBe('study');
    // Study is a view, not a pause: the engine still owes a reply here, and the
    // search controller asks for it in either view.
    expect(state.record.result).toBe('*');
    expect(state.pos.turn).toBe('black');
    expect(state.record.opponent).toBe('bot');
  });

  it('plays a queued premove as soon as the engine hands the turn back', () => {
    const state = playState('bot');
    const actions = new GameActions(state);
    actions.commit('e2e4');
    actions.setPremove('d2', 'd4');
    expect(state.premove).toEqual({ from: 'd2', to: 'd4' });
    // The engine's reply arrives through the same commit path.
    actions.commit('e7e5');
    expect(state.record.moves.map((move) => move.uci)).toEqual([
      'e2e4',
      'e7e5',
      'd2d4',
    ]);
    expect(state.premove).toBeNull();
  });

  it('drops an illegal premove with a notice instead of a broken position', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const state = new AppState();
    state.ready = true;
    const actions = new GameActions(state);
    const notices: string[] = [];
    actions.onNotice = (text) => notices.push(text);
    // A constructed position: White's e4 pawn is eyeing the d5 pawn, Black moves.
    const game = studyGame('4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1');
    game.kind = 'play';
    game.opponent = 'bot';
    game.human = 'white';
    actions.load(game, 'play');
    actions.setPremove('e4', 'd5');
    // Black steps the pawn away, so e4xd5 would capture nothing.
    actions.commit('d5d4');
    expect(state.record.moves.map((move) => move.uci)).toEqual(['d5d4']);
    expect(state.premove).toBeNull();
    expect(notices.join(' ')).toContain('Premove dropped');
  });

  it('records the Elo a bot game was started at', () => {
    const state = new AppState();
    state.preferences.engine.strength = 'elo';
    state.preferences.engine.elo = 1200;
    new GameActions(state).create({ ...DEFAULT_NEW_GAME, opponent: 'bot' });
    expect(state.record.engineElo).toBe(1200);
    expect(state.record.title).toBe('You vs gwaymaegyi');
  });

  it('keeps an uncapped engine at the top of the scale on the record', () => {
    const state = new AppState();
    state.preferences.engine.strength = 'full';
    new GameActions(state).create({ ...DEFAULT_NEW_GAME, opponent: 'bot' });
    expect(state.record.engineElo).toBe(3000);
  });

  it('starts the clock for a two-player game without an engine move', () => {
    const state = playState('human');
    state.record.clock = makeClock(3, 0);
    const actions = new GameActions(state);
    actions.create({ ...DEFAULT_NEW_GAME, minutes: 3, opponent: 'human' });
    expect(state.record.clock.running).toBe('white');
    expect(
      createGame({ ...DEFAULT_NEW_GAME, opponent: 'human' }).opponent,
    ).toBe('human');
  });
});
