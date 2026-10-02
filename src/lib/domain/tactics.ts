// Read a position the way a coach does: what hangs, what is pinned, what a move
// forks, what it discovers, and what it opens. All of it is chess rules applied
// to the board, so nothing here can be invented.
import {
  kingAttacks,
  knightAttacks,
  pawnAttacks,
  attacks,
} from 'chessops/attacks';
import { parseUci, makeSquare, makeUci, opposite } from 'chessops/util';
import { isNormal } from 'chessops/types';
import { position } from './chess';
import type { Chess } from 'chessops/chess';
import type { Color, Role, Square } from 'chessops/types';

/** What each piece is worth, for deciding whether a tactic is worth naming. */
export const VALUE: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100,
};

/** Pieces worth naming in a tactic: a knight and up. */
export const BIG = 3;

const ROLE_NAME: Record<Role, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

export function roleName(role: Role): string {
  return ROLE_NAME[role];
}

export interface PieceFact {
  square: string;
  role: Role;
  value: number;
}

/** A piece attacked and either undefended or attacked by something cheaper. */
export interface HangingFact extends PieceFact {
  /** Cheapest attacker's worth; a pawn attacking a queen is the loudest case. */
  attackerValue: number;
  defended: boolean;
}

/** A piece that cannot move off a line without exposing something behind it. */
export interface PinFact extends PieceFact {
  /** The attacked piece behind it: the king, or a more valuable piece. */
  behind: 'king' | Role;
  behindSquare: string;
}

/** A slider attack on a valuable piece with a lesser piece behind it. */
export interface SkewerFact extends PieceFact {
  behind: Role;
  behindSquare: string;
}

/** One move that hits two valuable pieces at once, or a check that hits one. */
export interface ForkFact {
  from: string;
  to: string;
  role: Role;
  targets: PieceFact[];
  check: boolean;
}

/** A square that gained an attack because another piece stepped off a line. */
export interface DiscoveredFact {
  /** The piece that now has the line, and what it now hits. */
  square: string;
  role: Role;
  victim: PieceFact | 'king';
}

export type StructureKind = 'isolated' | 'doubled' | 'passed';

export interface StructureFact {
  kind: StructureKind;
  square: string;
}

export interface KingFact {
  /** King on the c or g file of its home rank, the usual castled squares. */
  castled: boolean;
  /** Friendly pawns in front of the king and to either side of it. */
  shelter: number;
  onOpenFile: boolean;
  /** Empty forward squares the king could step to, which is its air. */
  luft: number;
  /** An enemy rook or queen sharing the king's rank. */
  heavyOnRank: boolean;
}

export interface Tactics {
  color: Color;
  material: { white: number; black: number; diff: number };
  hanging: HangingFact[];
  pins: PinFact[];
  skewers: SkewerFact[];
  forks: ForkFact[];
  structure: StructureFact[];
  king: KingFact;
}

function name(square: Square): string {
  return makeSquare(square);
}

function valueOf(role: Role): number {
  return VALUE[role];
}

/**
 * Who attacks one square, by colour. A king is not an attacker by default,
 * because a king cannot pin, fork, or discover anything; `withKing` asks for
 * the king too, which is how a piece it can simply take is recognised.
 */
function attackers(
  pos: Chess,
  square: Square,
  by: Color,
  withKing = false,
): Square[] {
  const found: Square[] = [];
  for (const [from, piece] of pos.board) {
    if (piece.color !== by || (piece.role === 'king' && !withKing)) continue;
    const seen =
      piece.role === 'pawn'
        ? pawnAttacks(piece.color, from)
        : attacks(piece, from, pos.board.occupied);
    if (seen.has(square)) found.push(from);
  }
  return found;
}

function cheapest(
  pos: Chess,
  square: Square,
  by: Color,
  withKing = false,
): number {
  let best = Infinity;
  for (const from of attackers(pos, square, by, withKing)) {
    const piece = pos.board.get(from);
    if (piece) best = Math.min(best, valueOf(piece.role));
  }
  return best;
}

/**
 * Pieces of `color` that are loose: attacked and either undefended, or attacked
 * by something cheaper than they are. A king counts as an attacker, because a
 * piece the king can take is genuinely en prise; a king is never listed as one,
 * since a check is not a hanging piece.
 */
