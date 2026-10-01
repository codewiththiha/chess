// Validate cross-worker messages instead of asserting JSON to application types.
import { object, text, number, bool, choice } from '../data/validation';
import type { Discovery, Report } from './types';
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid engine list.');
  return value.map((v) => text(v, 128));
}
const nullableNumber = (value: unknown) =>
  value === null || value === undefined ? null : number(value);
const nullableText = (value: unknown) =>
  value === null || value === undefined ? null : text(value, 128);
export function discovery(value: unknown): Discovery {
  const d = object(value);
  const c = object(d.capabilities);
  const controls = object(d.controls);
  const tuning = object(d.tuning);
  if (!Array.isArray(controls.parameters))
    throw new Error('Missing tuning discovery.');
  return {
    capabilities: {
      version: text(c.version, 32),
      modes: strings(c.modes).map((v) =>
        choice(v, ['balanced', 'aggressive', 'human-like', 'analysis']),
      ),
      eloMin: number(c.eloMin),
      eloMax: number(c.eloMax),
      eloCalibrated: bool(c.eloCalibrated),
      maxDepth: number(c.maxDepth),
      maxMultiPv: number(c.maxMultiPv),
      maxHashMiB: number(c.maxHashMiB),
      maxWork: number(c.maxWork),
      simd128: bool(c.simd128),
      liveLimits: bool(c.liveLimits),
      cooperativeSearch: bool(c.cooperativeSearch),
      chess960: bool(c.chess960),
      nativeSyzygy: bool(c.nativeSyzygy),
    },
    controls: {
      behaviors: strings(controls.behaviors),
      parameters: controls.parameters.map((v) => {
        const p = object(v);
        return {
          name: text(p.name, 64),
          default: number(p.default),
          min: number(p.min),
          max: number(p.max),
        };
      }),
    },
    defaults: {
      behaviors: Object.fromEntries(
        Object.entries(object(tuning.behaviors)).map(([k, v]) => [k, bool(v)]),
      ),
      parameters: Object.fromEntries(
        Object.entries(object(tuning.parameters)).map(([k, v]) => [
          k,
          number(v),
        ]),
      ),
    },
  };
}
export function report(value: unknown): Report {
  const r = object(value);
  if (!Array.isArray(r.variations))
    throw new Error('Invalid engine variations.');
  return {
    status: text(r.status, 32),
    finished: bool(r.finished),
    depth: number(r.depth),
    selectiveDepth: number(r.selectiveDepth),
    nodes: text(r.nodes, 20),
    bestMove: nullableText(r.bestMove),
    scoreCp: nullableNumber(r.scoreCp),
    mate: nullableNumber(r.mate),
    pv: strings(r.pv),
    variations: r.variations.map((v) => {
      const line = object(v);
      return { scoreCp: number(line.scoreCp), pv: strings(line.pv) };
    }),
  };
}
export function supportsSimd(): boolean {
  return (
    typeof WebAssembly !== 'undefined' &&
    WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 9, 1, 7,
        0, 65, 0, 253, 15, 26, 11,
      ]),
    )
  );
}
