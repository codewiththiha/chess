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

  it('says nothing when its own move is ordinary', () => {
    startGame('dev-nay-chi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: ['e2e4'] }));
    play('e2e4');
    chat.observe();
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: 18, pv: ['e7e5'] }));
    // The engine answers as the bot, so the bot comments on its own reply.
    play('e7e5');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: -15, pv: ['g1f3', 'b8c6', 'f1b5'] }),
    );
    // Nothing special happened, so the character pauses at that instead of
    // narrating a plan it was only shown as an engine line. The greeting and the
    // praise for the reader's move are all that was said.
    expect(state.botChat).toHaveLength(2);
    expect(lastLine()).toMatch(/move|correct|right|found|Even/i);
    expect(lastLine()).not.toMatch(/intend|next:/i);
  });

  it('stays silent through ordinary moves from both sides', () => {
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
      report({ bestMove: 'c7c5', scoreCp: 10, pv: ['c7c5', 'b8c6'] }),
    );
    play('g1f3');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'h7h6', scoreCp: -10, pv: ['h7h6', 'f1b5'] }),
    );
    // Its own quiet move passed, and so did the reader's: nothing was said.
    expect(state.botChat.length).toBe(afterFirst);
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
    expect(lastLine()).toMatch(/expected|Won|over|Review|achievement/i);

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
    // The engine was asked about the start position and answered about ply 0,
    // so the line it produces belongs to the reader's move, not to the answer.
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
    // The praise is filed at the ply of the move it judges, and it names that
    // move — never a move the engine only had in its line.
    expect(state.botChat.at(-1)!.ply).toBe(1);
    expect(lastLine()).toContain('e4');
    play('d7d5');
    chat.observe();
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: 20, pv: ['g1f3', 'b8c6', 'f1b5'] }),
      2,
    );
    // Its own ordinary move passed in silence: nothing in its mouth claims a
    // move that belongs to the reader.
    expect(state.botChat.map((line) => line.text).join(' ')).not.toMatch(
      /intend|next:/i,
    );
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

  it('offers the engine better move as advice, and only then', () => {
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
    // Kyar Nyo teaches on every second mistake, and this is her first.
    chat.observeReport(
      report({ bestMove: 'g1f3', scoreCp: 20, pv: ['g1f3'] }),
      2,
    );
    expect(lastLine()).not.toMatch(/intend|next:/i);
    // The engine never named a better move for ply 2, so no advice was offered.
    expect(lastLine()).not.toMatch(/was the move|tip|lesson/i);
  });

  it('teaches the reader the move the engine wanted, on a cadence', () => {
    startGame('dev-kyar-nyo');
    chat.greet();
    // Two mistakes in a row: Kyar Nyo remarks on the first, teaches on the
    // second, and the advice names the move the engine had already given her.
    chat.observeReport(
      report({ bestMove: 'e2e4', scoreCp: 20, pv: ['e2e4'] }),
      0,
    );
    play('g2g4');
    chat.observe();
    chat.observeReport(report({ bestMove: 'd7d5', scoreCp: 400, pv: [] }), 1);
    const first = lastLine();
    expect(first).toMatch(/drops|pawns|blunder|material/i);
    play('d7d5');
    chat.observe();
    chat.observeReport(report({ bestMove: 'g1f3', scoreCp: 20, pv: [] }), 2);
    play('f2f3');
    chat.observe();
    chat.observeReport(report({ bestMove: 'd5e4', scoreCp: 420, pv: [] }), 3);
    expect(lastLine()).not.toBe(first);
    expect(lastLine()).toMatch(/was the move|tip|idea|try|next game/i);
    // Nf3 is what the engine wanted in the position the reader was looking at.
    expect(lastLine()).toContain('Nf3');
  });

  it('jokes about a valued piece but not about a pawn', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }), 0);
    play('e2e4');
    chat.observe();
    // An ordinary capture: a pawn, however much it won.
    const pawn = play('d7d5');
    chat.observe();
    pawn.captured = 'pawn';
    pawn.san = 'exd5';
    chat.observeReport(report({ bestMove: 'c7c5', scoreCp: 20, pv: [] }), 2);
    const plain = lastLine();
    expect(plain).toMatch(/pawn/i);
    // A rook deserves the bigger joke, and it counts what the piece was worth.
    const rook = play('g1f3');
    chat.observe();
    rook.captured = 'rook';
    rook.san = 'Nxe5';
    chat.observeReport(report({ bestMove: 'e7e5', scoreCp: 30, pv: [] }), 3);
    expect(lastLine()).toContain('rook');
    expect(lastLine()).not.toBe(plain);
  });

  it('never repeats a line within a game', () => {
    startGame('dev-kyaw-gyi');
    chat.greet();
    // Four mistakes in a row, each answered from the same small banks. The
    // reader is White, so every White move is followed by a worse evaluation.
    const moves = ['h2h4', 'g8f6', 'a2a3', 'f6g4', 'b2b3', 'g4h6', 'c2c3'];
    chat.observeReport(report({ bestMove: 'e2e4', scoreCp: 20, pv: [] }), 0);
    let lost = 0;
    moves.forEach((uci, step) => {
      const ply = step + 1;
      const white = step % 2 === 0;
      if (white) lost += 200;
      play(uci);
      chat.observe();
      // The position the engine describes is always worse for White, so every
      // White move is a fresh mistake for the character to answer.
      chat.observeReport(
        report({
          bestMove: white ? 'g1f3' : 'c7c5',
          scoreCp: white ? lost : -lost,
          pv: [],
        }),
        ply,
      );
    });
    const lines = state.botChat.map((line) => line.text);
    expect(lines.length).toBeGreaterThan(3);
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) expect(line).not.toMatch(/\{[a-z]+\}/);
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
