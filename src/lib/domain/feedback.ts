// How a graded move looks on the board: one badge on the piece that just moved,
// in the theme's own colours, with a word for anyone who cannot see the colour.
import type { Grade } from './types';

export interface MoveBadge {
  grade: Grade;
  /** daisyUI role whose colours carry the meaning. */
  tone: 'success' | 'warning' | 'error';
  /** The word shown to a screen reader and in the tooltip. */
  label: string;
}

const BADGES: Record<Grade, MoveBadge> = {
  best: { grade: 'best', tone: 'success', label: 'Best move' },
  good: { grade: 'good', tone: 'success', label: 'Good move' },
  inaccuracy: { grade: 'inaccuracy', tone: 'warning', label: 'Inaccuracy' },
  mistake: { grade: 'mistake', tone: 'error', label: 'Mistake' },
  blunder: { grade: 'blunder', tone: 'error', label: 'Blunder' },
};

export function badgeFor(grade: Grade): MoveBadge {
  return BADGES[grade];
}

/** The grade a centipawn loss earns, using the same thresholds as the review. */
export function gradeOf(loss: number): Grade {
  return loss < 50
    ? 'good'
    : loss < 100
      ? 'inaccuracy'
      : loss < 200
        ? 'mistake'
        : 'blunder';
}

/**
 * What to show on the board for a move: the badge and the square the piece
 * landed on. Null when the move is unknown, so nothing is drawn on a guess.
 */
export function feedbackFor(
  grade: Grade | null,
  square: string | null,
): { badge: MoveBadge; square: string } | null {
  if (!grade || !square || !/^[a-h][1-8]$/.test(square)) return null;
  return { badge: badgeFor(grade), square };
}
