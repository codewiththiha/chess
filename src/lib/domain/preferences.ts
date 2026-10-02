// Supply honest defaults and validate lossless engine resource budgets.
import { ELO_MAX, ELO_MIN } from './strength';
import { DEFAULT_BOT_ID } from './bots';
import type { ComputeSettings, Preferences } from './types';
export const U64_MAX = '18446744073709551615';
export const COMPUTE_PRESETS: Record<
  'full' | 'balanced' | 'responsive',
  ComputeSettings
> = {
  full: {
    profile: 'full',
    depth: 64,
    nodes: U64_MAX,
    quantum: 1024,
    reportIntervalMs: 100,
    timeMs: null,
  },
  balanced: {
    profile: 'balanced',
    depth: 8,
    nodes: '100000',
    quantum: 256,
    reportIntervalMs: 50,
    timeMs: 1500,
  },
  responsive: {
    profile: 'responsive',
    depth: 6,
    nodes: '50000',
    quantum: 64,
    reportIntervalMs: 100,
    timeMs: 750,
  },
};
export function defaultPreferences(): Preferences {
  return {
    version: 1,
    appearance: 'light',
    board: 'sage',
    pieces: 'chessnut',
    animations: true,
    sound: false,
    coordinates: true,
    legalMoves: true,
    lastMove: true,
    check: true,
    arrows: true,
    arrowCount: 3,
    premove: false,
    speech: true,
    feedback: true,
    evaluation: true,
    botId: DEFAULT_BOT_ID,
    lastGameId: null,
    engine: {
      backend: 'auto',
      mode: 'balanced',
      strength: 'elo',
      elo: 1600,
      hashMiB: 8,
      multiPv: 3,
      seed: '1',
      behaviors: {},
      parameters: {},
      compute: { ...COMPUTE_PRESETS.balanced },
    },
  };
}
export function integer(
  value: number,
  min: number,
  max: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  return value;
}
export function decimal(value: string, zero = false): string {
  if (!/^\d{1,20}$/.test(value))
    throw new Error('Use a decimal integer (up to 20 digits).');
  const n = BigInt(value);
  if (n > BigInt(U64_MAX) || n < (zero ? 0n : 1n))
    throw new Error(`Value must be ${zero ? '0' : '1'}–${U64_MAX}.`);
  return n.toString();
}
export function validatePreferences(p: Preferences): void {
  const e = p.engine;
  const c = e.compute;
  integer(e.elo, ELO_MIN, ELO_MAX, 'Nominal Elo');
  if (e.strength !== 'elo' && e.strength !== 'full')
    throw new Error('Unknown strength setting.');
  integer(p.arrowCount, 1, 4, 'Arrow count');
  if (p.botId !== null && typeof p.botId !== 'string')
    throw new Error('Unknown selected bot.');
  integer(e.hashMiB, 1, 64, 'Hash');
  integer(e.multiPv, 1, 32, 'MultiPV');
  decimal(e.seed, true);
  integer(c.depth, 1, 64, 'Depth');
  decimal(c.nodes);
  integer(c.quantum, 1, 65536, 'Work per slice');
  integer(c.reportIntervalMs, 0, 5000, 'Report interval');
  if (c.timeMs !== null) integer(c.timeMs, 1, 86400000, 'Time budget');
  if (!['balanced', 'aggressive', 'human-like', 'analysis'].includes(e.mode))
    throw new Error('Unknown playing style.');
  if (!['auto', 'portable', 'simd128'].includes(e.backend))
    throw new Error('Unknown engine backend.');
}
