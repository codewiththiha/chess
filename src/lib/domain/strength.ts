// Describe engine strength as the nominal Elo the interface shows to people.
/** The engine's published skill presets: level -> nominal Elo. Uncalibrated. */
export const SKILL_PRESETS: readonly { level: number; elo: number }[] = [
  { level: 1, elo: 500 },
  { level: 2, elo: 800 },
  { level: 3, elo: 1000 },
  { level: 4, elo: 1200 },
  { level: 5, elo: 1300 },
  { level: 6, elo: 1400 },
  { level: 7, elo: 1500 },
  { level: 8, elo: 1600 },
  { level: 9, elo: 1700 },
  { level: 10, elo: 1800 },
  { level: 11, elo: 1900 },
  { level: 12, elo: 2000 },
  { level: 13, elo: 2100 },
  { level: 14, elo: 2200 },
  { level: 15, elo: 2300 },
  { level: 16, elo: 2400 },
  { level: 17, elo: 2500 },
  { level: 18, elo: 2650 },
  { level: 19, elo: 2800 },
  { level: 20, elo: 3000 },
];

export const ELO_MIN = 500;
export const ELO_MAX = 3000;
/** The engine's uncapped skill level; the UI calls this full strength. */
export const FULL_STRENGTH_LEVEL = 21;

/** Read the nominal Elo an older skill preset pointed at. */
export function eloForLevel(level: number): number {
  if (level >= FULL_STRENGTH_LEVEL) return ELO_MAX;
  return (
    SKILL_PRESETS.find((preset) => preset.level === level)?.elo ??
    SKILL_PRESETS[0]?.elo ??
    ELO_MIN
  );
}

/** Name the strength the engine is actually applying. */
export function strengthLabel(strength: 'elo' | 'full', elo: number): string {
  return strength === 'full' ? 'Full strength' : `${elo} Elo`;
}

/** Keep an Elo target inside the range the bundled engine accepts. */
export function clampElo(elo: number): number {
  if (!Number.isFinite(elo)) return ELO_MIN;
  return Math.min(ELO_MAX, Math.max(ELO_MIN, Math.round(elo)));
}
