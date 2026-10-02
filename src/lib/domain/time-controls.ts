// Describe the offered time controls and classify a clock by its own length.
export interface TimeControl {
  minutes: number;
  increment: number;
  label: string;
}

export interface TimeControlGroup {
  id: string;
  label: string;
  detail: string;
  options: TimeControl[];
}

export const TIME_CONTROL_GROUPS: readonly TimeControlGroup[] = [
  {
    id: 'bullet',
    label: 'Bullet',
    detail: '1 minute',
    options: [
      { minutes: 1, increment: 0, label: '1 min' },
      { minutes: 1, increment: 1, label: '1+1' },
    ],
  },
  {
    id: 'blitz',
    label: 'Blitz',
    detail: '2 to 9 minutes',
    options: [
      { minutes: 2, increment: 1, label: '2+1' },
      { minutes: 3, increment: 0, label: '3 min' },
      { minutes: 3, increment: 2, label: '3+2' },
      { minutes: 5, increment: 0, label: '5 min' },
    ],
  },
  {
    id: 'rapid',
    label: 'Rapid',
    detail: '10 minutes and up',
    options: [
      { minutes: 10, increment: 0, label: '10 min' },
      { minutes: 10, increment: 5, label: '10+5' },
      { minutes: 15, increment: 10, label: '15+10' },
    ],
  },
] as const;

export const UNTIMED: TimeControl = {
  minutes: 0,
  increment: 0,
  label: 'No clock',
};

export const TIME_LIMITS = { minutes: 180, increment: 120 } as const;

export const DEFAULT_TIME_CONTROL: TimeControl = {
  minutes: 10,
  increment: 0,
  label: '10 min',
};

// Requested thresholds: 1 minute or less is bullet, under 10 is blitz, 10+ rapid.
export function categoryLabel(minutes: number): string {
  if (minutes <= 0) return 'Untimed';
  if (minutes <= 1) return 'Bullet';
  if (minutes < 10) return 'Blitz';
  return 'Rapid';
}

export function describeTime(minutes: number, increment: number): string {
  if (minutes <= 0) return 'Untimed';
  return increment > 0 ? `${minutes} + ${increment}` : `${minutes} min`;
}

export function sameTimeControl(
  a: { minutes: number; increment: number },
  b: { minutes: number; increment: number },
): boolean {
  return a.minutes === b.minutes && a.increment === b.increment;
}
