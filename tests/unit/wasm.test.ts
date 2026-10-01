// Run both verified browser binaries directly, without compiling or mocking Rust.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import * as portable from '../../public/engine/portable/gwaymaegyi_wasm.js';
import * as simd from '../../public/engine/simd128/gwaymaegyi_wasm.js';
import { position, INITIAL_FEN } from '../../src/lib/domain/chess';
import { discovery } from '../../src/lib/engine/protocol';
import { parseUci } from 'chessops/util';
import { object, text } from '../../src/lib/data/validation';
const backends = [
  ['portable', portable],
  ['simd128', simd],
] as const;
beforeAll(async () => {
  for (const [name, module] of backends)
    await module.default({
      module_or_path: await readFile(
        new URL(
          `../../public/engine/${name}/gwaymaegyi_wasm_bg.wasm`,
          import.meta.url,
        ),
      ),
    });
});
for (const [name, module] of backends)
  describe(`${name} Rust WASM`, () => {
    it('discovers the complete controls and true limits', () => {
      const e = new module.Engine();
      try {
        const d = discovery({
          capabilities: JSON.parse(module.capabilities_json()),
          controls: JSON.parse(module.search_controls_json()),
          tuning: JSON.parse(e.tuning_json()),
        });
        expect(d.controls.behaviors).toHaveLength(11);
        expect(d.controls.parameters).toHaveLength(38);
        expect(d.capabilities).toMatchObject({
          maxDepth: 64,
          maxMultiPv: 32,
          maxHashMiB: 64,
          maxWork: 65536,
          eloCalibrated: false,
          nativeSyzygy: false,
          simd128: name === 'simd128',
        });
      } finally {
        e.free();
      }
    });
    it('shares orthodox rules, perft, and Chess960 king-on-target castling', () => {
      expect(module.perft(INITIAL_FEN, 3)).toBe('8902');
      expect(
        module.play_uci('4k3/8/8/8/8/8/8/6KR w H - 0 1', 'g1h1', true),
      ).toContain('5RK1');
    });
    it('accepts every discovered parameter boundary and behavior switch', () => {
      const e = new module.Engine();
      try {
        const d = discovery({
          capabilities: JSON.parse(module.capabilities_json()),
          controls: JSON.parse(module.search_controls_json()),
          tuning: JSON.parse(e.tuning_json()),
        });
        for (const behavior of d.controls.behaviors) {
          e.set_behavior(behavior, false);
          e.set_behavior(behavior, true);
        }
        for (const p of d.controls.parameters) {
          e.set_parameter(p.name, p.min);
          e.set_parameter(p.name, p.max);
          e.set_parameter(p.name, p.default);
        }
        e.configure_skill(
          'human-like',
          21,
          1,
          32,
          false,
          '18446744073709551615',
        );
        expect(e.seed).toBe('18446744073709551615');
        expect(e.skill_level).toBe(21);
      } finally {
        e.free();
      }
    });
    it('produces a legal completed search and bounded distinct MultiPV roots', () => {
      const e = new module.Engine();
      try {
        e.configure_skill('analysis', 21, 1, 3, false, '1');
        e.set_position(INITIAL_FEN, []);
        e.start(4, '10000').free();
        let completed = false;
        for (let i = 0; i < 5000; i++) {
          const r = e.step(256);
          try {
            if (r.finished) {
              const move = r.best_move ? parseUci(r.best_move) : undefined;
              expect(move && position(INITIAL_FEN).isLegal(move)).toBe(true);
              const lines: unknown = JSON.parse(r.variations_json);
              if (!Array.isArray(lines))
                throw new Error('Invalid MultiPV list');
              expect(lines.length).toBeGreaterThan(0);
              expect(lines.length).toBeLessThanOrEqual(3);
              const roots = lines.map((value: unknown) => {
                const pv = object(value).pv;
                if (!Array.isArray(pv))
                  throw new Error('Invalid principal variation');
                return text(pv[0], 5);
              });
              expect(new Set(roots).size).toBe(roots.length);
              for (const root of roots) {
                const parsed = parseUci(root);
                expect(parsed && position(INITIAL_FEN).isLegal(parsed)).toBe(
                  true,
                );
              }
              expect(r.nodes).toMatch(/^\d+$/);
              completed = true;
              break;
            }
          } finally {
            r.free();
          }
        }
        expect(completed).toBe(true);
      } finally {
        e.free();
      }
    });
  });
it('portable and SIMD agree on the same deterministic analysis', () => {
  const scores: number[] = [];
  for (const [, module] of backends) {
    const e = new module.Engine();
    try {
      e.configure_skill('analysis', 21, 1, 1, false, '1');
      e.start(3, '20000').free();
      for (let i = 0; i < 5000; i++) {
        const r = e.step(256);
        try {
          if (r.finished) {
            const score = r.score_cp;
            if (score === undefined) throw new Error('Missing search score');
            scores.push(score);
            break;
          }
        } finally {
          r.free();
        }
      }
    } finally {
      e.free();
    }
  }
  expect(scores).toHaveLength(2);
  expect(scores[0]).toBe(scores[1]);
});
