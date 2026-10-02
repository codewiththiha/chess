// Verify the opponent reacts to what happens on the board: a greeting when a
// game starts, a verdict on a blunder once the engine has evaluated it, a plan
// after its own move, and nothing at all in a two-player game.
import { beforeEach, describe, expect, it } from 'vitest';
import { AppState } from '../../src/lib/state/app.svelte';
import { BotChatController } from '../../src/lib/controllers/botchat';
import { createGame, DEFAULT_NEW_GAME } from '../../src/lib/domain/games';
import { devBots } from '../../src/lib/domain/bots';
import { position, moveEntry } from '../../src/lib/domain/chess';
import { INITIAL_FEN } from '../../src/lib/domain/chess';
import type { MoveEntry } from '../../src/lib/domain/types';
import type { Report } from '../../src/lib/engine/types';

let state: AppState;
let chat: BotChatController;

function startGame(botId = 'dev-kyaw-gyi', opponent: 'bot' | 'human' = 'bot') {
  state.bots = devBots();
  const bot = devBots().find((entry) => entry.id === botId) ?? null;
  state.record = createGame({ ...DEFAULT_NEW_GAME, opponent, botId }, bot);
  state.cursor = 0;
  return state.record;
}

/** Play one legal move onto the record the way the controller does. */
function play(uci: string): MoveEntry {
  const fen = state.record.moves.at(-1)?.fen ?? state.record.startFen;
  const entry = moveEntry(
    fen === state.record.startFen && state.record.moves.length === 0
      ? state.record.startFen
      : fen,
    uci,
    false,
  );
  state.record.moves.push(entry);
  state.cursor = state.record.moves.length;
  return entry;
}

function report(overrides: Partial<Report> = {}): Report {
  return {
    status: 'ok',
    finished: true,
    depth: 12,
    selectiveDepth: 12,
    nodes: '120000',
    bestMove: 'g1f3',
    scoreCp: 20,
    mate: null,
    pv: ['g1f3', 'b8c6', 'f1b5'],
    variations: [],
    ...overrides,
  };
}

function lastLine(): string {
  return state.botChat.at(-1)?.text ?? '';
}

beforeEach(() => {
  state = new AppState();
  chat = new BotChatController(state);
});

