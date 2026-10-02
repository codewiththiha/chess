// Verify special moves, legal imports, terminal outcomes, and every Chess960 start.
import { describe, expect, it } from 'vitest';
import {
  moveEntry,
  position,
  INITIAL_FEN,
  fenAt,
  drawClaims,
  automaticDraw,
  promotionNeeded,
} from '../../src/lib/domain/chess';
import { chess960Fen } from '../../src/lib/domain/chess960';
import { studyGame, terminalResult } from '../../src/lib/domain/games';
import { importPgn, exportPgn, EXAMPLE_PGN } from '../../src/lib/domain/pgn';
describe('legal chess', () => {
  it('rejects illegal moves and malformed/illegal FEN', () => {
    expect(() => moveEntry(INITIAL_FEN, 'e2e5', false)).toThrow('Illegal');
    expect(() => position('invalid')).toThrow();
    expect(() => position('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
  });
  it('records SAN and canonical FEN for an ordinary move', () => {
    const m = moveEntry(INITIAL_FEN, 'e2e4', false);
    expect(m.san).toBe('e4');
    expect(position(m.fen).turn).toBe('black');
    expect(m.captured).toBeNull();
  });
  it('encodes both orthodox castling inputs for the engine', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    for (const input of ['e1g1', 'e1h1']) {
      const m = moveEntry(fen, input, false);
      expect(m.uci).toBe('e1g1');
      expect(m.san).toBe('O-O');
      expect(m.captured).toBeNull();
      expect(position(m.fen).board.get(5)?.role).toBe('rook');
    }
  });
  it('supports a Chess960 king already on its final castling square', () => {
    const m = moveEntry('4k3/8/8/8/8/8/8/6KR w H - 0 1', 'g1h1', true);
    expect(m.san).toBe('O-O');
    expect(position(m.fen).board.get(6)?.role).toBe('king');
    expect(position(m.fen).board.get(5)?.role).toBe('rook');
  });
  it('records en passant as a captured pawn', () => {
    const m = moveEntry('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6', false);
    expect(m.captured).toBe('pawn');
    expect(position(m.fen).board.get(35)).toBeUndefined();
  });
  it('requires and supports all four promotion choices', () => {
    const fen = '7k/P7/8/8/8/8/8/7K w - - 0 1';
    expect(promotionNeeded(fen, 'a7', 'a8')).toBe(true);
    expect(() => moveEntry(fen, 'a7a8', false)).toThrow();
    for (const role of ['q', 'r', 'b', 'n'])
      expect(moveEntry(fen, `a7a8${role}`, false).san).toContain('=');
  });
  it('checks all 960 numbered starts and orthodox number 518', () => {
    const ranks = new Set<string>();
    for (let id = 0; id < 960; id++) {
      const fen = chess960Fen(id);
      const pos = position(fen);
      const rank = fen.split('/').at(-1)?.split(' ')[0] ?? '';
      ranks.add(rank);
      const bishops = [...pos.board.bishop].filter((s) => s < 8);
      expect((bishops[0] ?? 0) % 2).not.toBe((bishops[1] ?? 0) % 2);
      const rooks = [...pos.board.rook].filter((s) => s < 8);
      expect(rooks[0]).toBeLessThan(pos.board.kingOf('white') ?? -1);
      expect(rooks[1]).toBeGreaterThan(pos.board.kingOf('white') ?? 99);
    }
    expect(ranks.size).toBe(960);
    expect(chess960Fen(518).split('/').at(-1)).toContain('RNBQKBNR');
  });
  it('claims repetition and automatically draws only at five repetitions', () => {
    const g = studyGame();
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const uci of ['g1f3', 'g8f6', 'f3g1', 'f6g8'])
        g.moves.push(moveEntry(fenAt(g, g.moves.length), uci, false));
      if (cycle === 1) {
        expect(drawClaims(g)).toContain('Threefold repetition');
        expect(automaticDraw(g)).toBe(false);
      }
    }
    expect(automaticDraw(g)).toBe(true);
  });
  it('detects the sample checkmate and preserves PGN moves on export', () => {
    const g = importPgn(EXAMPLE_PGN)[0];
    expect(g).toBeDefined();
    if (!g) throw new Error('Missing fixture');
    expect(g.moves).toHaveLength(7);
    expect(terminalResult(g)?.result).toBe('1-0');
    expect(importPgn(exportPgn(g))[0]?.moves.map((m) => m.uci)).toEqual(
      g.moves.map((m) => m.uci),
    );
  });
  it('retains custom starts and Chess960 PGN headers', () => {
    const g = studyGame(chess960Fen(42));
    g.chess960 = true;
    g.moves.push(moveEntry(g.startFen, 'e2e4', true));
    const restored = importPgn(exportPgn(g))[0];
    expect(restored?.chess960).toBe(true);
    expect(restored?.moves[0]?.uci).toBe('e2e4');
  });
  it('rejects illegal PGN and oversized files before returning records', () => {
    expect(() => importPgn('1. e5 *')).toThrow();
    expect(() => importPgn('x'.repeat(2_000_001))).toThrow();
  });
});
