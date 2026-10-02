// Reject stale, malformed, or illegal cached review data before it reaches the UI.
import { describe, expect, it } from 'vitest';
import { decodeReview } from '../../src/lib/data/review-validation';
import { decodeGame } from '../../src/lib/data/validation';
import { ENGINE_REVISION } from '../../src/lib/domain/review';
import { studyGame } from '../../src/lib/domain/games';
import { importPgn } from '../../src/lib/domain/pgn';
import { moveEntry, INITIAL_FEN } from '../../src/lib/domain/chess';
import type { GameRecord, ReviewRecord } from '../../src/lib/domain/types';
function fixture(): { game: GameRecord; review: ReviewRecord } {
  const game = studyGame();
  game.moves.push(moveEntry(INITIAL_FEN, 'e2e4', false));
  const budget = { depth: 5, nodes: '10000', timeMs: 300 };
  const review: ReviewRecord = {
    version: 1,
    gameId: game.id,
    engineRevision: ENGINE_REVISION,
    fingerprint: JSON.stringify({
      revision: ENGINE_REVISION,
      start: game.startFen,
      chess960: false,
      moves: ['e2e4'],
      budget,
    }),
    depth: 5,
    nodeBudget: '10000',
    timeMs: 300,
    updatedAt: Date.now(),
    complete: false,
    points: [
      {
        ply: 0,
        whiteCp: 25,
        whiteMate: null,
        depth: 5,
        nodes: '1200',
        bestMove: 'e2e4',
        bestSan: 'untrusted SAN',
        pv: ['e2e4', 'e7e5'],
      },
    ],
  };
  return { game, review };
}
describe('cached review validation', () => {
  it('preserves valid partial evidence but reconstructs SAN from the legal position', () => {
    const { game, review } = fixture();
    const loaded = decodeReview(review, game);
    expect(loaded.points[0]?.bestSan).toBe('e4');
    expect(loaded.complete).toBe(false);
  });
  it('binds results to game identity, revision, and full move history', () => {
    const { game, review } = fixture();
    review.gameId = 'other';
    expect(() => decodeReview(review, game)).toThrow('match');
    review.gameId = game.id;
    game.moves[0] = moveEntry(INITIAL_FEN, 'd2d4', false);
    expect(() => decodeReview(review, game)).toThrow('history');
  });
  it('rejects duplicated positions and false completion', () => {
    const { game, review } = fixture();
    review.complete = true;
    expect(() => decodeReview(review, game)).toThrow('missing');
    review.complete = false;
    const point = review.points[0];
    if (!point) throw new Error('Missing fixture');
    review.points.push({ ...point });
    expect(() => decodeReview(review, game)).toThrow('Duplicate');
  });
  it('rejects non-finite scores, invalid budgets, and illegal principal variations', () => {
    const { game, review } = fixture();
    const point = review.points[0];
    if (!point) throw new Error('Missing fixture');
    point.whiteCp = Number.NaN;
    expect(() => decodeReview(review, game)).toThrow();
    point.whiteCp = 25;
    point.pv = ['e2e5'];
    expect(() => decodeReview(review, game)).toThrow('Illegal');
    point.pv = [];
    review.timeMs = -1;
    expect(() => decodeReview(review, game)).toThrow('deadline');
  });
});
describe('import and date boundaries', () => {
  it('keeps long player names inside saved-record bounds', () => {
    const games = importPgn(
      `[White "${'W'.repeat(200)}"]\n[Black "${'B'.repeat(200)}"]\n\n1. e4 e5 *`,
    );
    const game = games[0];
    if (!game) throw new Error('Missing game');
    expect(game.white).toHaveLength(120);
    expect(() => decodeGame(game)).not.toThrow();
  });
  it('does not reinterpret an unsupported variant as orthodox chess', () => {
    expect(() => importPgn('[Variant "Atomic"]\n\n1. e4 e5 *')).toThrow(
      'Only standard',
    );
  });
  it('rejects saved dates that cannot be formatted or exported', () => {
    const game = studyGame();
    game.createdAt = 1e30;
    expect(() => decodeGame(game)).toThrow('date');
  });
});
