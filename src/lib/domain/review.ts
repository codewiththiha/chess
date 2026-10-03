// Compare side-correct scores with explicitly heuristic centipawn-loss grading.
import { gradeOf } from './feedback';
import { fenAt, position } from './chess';
import type { GameRecord, MoveGrade, ReviewPoint } from './types';
export const ENGINE_REVISION = '4e2af5f068e49bf83fe5f1522636c985355b114a';
/** A mate, or a decided game, is worth more than any ordinary score. */
export const MATE_CP = 30000;
/** The win-percentage curve and the accuracy curve drawn from it. */
const WIN_SCALE = 0.00368208;
const ACCURACY_SCALE = 103.1668;
const ACCURACY_DECAY = 0.04354;
const ACCURACY_OFFSET = 3.1669;
export function whiteScore(
  cp: number | null,
  mate: number | null,
  turn: 'white' | 'black',
): number | null {
  const sign = turn === 'white' ? 1 : -1;
  if (mate !== null) return (mate > 0 ? MATE_CP : -MATE_CP) * sign;
  return cp === null ? null : cp * sign;
}
export function grades(game: GameRecord, points: ReviewPoint[]): MoveGrade[] {
  const byPly = new Map(points.map((p) => [p.ply, p]));
  const result: MoveGrade[] = [];
  game.moves.forEach((move, i) => {
    const before = byPly.get(i);
    const after = byPly.get(i + 1);
    if (!before || !after) return;
    const sign = move.color === 'white' ? 1 : -1;
    const loss = Math.max(
      0,
      Math.round((before.whiteCp - after.whiteCp) * sign),
    );
    result.push({
      ply: i + 1,
      loss,
      bestSan: before.bestSan,
      grade: move.uci === before.bestMove ? 'best' : gradeOf(loss),
    });
  });
  return result;
}
/**
 * What a finished game is worth, from White's point of view: the rail fills for
 * the side that won and levels for a draw, however the game ended.
 */
export function resultValue(record: GameRecord): number | null {
  if (record.result === '1-0') return MATE_CP;
  if (record.result === '0-1') return -MATE_CP;
  if (record.result === '1/2-1/2') return 0;
  return null;
}
/** The share of the rail White fills: a mate or a result fills it outright. */
export function railExtent(whiteCp: number | null): number {
  if (whiteCp === null) return 50;
  if (whiteCp >= MATE_CP) return 100;
  if (whiteCp <= -MATE_CP) return 0;
  return 50 + Math.tanh(whiteCp / 550) * 46;
}
/**
 * Every evaluation settled for this game, by ply: what the engine reported while
 * the game was played, overridden by the deeper review wherever one exists. Only
 * finished searches are recorded, so nothing here is a half-drawn conclusion.
 */
export function evaluationSeries(
  record: GameRecord,
  points: ReviewPoint[],
  evals: Record<number, number> = {},
): Map<number, number> {
  const series = new Map<number, number>();
  for (const [ply, whiteCp] of Object.entries(evals))
    series.set(Number(ply), whiteCp);
  for (const p of points) series.set(p.ply, p.whiteCp);
  const last = position(fenAt(record, record.moves.length));
  if (last.isEnd()) {
    const winner = last.outcome()?.winner;
    series.set(
      record.moves.length,
      winner ? (winner === 'white' ? MATE_CP : -MATE_CP) : 0,
    );
  }
  return series;
}
/**
 * The value the rail shows at a ply: that ply's own evaluation, or the most
 * recent one before it. A move must never blank the rail while the search for
 * the new position is still running.
 */
export function railValue(
  series: Map<number, number>,
  ply: number,
): number | null {
  let value: number | null = null;
  let from = -1;
  for (const [key, whiteCp] of series)
    if (key <= ply && key > from) {
      from = key;
      value = whiteCp;
    }
  return value;
}
function winPercent(whiteCp: number): number {
  return 100 / (1 + Math.exp(-WIN_SCALE * whiteCp));
}
function moveAccuracy(drop: number): number {
  const value =
    ACCURACY_SCALE * Math.exp(-ACCURACY_DECAY * drop) - ACCURACY_OFFSET;
  return Math.max(0, Math.min(100, value));
}
function mean(values: number[]): number {
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}
/**
 * How much of the winning chances each side kept across its own moves: a routine
 * slip costs less than a blunder, and a mate costs nearly everything. Null when
 * too little of the game has been evaluated to say anything at all.
 */
export function accuracyReport(
  record: GameRecord,
  points: ReviewPoint[],
  evals: Record<number, number> = {},
): { white: number; black: number } | null {
  const series = evaluationSeries(record, points, evals);
  const kept: { white: number[]; black: number[] } = { white: [], black: [] };
  record.moves.forEach((move, index) => {
    const before = series.get(index);
    const after = series.get(index + 1);
    if (before === undefined || after === undefined) return;
    const sign = move.color === 'white' ? 1 : -1;
    const was = winPercent(before * sign);
    const now = winPercent(after * sign);
    kept[move.color].push(moveAccuracy(Math.max(0, was - now)));
  });
  if (!kept.white.length || !kept.black.length) return null;
  return { white: mean(kept.white), black: mean(kept.black) };
}
/** The rail's plain-language reading of a score it does not yet know. */
export function evaluationLabel(whiteCp: number | null): string {
  if (whiteCp === null) return 'not known yet';
  if (whiteCp >= MATE_CP) return 'White has a forced mate';
  if (whiteCp <= -MATE_CP) return 'Black has a forced mate';
  return formatScore(whiteCp);
}
export function formatScore(
  cp: number | null,
  mate: number | null = null,
): string {
  if (mate === 0)
    return cp === null || cp === 0
      ? 'Checkmate'
      : cp > 0
        ? 'White wins'
        : 'Black wins';
  if (mate !== null) return `${mate < 0 ? '−' : ''}M${Math.abs(mate)}`;
  if (cp === null) return '—';
  return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)}`.replace('-', '−');
}
export function compactNodes(value: string): string {
  const n = Number(value);
  return n >= 1e9
    ? `${(n / 1e9).toFixed(1)}b`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}m`
      : n >= 1000
        ? `${(n / 1000).toFixed(1)}k`
        : value;
}
