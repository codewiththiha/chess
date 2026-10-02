// Import legal mainlines with bounded complexity and export faithful PGN headers.
import {
  PgnParser,
  makePgn,
  defaultGame,
  extend,
  setStartingPosition,
} from 'chessops/pgn';
import type { Game, PgnNodeData } from 'chessops/pgn';
import { studyGame } from './games';
import { position, sanToEntry, fenAt, INITIAL_FEN } from './chess';
import type { GameRecord, Result } from './types';
const RESULTS: Result[] = ['*', '1-0', '0-1', '1/2-1/2'];
export function importPgn(text: string): GameRecord[] {
  if (text.length > 2_000_000)
    throw new Error('PGN files must be smaller than 2 MB.');
  const parsed: Game<PgnNodeData>[] = [];
  const parser = new PgnParser(
    (g, error) => {
      if (error)
        throw new Error(
          'PGN is too complex. Split the file into smaller games.',
        );
      parsed.push(g);
    },
    undefined,
    100_000,
  );
  parser.parse(text);
  if (!parsed.length || parsed.length > 100)
    throw new Error('Import 1–100 games at a time.');
  return parsed.map((g) => {
    const fen = g.headers.get('FEN') ?? INITIAL_FEN;
    const record = studyGame(fen);
    const variant = (g.headers.get('Variant') ?? '')
      .toLowerCase()
      .replace(/[\s_-]/g, '');
    record.chess960 = ['chess960', 'fischerandom', 'fischerrandom'].includes(
      variant,
    );
    if (
      variant &&
      !record.chess960 &&
      !['standard', 'chess', 'normal', 'fromposition'].includes(variant)
    )
      throw new Error('Only standard chess and Chess960 PGNs are supported.');
    record.white = (g.headers.get('White') || 'White').slice(0, 120);
    record.black = (g.headers.get('Black') || 'Black').slice(0, 120);
    record.title = `${record.white} vs ${record.black}`.slice(0, 120);
    record.headers = Object.fromEntries(
      [...g.headers].map(([k, v]) => [k.slice(0, 64), v.slice(0, 512)]),
    );
    for (const node of g.moves.mainline()) {
      if (record.moves.length >= 2048)
        throw new Error('A game can contain up to 2,048 plies.');
      record.moves.push(
        sanToEntry(
          fenAt(record, record.moves.length),
          node.san,
          record.chess960,
        ),
      );
    }
    if (!record.moves.length)
      throw new Error(
        'PGN contains no legal mainline moves. Use FEN to load a position.',
      );
    const result = g.headers.get('Result');
    record.result = RESULTS.find((r) => r === result) ?? '*';
    record.termination = record.result === '*' ? '' : 'Imported result';
    return record;
  });
}
export function exportPgn(record: GameRecord): string {
  const g = defaultGame<PgnNodeData>();
  Object.entries(record.headers).forEach(([k, v]) => {
    g.headers.set(k, v);
  });
  g.headers.set('Event', record.headers.Event ?? 'Local chess');
  g.headers.set('Site', record.headers.Site ?? 'Local device');
  g.headers.set(
    'Date',
    record.headers.Date ??
      new Date(record.createdAt)
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '.'),
  );
  g.headers.set('White', record.white);
  g.headers.set('Black', record.black);
  g.headers.set('Result', record.result);
  g.headers.set(
    'TimeControl',
    record.headers.TimeControl ??
      (record.clock.initialMs
        ? `${record.clock.initialMs / 1000}+${record.clock.incrementMs / 1000}`
        : '-'),
  );
  setStartingPosition(g.headers, position(record.startFen));
  if (record.chess960) g.headers.set('Variant', 'Chess960');
  extend(
    g.moves,
    record.moves.map((m) => ({ san: m.san })),
  );
  return makePgn(g);
}
export const EXAMPLE_PGN =
  '[Event "Tactical example"]\n[White "White"]\n[Black "Black"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';
