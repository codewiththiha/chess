// Generate Scharnagl-numbered starting positions without changing legal rules.
import { integer } from './preferences';
export function chess960Fen(id: number): string {
  let n = integer(id, 0, 959, 'Chess960 position');
  const rank = Array<string>(8).fill('');
  rank[(n % 4) * 2 + 1] = 'B';
  n = Math.floor(n / 4);
  rank[(n % 4) * 2] = 'B';
  n = Math.floor(n / 4);
  const free = () => rank.flatMap((p, i) => (p ? [] : [i]));
  const queen = free()[n % 6];
  if (queen === undefined) throw new Error('Invalid Chess960 queen slot.');
  rank[queen] = 'Q';
  n = Math.floor(n / 6);
  const pair = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ][n];
  if (!pair) throw new Error('Invalid Chess960 knight slots.');
  const slots = free();
  for (const index of pair) {
    const slot = slots[index];
    if (slot !== undefined) rank[slot] = 'N';
  }
  free().forEach((slot, i) => {
    rank[slot] = ['R', 'K', 'R'][i] ?? '';
  });
  const rooks = rank
    .flatMap((p, i) => (p === 'R' ? [String.fromCharCode(65 + i)] : []))
    .toReversed()
    .join('');
  return `${rank.join('').toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${rank.join('')} w ${rooks}${rooks.toLowerCase()} - 0 1`;
}
