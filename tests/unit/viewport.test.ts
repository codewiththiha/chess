// Keep the one-screen decision and the board fitting honest.
import { describe, expect, it } from 'vitest';
import {
  COMPACT_QUERY,
  fitSquare,
  isCompactViewport,
} from '../../src/lib/domain/viewport';

describe('the compact layout', () => {
  it('takes over on phones and short windows, and leaves the desktop alone', () => {
    expect(isCompactViewport(390, 844)).toBe(true); // iPhone 13
    expect(isCompactViewport(360, 640)).toBe(true); // small Android
    expect(isCompactViewport(1024, 600)).toBe(true); // a window too short to stack
    expect(isCompactViewport(1440, 1000)).toBe(false); // the desktop project
    expect(isCompactViewport(1000, 820)).toBe(false); // 1000px keeps the card
  });

  it('is the same rule the stylesheet and the shell switch on', () => {
    expect(COMPACT_QUERY).toBe('(max-width: 999px), (max-height: 640px)');
  });
});

describe('sizing the board to its slot', () => {
  it('takes the smaller axis, less the room the evaluation rail needs', () => {
    expect(fitSquare(600, 500, 16)).toBe(500);
    expect(fitSquare(300, 500, 16)).toBe(284);
    expect(fitSquare(300, 500)).toBe(300);
  });

  it('rounds down to whole pixels and never asks for a negative square', () => {
    expect(fitSquare(399.6, 800)).toBe(399);
    expect(fitSquare(5, 5, 40)).toBe(0);
    expect(fitSquare(Number.NaN, 800)).toBe(0);
  });
});
