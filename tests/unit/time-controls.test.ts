// Keep the offered presets and the requested bullet/blitz/rapid thresholds honest.
import { describe, expect, it } from 'vitest';
import {
  TIME_CONTROL_GROUPS,
  TIME_LIMITS,
  UNTIMED,
  categoryLabel,
  describeTime,
  sameTimeControl,
} from '../../src/lib/domain/time-controls';

describe('preset time controls', () => {
  it('offers the requested bullet, blitz, and rapid sections in order', () => {
    expect(TIME_CONTROL_GROUPS.map((group) => group.label)).toEqual([
      'Bullet',
      'Blitz',
      'Rapid',
    ]);
    const offered = TIME_CONTROL_GROUPS.flatMap((group) =>
      group.options.map((option) => option.label),
    );
    for (const preset of ['1 min', '2+1', '3 min', '3+2', '5 min', '10 min'])
      expect(offered).toContain(preset);
  });
  it('classifies every preset into the section that offers it', () => {
    for (const group of TIME_CONTROL_GROUPS)
      for (const option of group.options)
        expect(categoryLabel(option.minutes)).toBe(group.label);
  });
});

describe('classification thresholds', () => {
  it('treats one minute or less as bullet', () => {
    expect(categoryLabel(1)).toBe('Bullet');
    expect(categoryLabel(0.5)).toBe('Bullet');
  });
  it('treats under ten minutes as blitz and ten or more as rapid', () => {
    expect(categoryLabel(2)).toBe('Blitz');
    expect(categoryLabel(5)).toBe('Blitz');
    expect(categoryLabel(9)).toBe('Blitz');
    expect(categoryLabel(10)).toBe('Rapid');
    expect(categoryLabel(TIME_LIMITS.minutes)).toBe('Rapid');
    expect(categoryLabel(0)).toBe('Untimed');
  });
});

describe('time descriptions', () => {
  it('names the control and recognizes identical presets', () => {
    expect(describeTime(5, 0)).toBe('5 min');
    expect(describeTime(3, 2)).toBe('3 + 2');
    expect(describeTime(0, 0)).toBe('Untimed');
    expect(sameTimeControl(UNTIMED, { minutes: 0, increment: 0 })).toBe(true);
    expect(
      sameTimeControl(
        { minutes: 3, increment: 0 },
        { minutes: 3, increment: 2 },
      ),
    ).toBe(false);
  });
  it('bounds custom clocks without rejecting the built-in presets', () => {
    const minutes = TIME_CONTROL_GROUPS.flatMap((group) =>
      group.options.map((option) => option.minutes),
    );
    for (const value of minutes)
      expect(value).toBeLessThanOrEqual(TIME_LIMITS.minutes);
    expect(TIME_LIMITS.increment).toBeGreaterThanOrEqual(10);
  });
});
