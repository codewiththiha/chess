// Verify the coach's chess reading: what hangs, what is pinned, what forks, what
// a move discovers, and how safe a king is — all from the board itself.
import { describe, expect, it } from 'vitest';
import {
  discoveredBy,
  forksBy,
  forksFor,
  hangingFor,
  kingFor,
  materialFor,
  pinsFor,
  skewersFor,
  structureFor,
  tacticsFor,
  targetOf,
} from '../../src/lib/domain/tactics';

describe('learning what a position actually holds', () => {
  it('finds a loose piece and says what attacks it', () => {
    // The knight on e5 is attacked by the pawn on d6 and nothing defends it.
    const loose = hangingFor('4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1', 'white');
    expect(loose).toHaveLength(1);
    expect(loose[0]!.square).toBe('e5');
    expect(loose[0]!.role).toBe('knight');
    expect(loose[0]!.attackerValue).toBe(1);
    expect(loose[0]!.attackerRole).toBe('pawn');
    expect(loose[0]!.defended).toBe(false);
    // The same board from Black's side holds nothing loose.
    expect(hangingFor('4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1', 'black')).toEqual(
      [],
    );
  });

  it('counts a piece the enemy king can simply take', () => {
    // Qxf7+ walks into the king, so the queen is en prise and not defended.
    const after =
      'r1bqkbnr/pppp1Qpp/2n5/4p3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3';
    const found = hangingFor(after, 'white');
    expect(found[0]?.square).toBe('f7');
    expect(found[0]?.role).toBe('queen');
    expect(found[0]?.attackerRole).toBe('king');
    expect(found[0]?.defended).toBe(false);
  });

  it('does not call a defended piece loose unless something cheaper hits it', () => {
    // The knight on e5 is attacked by a knight and defended by the bishop: a
    // fair trade, so nothing is loose.
    const loose = hangingFor('4k3/3n4/8/4N3/8/2B5/8/4K3 w - - 0 1', 'white');
    expect(loose).toEqual([]);
    // A queen defended by a bishop is still loose when a pawn attacks it: the
    // pawn takes a queen and the bishop only takes a pawn.
    const queen = hangingFor('4k3/8/2p5/3Q4/4B3/8/8/4K3 w - - 0 1', 'white');
    const d5 = queen.find((one) => one.square === 'd5');
    expect(d5).toBeTruthy();
    expect(d5!.attackerValue).toBe(1);
    expect(d5!.attackerRole).toBe('pawn');
    expect(d5!.defended).toBe(true);
  });

  it('calls a piece pinned to the king absolute, and to a bigger piece relative', () => {
    const absolute = pinsFor('4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1', 'black');
    expect(absolute).toHaveLength(1);
    expect(absolute[0]!.square).toBe('e7');
    expect(absolute[0]!.behind).toBe('king');
    // Same rook, but the knight shields a queen instead: still pinned.
    const relative = pinsFor('k3q3/8/8/8/8/8/4n3/4R1K1 w - - 0 1', 'black');
    expect(relative).toHaveLength(1);
    expect(relative[0]!.square).toBe('e2');
    expect(relative[0]!.behind).toBe('queen');
    // Nothing is pinned on the other side.
    expect(pinsFor('4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1', 'white')).toEqual([]);
  });

  it('finds the fork the side to move can actually play', () => {
    // A knight on b1 jumps to c3 and hits both the rook on b5 and the queen.
    const fen = '7k/8/8/1r1q4/8/8/8/1N2K3 w - - 0 1';
    const knight = forksFor(fen, 'white').find((fork) => fork.to === 'c3');
    expect(knight, 'Nc3 should fork two pieces').toBeTruthy();
    expect(knight!.role).toBe('knight');
    expect(knight!.targets.map((t) => t.square).toSorted()).toEqual([
      'b5',
      'd5',
    ]);
    // Asking for the same fork by move name gives the same answer.
    expect(forksBy(fen, 'b1c3')).toHaveLength(1);
    // The other side has no move to make, so it has no forks to report.
    expect(forksFor(fen, 'black')).toEqual([]);
  });

  it('finds a skewer: the valuable piece in front, the lesser one behind', () => {
    const found = skewersFor('7k/8/r7/q7/8/8/8/R5K1 w - - 0 1', 'white');
    const queen = found.find((fact) => fact.square === 'a5');
    expect(queen, JSON.stringify(found)).toBeTruthy();
    expect(queen!.role).toBe('queen');
    expect(queen!.behind).toBe('rook');
    expect(queen!.behindSquare).toBe('a6');
  });

  it('finds what a move uncovers', () => {
    // The bishop on b2 is blocked by its own knight on d4; moving the knight
    // opens the line onto the black queen on f6.
    const found = discoveredBy('7k/8/5q2/8/3N4/8/1B6/4K3 w - - 0 1', 'd4f5');
    expect(found).toHaveLength(1);
    expect(found[0]!.square).toBe('b2');
    expect(found[0]!.role).toBe('bishop');
    expect(found[0]!.victim).not.toBe('king');
    expect(found[0]!.victim).toMatchObject({ square: 'f6', role: 'queen' });
    // A move that uncovers nothing reports nothing.
    expect(discoveredBy('7k/8/5q2/8/3N4/8/1B6/4K3 w - - 0 1', 'e1e2')).toEqual(
      [],
    );
  });

  it('reads structure and king safety without guessing', () => {
    // Both pawns have no neighbour of their own and a black pawn ahead of them.
    const isolated = structureFor(
      '4k3/8/8/8/1p1p4/8/P1P5/4K3 w - - 0 1',
      'white',
    );
    expect(isolated.map((fact) => fact.kind)).toEqual(['isolated', 'isolated']);
    const doubled = structureFor('4k3/8/8/1p6/8/P7/P7/4K3 w - - 0 1', 'white');
    expect(doubled.some((fact) => fact.kind === 'doubled')).toBe(true);
    const passed = structureFor('4k3/8/8/4P3/8/8/8/4K3 w - - 0 1', 'white');
    expect(passed).toEqual([{ kind: 'passed', square: 'e5' }]);

    // Castled king behind three pawns, with no heavy piece on its rank.
    const safe = kingFor('r5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'white');
    expect(safe.castled).toBe(true);
    expect(safe.shelter).toBe(3);
    expect(safe.onOpenFile).toBe(false);
    expect(safe.heavyOnRank).toBe(false);
    expect(safe.luft).toBe(0);
    // A king stripped of pawns with an enemy rook on its rank is exposed.
    const exposed = kingFor('R2nk3/8/8/8/8/8/8/4K3 w - - 0 1', 'black');
    expect(exposed.castled).toBe(false);
    expect(exposed.onOpenFile).toBe(true);
    expect(exposed.heavyOnRank).toBe(true);
    expect(exposed.shelter).toBe(0);
    expect(exposed.luft).toBeGreaterThan(0);
  });

  it('counts material from the board and nothing else', () => {
    const even = materialFor(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
    );
    expect(even).toEqual({ white: 39, black: 39, diff: 0 });
    const up = materialFor('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    expect(up.diff).toBe(5);
  });

  it('answers in one pass and names the side it read', () => {
    const read = tacticsFor('4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1');
    expect(read.color).toBe('white');
    expect(read.hanging.map((fact) => fact.square)).toEqual(['e5']);
    expect(read.king.castled).toBe(false);
    expect(targetOf('e2e4')).toEqual({ from: 'e2', to: 'e4' });
    expect(targetOf('nonsense')).toBeNull();
  });
});
