// Check elapsed-time clocks, exact unsigned budgets, and side-correct heuristic grading.
import { describe, expect, it } from 'vitest';
import {
  makeClock,
  startClock,
  remaining,
  settleClock,
  incrementClock,
  formatClock,
  clockSnapshot,
} from '../../src/lib/domain/clocks';
import {
  decimal,
  U64_MAX,
  defaultPreferences,
  validatePreferences,
} from '../../src/lib/domain/preferences';
import { whiteScore, grades, formatScore } from '../../src/lib/domain/review';
import { studyGame } from '../../src/lib/domain/games';
import { moveEntry, INITIAL_FEN } from '../../src/lib/domain/chess';
import type { ReviewPoint } from '../../src/lib/domain/types';
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
describe('clock accounting', () => {
  it('subtracts real elapsed time once, independent of tick frequency', () => {
    const c = makeClock(1, 2);
    startClock(c, 'white', 100);
    expect(remaining(c, 'white', 1250)).toBe(58850);
    settleClock(c, 1250);
    expect(c.whiteMs).toBe(58850);
    incrementClock(c, 'white');
    expect(c.whiteMs).toBe(60850);
    startClock(c, 'black', 1250);
    expect(remaining(c, 'black', 2250)).toBe(59000);
    expect(remaining(c, 'white', 2250)).toBe(60850);
  });
  it('snapshots paused clocks without mutating a running clock', () => {
    const c = makeClock(1, 0);
    startClock(c, 'white', 0);
    const copy = clockSnapshot(c, 5000);
    expect(copy.whiteMs).toBe(55000);
    expect(copy.running).toBeNull();
    expect(c.running).toBe('white');
  });
  it('does not run untimed clocks, go negative, or count negative deltas', () => {
    const c = makeClock(0, 0);
    startClock(c, 'white', 100);
    expect(c.running).toBeNull();
    const timed = makeClock(1, 0);
    startClock(timed, 'white', 100);
    expect(remaining(timed, 'white', 50)).toBe(60000);
    expect(remaining(timed, 'white', 100000)).toBe(0);
    expect(formatClock(59999)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
  });
});
describe('resource boundaries', () => {
  it('keeps the complete u64 seed/node range lossless', () => {
    expect(decimal(U64_MAX)).toBe(U64_MAX);
    expect(decimal('0001')).toBe('1');
    expect(decimal('0', true)).toBe('0');
    expect(() => decimal('0')).toThrow();
    expect(() => decimal('18446744073709551616')).toThrow();
    expect(() => decimal('1.5')).toThrow();
  });
  it('validates all browser ceilings and fractional limits', () => {
    const p = defaultPreferences();
    p.engine.hashMiB = 64;
    p.engine.multiPv = 32;
    p.engine.compute.depth = 64;
    p.engine.compute.quantum = 65536;
    p.engine.compute.nodes = U64_MAX;
    p.engine.seed = U64_MAX;
    expect(() => validatePreferences(p)).not.toThrow();
    p.engine.hashMiB = 65;
    expect(() => validatePreferences(p)).toThrow('Hash');
    p.engine.hashMiB = 8;
    p.engine.compute.depth = 4.5;
    expect(() => validatePreferences(p)).toThrow('Depth');
  });
});
describe('transparent review heuristics', () => {
  it('converts side-to-move scores and mate signs to White', () => {
    expect(whiteScore(120, null, 'black')).toBe(-120);
    expect(whiteScore(-50, null, 'white')).toBe(-50);
    expect(whiteScore(null, 2, 'black')).toBe(-30000);
    expect(whiteScore(null, null, 'white')).toBeNull();
  });
  it('grades each actor with the opposite sign, never a percentage', () => {
    const g = studyGame();
    g.moves = [moveEntry(INITIAL_FEN, 'e2e4', false)];
    g.moves.push(moveEntry(g.moves[0]?.fen ?? INITIAL_FEN, 'e7e5', false));
    const result = grades(g, [point(0, 100), point(1, -160), point(2, 0)]);
    expect(result[0]).toMatchObject({ grade: 'blunder', loss: 260 });
    expect(result[1]).toMatchObject({ grade: 'mistake', loss: 160 });
  });
  it('leaves unevaluated moves ungraded', () => {
    const g = studyGame();
    g.moves = [moveEntry(INITIAL_FEN, 'e2e4', false)];
    expect(grades(g, [])).toEqual([]);
  });
});

it('formats only reported mate distances, and identifies an already finished checkmate', () => {
  expect(formatScore(31990, null)).toBe('+319.90');
  expect(formatScore(30000, 0)).toBe('White wins');
  expect(formatScore(-30000, 0)).toBe('Black wins');
  expect(formatScore(-30000, -3)).toBe('−M3');
});