describe('a bot game', () => {
  it('opens with the character introducing itself', () => {
    startGame();
    chat.greet();
    expect(state.botChat).toHaveLength(1);
    expect(state.botChat[0]!.name).toBe('Kyaw Gyi');
    expect(lastLine().length).toBeGreaterThan(0);
  });

  it('names the reader blunder once the engine has evaluated the move', () => {
    startGame();
    chat.greet();
    // The engine evaluates the opening before the reader commits to anything.
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20 }));
    play('g2g4');
    chat.observe();
    // Black is to move after 1. g4, and the engine is now +4 for black.
    chat.observeReport(report({ bestMove: 'd7d5', scoreCp: 400 }));
    expect(state.botChat).toHaveLength(2);
    expect(lastLine()).toMatch(/pawn|blunder|game/i);
  });

  it('praises the move the engine actually wanted', () => {
    startGame('dev-kyar-nyo');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20 }));
    play('e2e4');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -18, pv: ['e7e5'] }),
    );
    expect(lastLine()).toMatch(/move|strong|wanted|found|correct|want/i);
  });

  it('does not praise a move the engine never suggested', () => {
    startGame('dev-kyar-nyo');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20 }));
    play('a2a3');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -20, pv: ['e7e5'] }),
    );
    expect(lastLine()).not.toMatch(/that was the move I wanted/i);
  });

  it('says what it intends after its own move, from its own line', () => {
    startGame('dev-nay-chi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: ['e2e4'] }));
    play('e2e4');
    chat.observe();
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: 18, pv: ['e7e5'] }));
    // The engine answers as the bot, so the bot comments on its own reply.
    play('e7e5');
    chat.observe();
    // Its own move is only described once the engine has a line for it.
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: -15, pv: ['g1f3', 'b8c6', 'f1b5'] }),
    );
    expect(lastLine()).toMatch(/next|plan|watch|watching/i);
    expect(lastLine()).toContain('Nc6');
  });

  it('comments on an ordinary move now and then, without nagging', () => {
    startGame('dev-nay-chi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20 }));
    play('e2e4');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -20, pv: ['e7e5'] }),
    );
    const afterFirst = state.botChat.length;
    // Ply 2 is the character's own move, ply 3 the reader's next one.
    play('e7e5');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: 10, pv: ['g1f3', 'b8c6'] }),
    );
    play('g1f3');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'b8c6', scoreCp: -10, pv: ['b8c6', 'f1b5'] }),
    );
    // One more line, and it is a comment rather than another plan.
    expect(state.botChat.length).toBe(afterFirst + 2);
  });

  it('stays quiet instead of narrating every ply', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }));
    play('e2e4');
    chat.observe();
    // The reader played what the engine wanted, so that deserves an answer.
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -20, pv: ['e7e5'] }),
    );
    expect(state.botChat).toHaveLength(2);
    play('e7e5');
    chat.observe();
    chat.observeReport(report({ bestMove: 'g1f3', scoreCp: 20, pv: [] }));
    // Its own quiet move, one ply later: nothing worth saying, so it says nothing.
    expect(state.botChat).toHaveLength(2);
  });

  it('mentions a piece it just took and a check it just gave', () => {
    startGame('dev-nay-chi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }));
    play('e2e4');
    chat.observe();
    const capture = play('d7d5');
    chat.observe();
    capture.captured = 'pawn';
    capture.san = 'exd5';
    chat.observeReport(report({ scoreCp: 40, bestMove: 'g1f3', pv: [] }));
    expect(lastLine()).toMatch(/pawn|mine|take|material|helped/i);
  });

  it('closes the game in character whether it won or lost', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    play('e2e4');
    chat.observe();
    state.record.result = '0-1';
    state.record.termination = 'Checkmate';
    chat.observe();
    expect(lastLine()).toMatch(/expected|Won|As expected|Review/i);

    state = new AppState();
    chat = new BotChatController(state);
    startGame('dev-kyar-nyo');
    chat.greet();
    play('e2e4');
    chat.observe();
    state.record.result = '1-0';
    chat.observe();
    expect(lastLine()).toMatch(/got me|better|Well played|clean/i);
  });

  it('answers a resignation with the resignation lines', () => {
    startGame('dev-nay-chi');
    chat.greet();
    play('e2e4');
    chat.observe();
    state.record.result = '0-1';
    state.record.termination = 'Resignation';
    chat.observe();
    expect(state.botChat.at(-1)!.text.length).toBeGreaterThan(0);
  });

  it('files a late report against the position it actually describes', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    // The engine was asked about the start position, and its answer arrives
    // after the reader's move: it must not be judged as if it were the move's
    // own evaluation, and the plan must not be quoted in the reader's voice.
    chat.observeReport(
      report({ bestMove: 'e2e4', scoreCp: 20, pv: ['d7d5', 'g1f3', 'b8c6'] }),
      0,
    );
    play('e2e4');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -20, pv: ['g1f3', 'b8c6', 'f1b5'] }),
      1,
    );
    // The character talks about its own move at ply 2, and the plan it names is
    // a move for its own side, never the reader's.
    play('d7d5');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: 20, pv: ['g1f3', 'b8c6', 'f1b5'] }),
      2,
    );
    const plan = lastLine();
    expect(plan).toContain('Nc6');
    expect(plan).not.toContain('Nf3');
  });

  it('ignores a deepening report and waits for the settled answer', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20 }), 0);
    play('e2e4');
    chat.observe();
    // An interim report says nothing yet, so the move is not judged on it.
    chat.observeReport(
      report({ finished: false, bestMove: 'e7e5', scoreCp: -20 }),
      1,
    );
    expect(state.botChat).toHaveLength(1);
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: -20 }), 1);
    expect(state.botChat).toHaveLength(2);
    // The same position judged twice would say the same thing twice.
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: -20 }), 1);
    expect(state.botChat).toHaveLength(2);
  });

  it('never claims a plan the engine did not give it', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }), 0);
    play('e2e4');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'e7e5', scoreCp: -20, pv: ['g1f3'] }),
      1,
    );
    play('e7e5');
    chat.observe();
    // A one-move line holds only the reader's reply, so there is no plan to
    // report and the character says something else instead.
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: 20, pv: ['g1f3'] }),
      2,
    );
    expect(lastLine()).not.toMatch(/I intend|Next:/i);
  });

  it('notices when the reader asks for a hint', () => {
    startGame('dev-nay-chi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }));
    play('e2e4');
    chat.observe();
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: 18, pv: [] }));
    play('e7e5');
    chat.observe();
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: 18, pv: [] }));
    const before = state.botChat.length;
    chat.heardHint();
    expect(state.botChat.length).toBeGreaterThan(before);
    expect(lastLine()).toMatch(/hint|engine|help/i);
  });

  it('stops talking about a game once it is loaded rather than started', () => {
    startGame();
    chat.greet();
    const greetingCount = state.botChat.length;
    play('e2e4');
    chat.observe();
    expect(state.botChat.length).toBe(greetingCount);
  });
});

describe('everywhere else', () => {
  it('says nothing in a two-player game', () => {
    startGame('dev-nay-chi', 'human');
    chat.greet();
    chat.observeReport(report());
    play('e2e4');
    chat.observe();
    expect(state.botChat).toHaveLength(0);
  });

  it('says nothing in a study board or an imported game', () => {
    state.bots = devBots();
    state.record = createGame(
      { ...DEFAULT_NEW_GAME, opponent: 'bot', botId: 'dev-nay-chi' },
      devBots()[1]!,
    );
    state.record.opponent = 'bot';
    state.record.botId = null;
    chat.greet();
    expect(state.botChat).toHaveLength(0);
  });

  it('resets the conversation for a new game', () => {
    startGame();
    chat.greet();
    expect(state.botChat).toHaveLength(1);
    chat.reset();
    expect(state.botChat).toHaveLength(0);
  });

  it('keeps the newest bubble available to the interface', () => {
    startGame();
    chat.greet();
    expect(state.bubble?.text).toBe(lastLine());
    expect(position(INITIAL_FEN).turn).toBe('white');
  });
});