export function hangingFor(fen: string, color: Color): HangingFact[] {
  const pos = position(fen);
  const enemy = opposite(color);
  const found: HangingFact[] = [];
  for (const [square, piece] of pos.board) {
    if (piece.color !== color || piece.role === 'king') continue;
    const threat = attackers(pos, square, enemy, true);
    if (!threat.length) continue;
    const attackerValue = cheapest(pos, square, enemy, true);
    const defended = attackers(pos, square, color).length > 0;
    const cheap = attackerValue < valueOf(piece.role);
    if (!defended || cheap)
      found.push({
        square: name(square),
        role: piece.role,
        value: valueOf(piece.role),
        attackerValue,
        defended,
      });
  }
  // The loudest first: the biggest piece taken by the cheapest attacker.
  return found.toSorted(
    (a, b) => b.value - b.attackerValue - (a.value - a.attackerValue),
  );
}

/** Pieces of `color` that are pinned to the king or to something more valuable. */
export function pinsFor(fen: string, color: Color): PinFact[] {
  const pos = position(fen);
  const enemy = opposite(color);
  const found: PinFact[] = [];
  for (const [from, piece] of pos.board) {
    if (piece.color !== enemy) continue;
    if (!['bishop', 'rook', 'queen'].includes(piece.role)) continue;
    const lines = attacks(piece, from, pos.board.occupied);
    for (const square of lines) {
      const target = pos.board.get(square);
      if (!target || target.color !== color) continue;
      // Everything on the line beyond `square`, seen from the attacker.
      let behind: Square | null = null;
      const ray: Square[] = [];
      for (let s = 0; s < 64; s++) ray.push(s);
      for (const beyond of ray) {
        const there = pos.board.get(beyond);
        if (!there || there.color !== color) continue;
        // `square` must sit between the attacker and `beyond`.
        const between = rayBetween(from, beyond);
        if (!between.includes(square)) continue;
        const worth = valueOf(there.role);
        const isKing = there.role === 'king';
        if (!isKing && worth <= valueOf(target.role)) continue;
        behind = beyond;
        break;
      }
      if (behind === null) continue;
      const holder = pos.board.get(behind)!;
      found.push({
        square: name(square),
        role: target.role,
        value: valueOf(target.role),
        behind: holder.role === 'king' ? 'king' : holder.role,
        behindSquare: name(behind),
      });
    }
  }
  return found;
}

/** Squares strictly between two aligned squares, as plain numbers. */
function rayBetween(from: Square, to: Square): Square[] {
  const ff = from % 8;
  const fr = Math.floor(from / 8);
  const tf = to % 8;
  const tr = Math.floor(to / 8);
  const df = Math.sign(tf - ff);
  const dr = Math.sign(tr - fr);
  if (ff !== tf && fr !== tr && Math.abs(tf - ff) !== Math.abs(tr - fr))
    return [];
  const out: Square[] = [];
  let f = ff + df;
  let r = fr + dr;
  while (f !== tf || r !== tr) {
    out.push((r * 8 + f) as Square);
    f += df;
    r += dr;
  }
  return out;
}

/** Enemy pieces of `color` skewered by one of `color`'s sliders. */
export function skewersFor(fen: string, color: Color): SkewerFact[] {
  const pos = position(fen);
  const enemy = opposite(color);
  const found: SkewerFact[] = [];
  for (const [from, piece] of pos.board) {
    if (piece.color !== color) continue;
    if (!['bishop', 'rook', 'queen'].includes(piece.role)) continue;
    for (const square of attacks(piece, from, pos.board.occupied)) {
      const target = pos.board.get(square);
      if (!target || target.color !== enemy) continue;
      const behind = behindOnLine(pos, from, square, enemy);
      if (!behind) continue;
      const holder = pos.board.get(behind.square)!;
      // A skewer wins what is behind: the piece in front must be worth more.
      const worth = valueOf(target.role);
      if (holder.role !== 'king' && valueOf(holder.role) >= worth) continue;
      if (target.role !== 'king' && worth < BIG) continue;
      found.push({
        square: name(square),
        role: target.role,
        value: worth,
        behind: holder.role,
        behindSquare: name(behind.square),
      });
    }
  }
  return found;
}

/** The first piece standing behind `square` on the attacker's line. */
function behindOnLine(
  pos: Chess,
  from: Square,
  square: Square,
  color: Color,
): { square: Square } | null {
  for (let s = 0; s < 64; s++) {
    const there = pos.board.get(s as Square);
    if (!there || there.color !== color) continue;
    const between = rayBetween(from, s as Square);
    if (!between.includes(square)) continue;
    return { square: s as Square };
  }
  return null;
}

