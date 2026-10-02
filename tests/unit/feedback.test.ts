// Verify the board's verdict mark matches the review's own thresholds, and that
// the walkthrough picks the moments a reader would want to hear about.
import { describe, expect, it } from 'vitest';
import { badgeFor, feedbackFor, gradeOf } from '../../src/lib/domain/feedback';
import { grades } from '../../src/lib/domain/review';
import { keyMoments } from '../../src/lib/controllers/coach';
import { createGame, DEFAULT_NEW_GAME } from '../../src/lib/domain/games';
import { moveEntry } from '../../src/lib/domain/chess';
import type {
  GameRecord,
  MoveGrade,
  ReviewPoint,
} from '../../src/lib/domain/types';

function record(): GameRecord {
  return createGame({ ...DEFAULT_NEW_GAME, side: 'white' });
}

/** Play a line onto a record the way the game controller does. */
function line(game: GameRecord, moves: string[]): GameRecord {
  for (const uci of moves) {
    const fen = game.moves.at(-1)?.fen ?? game.startFen;
    game.moves.push(moveEntry(fen, uci, false));
  }
  return game;
}

function point(ply: number, bestMove: string, bestSan: string): ReviewPoint {
  return {
    ply,
    whiteCp: 20,
    whiteMate: null,
    depth: 8,
    nodes: '1',
    bestMove,
    bestSan,
    pv: [],
  };
}

/** Only the fields the board reads. */
/** A legal opening pair, so a fixture record is a real game. */
const OPENING = [
  'e2e4',
  'e7e5',
  'g1f3',
  'b8c6',
  'f1c4',
  'f8c5',
  'd2d4',
  'd7d6',
  'b1c3',
  'g8f6',
  'e1g1',
  'e8g8',
];

describe('the mark on the board', () => {
  it('paints the same grade the review would give it', () => {
    expect(gradeOf(0)).toBe('good');
    expect(gradeOf(49)).toBe('good');
    expect(gradeOf(50)).toBe('inaccuracy');
    expect(gradeOf(99)).toBe('inaccuracy');
    expect(gradeOf(100)).toBe('mistake');
    expect(gradeOf(199)).toBe('mistake');
    expect(gradeOf(200)).toBe('blunder');
  });

  it('uses the theme colour and a word that carries the meaning', () => {
    expect(badgeFor('blunder')).toEqual({
      grade: 'blunder',
      tone: 'error',
      label: 'Blunder',
    });
    expect(badgeFor('mistake').tone).toBe('error');
    expect(badgeFor('inaccuracy').tone).toBe('warning');
    expect(badgeFor('good').tone).toBe('success');
    expect(badgeFor('best').tone).toBe('success');
  });

  it('draws nothing without a grade and a real square', () => {
    expect(feedbackFor(null, 'e4')).toBeNull();
    expect(feedbackFor('mistake', null)).toBeNull();
    expect(feedbackFor('mistake', '')).toBeNull();
    expect(feedbackFor('mistake', 'z9')).toBeNull();
    expect(feedbackFor('mistake', 'e4')).toEqual({
      badge: badgeFor('mistake'),
      square: 'e4',
    });
  });

  it('agrees with the review on real graded moves', () => {
    const game = line(record(), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    const points = [
      point(0, 'e2e4', 'e4'),
      point(1, 'c7c5', 'c5'),
      point(2, 'g1f3', 'Nf3'),
      point(3, 'g8f6', 'Nf6'),
    ];
    const graded = grades(game, points);
    expect(graded.length).toBe(3);
    for (const item of graded)
      expect(item.grade === 'best' ? 'best' : gradeOf(item.loss)).toBe(
        item.grade,
      );
  });
});

/** A graded move, as the review would record one. */
function grade(ply: number, value: MoveGrade['grade'], loss: number) {
  return { ply, san: `m${ply}`, grade: value, loss, bestSan: 'Nf3' };
}

describe('which moments a walkthrough talks about', () => {
  it('keeps the worst moves and the best ones, in the order played', () => {
    const game = line(record(), OPENING);
    const all = [
      grade(1, 'inaccuracy', 70),
      grade(2, 'blunder', 900),
      grade(3, 'blunder', 400),
      grade(4, 'blunder', 800),
      grade(5, 'best', 0),
      grade(6, 'mistake', 700),
      grade(7, 'mistake', 260),
      grade(8, 'blunder', 600),
      grade(9, 'best', 0),
    ];
    const picked = keyMoments(game, all as MoveGrade[]);
    // Only the reader's own plies, worst first, then back into move order.
    expect(picked.map((item) => item.ply)).toEqual([3, 5, 7, 9]);
    expect(picked.map((entry) => entry.ply)).toEqual(
      picked.map((entry) => entry.ply).toSorted((a, b) => a - b),
    );
    expect(picked.some((entry) => entry.grade === 'inaccuracy')).toBe(false);
  });

  it('talks about the reader, not the opponent', () => {
    const game = line(record(), OPENING.slice(0, 2));
    const picked = keyMoments(game, [
      grade(1, 'mistake', 300),
      grade(2, 'blunder', 500),
    ] as MoveGrade[]);
    expect(picked.map((item) => item.ply)).toEqual([1]);
  });

  it('never asks for more than five moments', () => {
    const game = line(record(), OPENING);
    const all = [
      grade(1, 'blunder', 400),
      grade(3, 'blunder', 390),
      grade(5, 'blunder', 380),
      grade(7, 'mistake', 300),
      grade(9, 'mistake', 290),
      grade(11, 'best', 0),
    ];
    const picked = keyMoments(game, all as MoveGrade[]);
    expect(picked.length).toBe(5);
    expect(picked.map((item) => item.ply)).toEqual([1, 3, 5, 7, 11]);
  });
});
