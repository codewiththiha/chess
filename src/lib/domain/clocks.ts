// Account for elapsed monotonic time rather than trusting interval frequency.
import type { ClockState, Color } from './types';
export function makeClock(minutes: number, increment: number): ClockState {
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 180 ||
    !Number.isInteger(increment) ||
    increment < 0 ||
    increment > 120
  )
    throw new Error('Choose 0–180 minutes and 0–120 seconds of increment.');
  const ms = Math.round(minutes * 60000);
  return {
    initialMs: ms,
    incrementMs: increment * 1000,
    whiteMs: ms,
    blackMs: ms,
    running: null,
    anchor: null,
  };
}
export function remaining(
  clock: ClockState,
  color: Color,
  now: number,
): number {
  const stored = color === 'white' ? clock.whiteMs : clock.blackMs;
  return Math.max(
    0,
    stored -
      (clock.running === color && clock.anchor !== null
        ? Math.max(0, now - clock.anchor)
        : 0),
  );
}
export function settleClock(clock: ClockState, now: number): void {
  clock.whiteMs = remaining(clock, 'white', now);
  clock.blackMs = remaining(clock, 'black', now);
  clock.running = null;
  clock.anchor = null;
}
export function startClock(clock: ClockState, color: Color, now: number): void {
  settleClock(clock, now);
  if (clock.initialMs > 0) {
    clock.running = color;
    clock.anchor = now;
  }
}
export function incrementClock(clock: ClockState, color: Color): void {
  if (!clock.initialMs) return;
  if (color === 'white') clock.whiteMs += clock.incrementMs;
  else clock.blackMs += clock.incrementMs;
}
export function clockSnapshot(clock: ClockState, now: number): ClockState {
  const c = { ...clock };
  settleClock(c, now);
  return c;
}
export function formatClock(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