/**
 * Moves available to `color` that attack two valuable enemy pieces at once, or
 * that give check while attacking one.
 */
export function forksFor(fen: string, color: Color, limit = 4): ForkFact[] {
  const pos = position(fen);
  if (pos.turn !== color) return [];
  const enemy = opposite(color);
  const found: ForkFact[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const piece = pos.board.get(from);
      if (!piece) continue;
      const probe = pos.clone();
      const parsed = parseUci(makeUci({ from, to }));
      if (!parsed || !probe.isLegal(parsed)) continue;
      probe.play(parsed);
      const targets: PieceFact[] = [];
      const seen =
        piece.role === 'pawn'
          ? pawnAttacks(color, to)
          : attacks(piece, to, probe.board.occupied);
      const check = probe.isCheck();
      for (const square of seen) {
        const victim = probe.board.get(square);
        if (!victim) continue;
        if (victim.color === enemy && valueOf(victim.role) >= BIG)
          targets.push({
            square: name(square),
            role: victim.role,
            value: valueOf(victim.role),
          });
      }
      const kingAttacked = check;
      const enough =
        targets.length >= 2 || (kingAttacked && targets.length >= 1);
      if (!enough) continue;
      found.push({
        from: name(from),
        to: name(to),
        role: piece.role,
        targets: targets.toSorted((a, b) => b.value - a.value),
        check,
      });
    }
  }
  return found
    .toSorted((a, b) => b.targets.length - a.targets.length)
    .slice(0, limit);
}

/** Forks a specific move creates, so a suggestion can say what it would do. */
export function forksBy(fen: string, uci: string): ForkFact[] {
  return forksFor(fen, position(fen).turn).filter(
    (fork) => fork.to === toOf(uci),
  );
}

function toOf(uci: string): string {
  const parsed = parseUci(uci);
  return parsed && isNormal(parsed) ? makeSquare(parsed.to) : '';
}

/** Pieces that gained a line because another friendly piece stepped away. */
export function discoveredBy(fen: string, uci: string): DiscoveredFact[] {
  const before = position(fen);
  const parsed = parseUci(uci);
  if (!parsed || !isNormal(parsed) || !before.isLegal(parsed)) return [];
  const mover = before.board.get(parsed.from);
  if (!mover) return [];
  const after = before.clone();
  after.play(parsed);
  const found: DiscoveredFact[] = [];
  for (const [from, piece] of after.board) {
    if (piece.color !== mover.color) continue;
    if (from === parsed.to) continue;
    if (!['bishop', 'rook', 'queen'].includes(piece.role)) continue;
    const beforeSeen = attacks(piece, from, before.board.occupied);
    for (const square of attacks(piece, from, after.board.occupied)) {
      if (beforeSeen.has(square)) continue;
      const victim = after.board.get(square);
      if (!victim || victim.color === mover.color) continue;
      if (victim.role === 'king') {
        found.push({ square: name(from), role: piece.role, victim: 'king' });
        continue;
      }
      if (valueOf(victim.role) < BIG) continue;
      found.push({
        square: name(from),
        role: piece.role,
        victim: {
          square: name(square),
          role: victim.role,
          value: valueOf(victim.role),
        },
      });
    }
  }
  return found;
}

/** Pawn structure of `color`: isolated, doubled, and passed pawns. */
export function structureFor(fen: string, color: Color): StructureFact[] {
  const pos = position(fen);
  const enemy = opposite(color);
  const mine = pos.board.pieces(color, 'pawn');
  const theirs = pos.board.pieces(enemy, 'pawn');
  const found: StructureFact[] = [];
  for (const square of mine) {
    const file = square % 8;
    const rank = Math.floor(square / 8);
    const neighbours = [file - 1, file + 1].filter((f) => f >= 0 && f <= 7);
    const doubled = [...mine].filter(
      (other) => other !== square && other % 8 === file,
    ).length;
    const flank = neighbours.every((f) => ![...mine].some((p) => p % 8 === f));
    const ahead = [...theirs].some((p) => {
      const pf = p % 8;
      const pr = Math.floor(p / 8);
      const forward = color === 'white' ? pr > rank : pr < rank;
      return forward && Math.abs(pf - file) <= 1;
    });
    if (!ahead) found.push({ kind: 'passed', square: name(square) });
    else if (doubled) found.push({ kind: 'doubled', square: name(square) });
    else if (flank) found.push({ kind: 'isolated', square: name(square) });
  }
  return found;
}

