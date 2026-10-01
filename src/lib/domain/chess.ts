// Resolve all legal moves through chessops, including both castling conventions.
import { Chess, castlingSide, normalizeMove } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { makeSanAndPlay, makeSan, parseSan } from 'chessops/san';
import {
  makeUci,
  parseUci,
  parseSquare,
  makeSquare,
  kingCastlesTo,
} from 'chessops/util';
import { isNormal } from 'chessops/types';
import type { Move, Role } from 'chessops/types';
import type { GameRecord, MoveEntry } from './types';
export { INITIAL_FEN };
export function position(fen: string): Chess {
  if (fen.length > 256) throw new Error('FEN is too long.');
  const setup = parseFen(fen.trim());
  if (setup.isErr)
    throw new Error('FEN has invalid piece placement or fields.');
  const result = Chess.fromSetup(setup.value);
  if (result.isErr)
    throw new Error(
      'Position is not legal: check kings, pawns, and the side to move.',
    );
  return result.value;
}
export function legalMove(pos: Chess, uci: string): Move {
  const parsed = parseUci(uci);
  if (!parsed || !pos.isLegal(parsed)) throw new Error(`Illegal move: ${uci}.`);
  return normalizeMove(pos, parsed);
}
export function engineUci(pos: Chess, move: Move, chess960: boolean): string {
  const side = castlingSide(pos, move);
  if (side && isNormal(move) && !chess960)
    return makeUci({ ...move, to: kingCastlesTo(pos.turn, side) });
  return makeUci(move);
}
export function promotionNeeded(
  fen: string,
  from: string,
  to: string,
): boolean {
  const square = parseSquare(from);
  const target = parseSquare(to);
  if (square === undefined || target === undefined) return false;
  return (
    position(fen).board.get(square)?.role === 'pawn' &&
    (target < 8 || target >= 56)
  );
}
export function moveEntry(
  fen: string,
  uci: string,
  chess960: boolean,
): MoveEntry {
  const pos = position(fen);
  const move = legalMove(pos, uci);
  if (!isNormal(move))
    throw new Error('Only standard chess and Chess960 moves are supported.');
  const original = parseUci(uci);
  const from = makeSquare(move.from);
  const to =
    original && isNormal(original)
      ? makeSquare(original.to)
      : makeSquare(move.to);
  const piece = pos.board.get(move.from);
  const castling = castlingSide(pos, move);
  const captured: Role | null = castling
    ? null
    : (pos.board.get(move.to)?.role ??
      (piece?.role === 'pawn' && move.to === pos.epSquare ? 'pawn' : null));
  const encoded = engineUci(pos, move, chess960);
  const color = pos.turn;
  const san = makeSanAndPlay(pos, move);
  return {
    uci: encoded,
    san,
    fen: makeFen(pos.toSetup()),
    color,
    from,
    to,
    captured,
    check: pos.isCheck(),
    whiteMs: 0,
    blackMs: 0,
  };
}
export function fenAt(game: GameRecord, ply: number): string {
  return game.moves[ply - 1]?.fen ?? game.startFen;
}
export function pvSan(fen: string, pv: string[], max = 10): string[] {
  const pos = position(fen);
  const list: string[] = [];
  for (const uci of pv.slice(0, max)) {
    const parsed = parseUci(uci);
    if (!parsed || !pos.isLegal(parsed)) break;
    list.push(makeSanAndPlay(pos, normalizeMove(pos, parsed)));
  }
  return list;
}
export function sanToEntry(
  fen: string,
  san: string,
  chess960: boolean,
): MoveEntry {
  const pos = position(fen);
  const move = parseSan(pos, san);
  if (!move) throw new Error(`Illegal PGN move: ${san}.`);
  return moveEntry(
    fen,
    engineUci(pos, normalizeMove(pos, move), chess960),
    chess960,
  );
}
export function bestSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  const pos = position(fen);
  const parsed = parseUci(uci);
  return parsed && pos.isLegal(parsed)
    ? makeSan(pos, normalizeMove(pos, parsed))
    : null;
}
export function repetitionKey(fen: string): string {
  const pos = position(fen);
  // toSetup drops irrelevant en-passant targets, so equivalent positions agree.
  return makeFen(pos.toSetup()).split(' ').slice(0, 4).join(' ');
}
export function drawClaims(game: GameRecord): string[] {
  const current = fenAt(game, game.moves.length);
  const claims: string[] = [];
  if (position(current).halfmoves >= 100) claims.push('50-move rule');
  const key = repetitionKey(current);
  const repeats = [game.startFen, ...game.moves.map((m) => m.fen)].filter(
    (f) => repetitionKey(f) === key,
  ).length;
  if (repeats >= 3) claims.push('Threefold repetition');
  return claims;
}
export function automaticDraw(game: GameRecord): boolean {
  const fen = fenAt(game, game.moves.length);
  if (position(fen).halfmoves >= 150) return true;
  const key = repetitionKey(fen);
  return (
    [game.startFen, ...game.moves.map((m) => m.fen)].filter(
      (f) => repetitionKey(f) === key,
    ).length >= 5
  );
}
export function material(fen: string): number {
  const values: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
  };
  let score = 0;
  for (const [, piece] of position(fen).board)
    score += values[piece.role] * (piece.color === 'white' ? 1 : -1);
  return score;
}
