// Derive a stable identity for a game so identical play never forks into two rows.
import type { GameRecord } from './types';

function fingerprint(value: string): string {
  // FNV-1a over the exact move list keeps the identity column small and indexable.
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.codePointAt(index) ?? 0);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

export function gameIdentity(record: {
  startFen: string;
  chess960: boolean;
  human: string;
  moves: { uci: string }[];
}): string {
  const moves = record.moves.map((move) => move.uci).join(' ');
  return fingerprint(
    `${record.startFen}|${record.chess960 ? 1 : 0}|${record.human}|${moves}`,
  );
}

export function isStoredGame(record: GameRecord): boolean {
  return record.moves.length > 0;
}
