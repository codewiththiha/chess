// Decide when the one-screen layout applies, and how big the board may be.

/**
 * The compact layout holds a board, both players, and one line of state on a
 * single screen with nothing to scroll. It takes over when the stacked layout
 * cannot fit: a phone's width, or a window too short for a board plus a card.
 */
export const COMPACT_QUERY = '(max-width: 999px), (max-height: 640px)';

/** The same rule as a pure function, so the decision is testable. */
export function isCompactViewport(width: number, height: number): boolean {
  return width <= 999 || height <= 640;
}

/**
 * The largest square that fits the space left over once the board's neighbours
 * in the row (the evaluation rail and its gap) have taken their width. Fitting
 * to both axes at once is what keeps the board on screen without a scroll.
 */
export function fitSquare(
  slotWidth: number,
  slotHeight: number,
  extraWidth = 0,
): number {
  if (!Number.isFinite(slotWidth) || !Number.isFinite(slotHeight)) return 0;
  return Math.max(0, Math.floor(Math.min(slotWidth - extraWidth, slotHeight)));
}
