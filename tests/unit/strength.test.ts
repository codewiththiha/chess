// Verify the Elo-only strength model and its migration from stored skill levels.
import { describe, expect, it } from 'vitest';
import {
  clampElo,
  eloForLevel,
  ELO_MAX,
  ELO_MIN,
  strengthLabel,
} from '../../src/lib/domain/strength';
import { validatePreferences } from '../../src/lib/domain/preferences';
import { decodePreferences } from '../../src/lib/data/validation';
import {
  defaultPreferences,
  COMPUTE_PRESETS,
} from '../../src/lib/domain/preferences';
import { SKILL_PRESETS } from '../../src/lib/domain/strength';

describe('strength model', () => {
  it("matches the engine's published level-to-Elo presets", () => {
    expect(SKILL_PRESETS).toHaveLength(20);
    expect(eloForLevel(1)).toBe(500);
    expect(eloForLevel(8)).toBe(1600);
    expect(eloForLevel(20)).toBe(3000);
    expect(eloForLevel(21)).toBe(ELO_MAX);
    expect(eloForLevel(0)).toBe(ELO_MIN);
  });

  it('names the strength the engine actually applies', () => {
    expect(strengthLabel('elo', 1200)).toBe('1200 Elo');
    expect(strengthLabel('full', 1200)).toBe('Full strength');
    expect(clampElo(499)).toBe(ELO_MIN);
    expect(clampElo(9000)).toBe(ELO_MAX);
  });

  it('accepts only the two strength modes and 1-4 arrows', () => {
    const preferences = defaultPreferences();
    expect(preferences.engine.strength).toBe('elo');
    expect(preferences.arrowCount).toBe(3);
    expect(preferences.premove).toBe(false);
    expect(() => validatePreferences(preferences)).not.toThrow();
    preferences.arrowCount = 5;
    expect(() => validatePreferences(preferences)).toThrow('Arrow count');
    preferences.arrowCount = 2;
    preferences.engine.elo = 400;
    expect(() => validatePreferences(preferences)).toThrow('Nominal Elo');
  });

  it('migrates stored skill preferences to Elo without losing the target', () => {
    const stored = {
      ...defaultPreferences(),
      arrowCount: undefined,
      premove: undefined,
      engine: {
        ...defaultPreferences().engine,
        strength: 'skill',
        skillLevel: 4,
        elo: 1600,
        compute: { ...COMPUTE_PRESETS.balanced },
      },
    };
    const decoded = decodePreferences(stored);
    expect(decoded.engine.strength).toBe('elo');
    expect(decoded.engine.elo).toBe(1200);
    expect(decoded.arrowCount).toBe(3);
    expect(decoded.premove).toBe(false);
  });

  it('keeps an uncapped skill preference uncapped after migration', () => {
    const stored = {
      ...defaultPreferences(),
      engine: {
        ...defaultPreferences().engine,
        strength: 'skill',
        skillLevel: 21,
        compute: { ...COMPUTE_PRESETS.balanced },
      },
    };
    expect(decodePreferences(stored).engine.strength).toBe('full');
  });
});
