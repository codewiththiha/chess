// Compare side-correct scores with explicitly heuristic centipawn-loss grading.
import type { GameRecord, MoveGrade, ReviewPoint } from './types';
export const ENGINE_REVISION = '4e2af5f068e49bf83fe5f1522636c985355b114a';
export function whiteScore(
  cp: number | null,
  mate: number | null,
  turn: 'white' | 'black',
): number | null {
  const sign = turn === 'white' ? 1 : -1;
  if (mate !== null) return (mate > 0 ? 30000 : -30000) * sign;
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
      grade:
        move.uci === before.bestMove
          ? 'best'
          : loss < 50
            ? 'good'
            : loss < 100
              ? 'inaccuracy'
              : loss < 200
                ? 'mistake'
                : 'blunder',
    });
  });
  return result;
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