/** How safe `color`'s king is: castled, sheltered, and off open heavy lines. */
export function kingFor(fen: string, color: Color): KingFact {
  const pos = position(fen);
  const enemy = opposite(color);
  const king = pos.board.kingOf(color);
  if (king === undefined)
    return {
      castled: false,
      shelter: 0,
      onOpenFile: false,
      luft: 0,
      heavyOnRank: false,
    };
  const file = king % 8;
  const rank = Math.floor(king / 8);
  const home = color === 'white' ? 0 : 7;
  const castled = rank === home && (file === 6 || file === 2);
  const pawns = pos.board.pieces(color, 'pawn');
  let shelter = 0;
  for (const pawn of pawns) {
    const pf = pawn % 8;
    const pr = Math.floor(pawn / 8);
    const forward = color === 'white' ? pr >= rank : pr <= rank;
    if (forward && Math.abs(pf - file) <= 1) shelter += 1;
  }
  const onOpenFile = ![...pawns].some((pawn) => pawn % 8 === file);
  // Air: forward squares the king could actually step to, given its own pieces.
  const luft = kingSteps(makeSquare(king)).filter((square) => {
    const index = squareSquare(square);
    if (index === null) return false;
    // Only the rank in front counts as air; sideways squares are not escape.
    const forward =
      color === 'white'
        ? Math.floor(index / 8) === rank + 1
        : Math.floor(index / 8) === rank - 1;
    return forward && !pos.board.get(index);
  }).length;
  const heavyOnRank = [
    ...pos.board.pieces(enemy, 'rook'),
    ...pos.board.pieces(enemy, 'queen'),
  ].some((piece) => Math.floor(piece / 8) === rank);
  return { castled, shelter, onOpenFile, luft, heavyOnRank };
}

/** The material balance, counted from the board and never estimated. */
export function materialFor(fen: string): {
  white: number;
  black: number;
  diff: number;
} {
  const pos = position(fen);
  let white = 0;
  let black = 0;
  for (const [, piece] of pos.board) {
    if (piece.role === 'king') continue;
    if (piece.color === 'white') white += valueOf(piece.role);
    else black += valueOf(piece.role);
  }
  return { white, black, diff: white - black };
}

/** Everything a coach may say about one position, in one pass. */
export function tacticsFor(fen: string, color?: Color): Tactics {
  const pos = position(fen);
  const side = color ?? pos.turn;
  return {
    color: side,
    material: materialFor(fen),
    hanging: hangingFor(fen, side),
    pins: pinsFor(fen, side),
    skewers: skewersFor(fen, side),
    forks: forksFor(fen, side),
    structure: structureFor(fen, side),
    king: kingFor(fen, side),
  };
}

/** The piece that stands on a square, for naming it in a sentence. */
export function pieceOn(fen: string, square: string): PieceFact | null {
  const index = squareSquare(square);
  if (index === null) return null;
  const piece = position(fen).board.get(index);
  return piece
    ? { square, role: piece.role, value: valueOf(piece.role) }
    : null;
}

function squareSquare(square: string): Square | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return (rank * 8 + file) as Square;
}

/** The square a UCI move lands on, or null when the move is unreadable. */
export function targetOf(uci: string): { from: string; to: string } | null {
  const parsed = parseUci(uci);
  if (!parsed || !isNormal(parsed)) return null;
  return { from: makeSquare(parsed.from), to: makeSquare(parsed.to) };
}

/** Is this king attacked where it stands? */
export function kingExposed(fen: string, color: Color): boolean {
  const pos = position(fen);
  const king = pos.board.kingOf(color);
  if (king === undefined) return false;
  return attackers(pos, king, opposite(color)).length > 0;
}

/** Reachable by the king in one step, for saying whether it can walk out of a line. */
export function kingSteps(square: string): string[] {
  const index = squareSquare(square);
  if (index === null) return [];
  return [...kingAttacks(index)].map((s) => makeSquare(s));
}

/** Knight jumps from a square, for naming what a knight would hit. */
export function knightSteps(square: string): string[] {
  const index = squareSquare(square);
  if (index === null) return [];
  return [...knightAttacks(index)].map((s) => makeSquare(s));
}
