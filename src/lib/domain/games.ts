// Construct complete records and determine terminal results from legal positions.
import { makeFen } from 'chessops/fen';
import { INITIAL_FEN, position, fenAt, automaticDraw } from './chess';
import { chess960Fen } from './chess960';
import { makeClock } from './clocks';
import type { GameRecord, NewGameOptions, Result } from './types';
export const DEFAULT_NEW_GAME: NewGameOptions = {
  side: 'white',
  minutes: 0,
  increment: 0,
  chess960: false,
  position: 518,
  opponent: 'bot',
};
export function createGame(options: NewGameOptions, elo = 1600): GameRecord {
  const human =
    options.side === 'random'
      ? (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) % 2
        ? 'white'
        : 'black'
      : options.side;
  const startFen = options.chess960
    ? chess960Fen(options.position)
    : INITIAL_FEN;
  const twoPlayers = options.opponent === 'human';
  const engineName = 'gwaymaegyi';
  const whiteName = twoPlayers
    ? 'Player 1'
    : human === 'white'
      ? 'You'
      : engineName;
  const blackName = twoPlayers
    ? 'Player 2'
    : human === 'black'
      ? 'You'
      : engineName;
  return {
    version: 1,
    id: crypto.randomUUID(),
    kind: 'play',
    title: twoPlayers ? 'Player 1 vs Player 2' : `You vs ${engineName}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startFen,
    chess960: options.chess960,
    human,
    opponent: options.opponent,
    white: whiteName,
    black: blackName,
    result: '*',
    termination: '',
    moves: [],
    clock: makeClock(options.minutes, options.increment),
    engineElo: elo,
    headers: options.chess960
      ? { FRCPosition: String(options.position), Variant: 'Chess960' }
      : {},
  };
}
export function studyGame(fen = INITIAL_FEN): GameRecord {
  const canonical = position(fen).toSetup();
  // A study board has no opponent: the reader moves both sides themselves.
  const game = createGame({
    ...DEFAULT_NEW_GAME,
    minutes: 0,
    opponent: 'human',
  });
  // Use canonical FEN, not text with incompatible whitespace or redundant EP.
  game.startFen = makeFen(canonical);
  game.kind = 'import';
  game.title = 'Study board';
  game.white = 'White';
  game.black = 'Black';
  return game;
}
export function terminalResult(
  game: GameRecord,
): { result: Result; reason: string } | null {
  const pos = position(fenAt(game, game.moves.length));
  const outcome = pos.outcome();
  if (outcome)
    return {
      result: outcome.winner
        ? outcome.winner === 'white'
          ? '1-0'
          : '0-1'
        : '1/2-1/2',
      reason: pos.isCheckmate()
        ? 'Checkmate'
        : pos.isStalemate()
          ? 'Stalemate'
          : 'Insufficient material',
    };
  if (automaticDraw(game))
    return { result: '1/2-1/2', reason: 'Automatic draw' };
  return null;
}
export function resultText(result: Result): string {
  if (result === '*') return 'In progress';
  if (result === '1/2-1/2') return 'Draw';
  return result === '1-0' ? 'White wins' : 'Black wins';
}

export function resultLabel(game: GameRecord): string {
  if (game.result === '*') return 'In progress';
  if (game.result === '1/2-1/2') return 'Draw';
  return game.result === '1-0' ? 'White wins' : 'Black wins';
}
