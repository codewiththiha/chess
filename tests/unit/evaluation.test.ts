// Check the rail's settled values, its result fill, and heuristic accuracy.
import { describe, expect, it } from 'vitest';
import {
  MATE_CP,
  accuracyReport,
  evaluationSeries,
  railExtent,
  railValue,
  resultValue,
} from '../../src/lib/domain/review';
import { fenAt, sanToEntry } from '../../src/lib/domain/chess';
import { studyGame } from '../../src/lib/domain/games';
import type {
  GameRecord,
  Result,
  ReviewPoint,
} from '../../src/lib/domain/types';

/** A finished record: the moves as played, and how the game ended. */
function played(sans: string[], result: Result = '*'): GameRecord {
  const game = studyGame();
  for (const san of sans)
    game.moves.push(sanToEntry(fenAt(game, game.moves.length), san, false));
  game.result = result;
  return game;
}

const point = (ply: number, whiteCp: number): ReviewPoint => ({
  ply,
  whiteCp,
  whiteMate: null,
  depth: 5,
  nodes: '100',
  bestMove: null,
  bestSan: null,
  pv: [],
});

describe('the evaluation rail', () => {
  it('fills for the side that won and levels for a draw', () => {
    expect(resultValue(played([], '1-0'))).toBe(MATE_CP);
    expect(resultValue(played([], '0-1'))).toBe(-MATE_CP);
    expect(resultValue(played([], '1/2-1/2'))).toBe(0);
    expect(resultValue(played([]))).toBeNull();
    expect(railExtent(MATE_CP)).toBe(100);
    expect(railExtent(-MATE_CP)).toBe(0);
    expect(railExtent(0)).toBe(50);
  });

  it('saturates an ordinary advantage instead of filling for it', () => {
    expect(railExtent(null)).toBe(50);
    expect(railExtent(100)).toBeGreaterThan(50);
    expect(railExtent(100)).toBeLessThan(60);
    expect(railExtent(-100)).toBeCloseTo(100 - railExtent(100), 6);
    expect(railExtent(3000)).toBeLessThan(100);
  });

  it('keeps the last settled value when a ply has none of its own', () => {
    const series = new Map([
      [0, 25],
      [2, -120],
    ]);
    expect(railValue(series, 0)).toBe(25);
    expect(railValue(series, 1)).toBe(25);
    expect(railValue(series, 2)).toBe(-120);
    expect(railValue(series, 9)).toBe(-120);
    expect(railValue(new Map(), 3)).toBeNull();
    expect(railValue(new Map([[4, 10]]), 3)).toBeNull();
  });

  it('prefers the review and fills a finished board from its result', () => {
    const game = played(['f3', 'e5', 'g4', 'Qh4#'], '0-1');
    const series = evaluationSeries(game, [point(0, 60)], { 0: 25, 1: -30 });
    expect(series.get(0)).toBe(60);
    expect(series.get(1)).toBe(-30);
    expect(series.get(4)).toBe(-MATE_CP);
    // A game still in progress has no outcome to fill the last ply with.
    const live = played(['e4', 'e5']);
    expect(evaluationSeries(live, [], { 1: 10 }).has(2)).toBe(false);
  });
});

describe('accuracy', () => {
  it('is perfect when nothing was given away', () => {
    const game = played(['e4', 'e5', 'Nf3', 'Nc6']);
    const evals = { 0: 25, 1: 25, 2: 25, 3: 25, 4: 25 };
    expect(accuracyReport(game, [], evals)).toEqual({ white: 100, black: 100 });
  });

  it('charges the side that let the mate in, not the side that mated', () => {
    // 2. g4 hands White's game away; 2...Qh4# takes it without giving anything
    // back, so Black keeps a perfect score and White does not.
    const game = played(['f3', 'e5', 'g4', 'Qh4#'], '0-1');
    const report = accuracyReport(game, [], { 0: 20, 1: 30, 2: 50, 3: -1200 });
    expect(report).not.toBeNull();
    expect(report?.white).toBeLessThan(70);
    expect(report?.black).toBeGreaterThan(90);
  });

  it('reads the review when there is one and stays quiet without data', () => {
    const game = played(['e4', 'e5', 'Nf3', 'Nc6']);
    // A review's own points score every move; the live evaluations are missing.
    const points = [0, 1, 2, 3, 4].map((ply) => point(ply, 20));
    expect(accuracyReport(game, points, {})).toEqual({
      white: 100,
      black: 100,
    });
    expect(accuracyReport(game, [], {})).toBeNull();
    // One side unevaluated is not a report.
    expect(accuracyReport(game, [], { 0: 20, 1: 20 })).toBeNull();
  });
});
