// Bound cached review evidence and bind it to the exact legal game being restored.
import { object, text, number, bool, timestamp } from './validation';
import { decimal, integer } from '../domain/preferences';
import { ENGINE_REVISION } from '../domain/review';
import { fenAt, moveEntry, bestSan } from '../domain/chess';
import type { GameRecord, ReviewRecord, ReviewPoint } from '../domain/types';
export function decodeReview(value: unknown, game: GameRecord): ReviewRecord {
  const row = object(value);
  if (
    row.version !== 1 ||
    row.gameId !== game.id ||
    row.engineRevision !== ENGINE_REVISION
  )
    throw new Error(
      'Saved review does not match this game or engine revision.',
    );
  const fingerprint = text(row.fingerprint, 32768);
  const identity = object(JSON.parse(fingerprint));
  if (
    identity.revision !== ENGINE_REVISION ||
    identity.start !== game.startFen ||
    identity.chess960 !== game.chess960 ||
    !Array.isArray(identity.moves) ||
    identity.moves.length !== game.moves.length ||
    !identity.moves.every(
      (uci: unknown, ply: number) => uci === game.moves[ply]?.uci,
    )
  )
    throw new Error('Saved review belongs to a different move history.');
  const depth = integer(number(row.depth), 1, 64, 'Review depth');
  const nodeBudget = decimal(text(row.nodeBudget, 20));
  const timeMs = integer(number(row.timeMs), 1, 86400000, 'Review deadline');
  const budget = object(identity.budget);
  if (
    budget.depth !== depth ||
    budget.nodes !== nodeBudget ||
    budget.timeMs !== timeMs
  )
    throw new Error('Saved review budget is inconsistent.');
  if (!Array.isArray(row.points) || row.points.length > game.moves.length + 1)
    throw new Error('Invalid saved review positions.');
  const seen = new Set<number>();
  const points: ReviewPoint[] = row.points.map((pointValue: unknown) => {
    const p = object(pointValue);
    const ply = integer(number(p.ply), 0, game.moves.length, 'Review ply');
    if (seen.has(ply)) throw new Error('Duplicate saved review position.');
    seen.add(ply);
    const fen = fenAt(game, ply);
    const bestMove = p.bestMove === null ? null : text(p.bestMove, 5);
    if (bestMove) moveEntry(fen, bestMove, game.chess960);
    if (!Array.isArray(p.pv) || p.pv.length > 256)
      throw new Error('Invalid saved principal variation.');
    let next = fen;
    const pv = p.pv.map((pvValue: unknown) => {
      const uci = text(pvValue, 5);
      next = moveEntry(next, uci, game.chess960).fen;
      return uci;
    });
    const whiteCp = number(p.whiteCp);
    if (Math.abs(whiteCp) > 1000000)
      throw new Error('Invalid saved evaluation.');
    return {
      ply,
      whiteCp,
      whiteMate:
        p.whiteMate === null
          ? null
          : integer(number(p.whiteMate), -2048, 2048, 'Mate distance'),
      depth: integer(number(p.depth), 0, 64, 'Completed depth'),
      nodes: decimal(text(p.nodes, 20), true),
      bestMove,
      bestSan: bestSan(fen, bestMove),
      pv,
    };
  });
  const complete = bool(row.complete);
  if (complete && points.length !== game.moves.length + 1)
    throw new Error('Saved review is marked complete with missing positions.');
  return {
    version: 1,
    gameId: game.id,
    fingerprint,
    engineRevision: ENGINE_REVISION,
    depth,
    nodeBudget,
    timeMs,
    updatedAt: timestamp(row.updatedAt),
    points: points.toSorted((a, b) => a.ply - b.ply),
    complete,
  };
}
