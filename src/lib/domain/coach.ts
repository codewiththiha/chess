// Answer questions about a game from real engine output, never from guesswork.
import { pvSan } from './chess';
import { formatScore } from './review';
import type { Color, Grade, Opponent, Result, Role } from './types';

export type CoachIntent =
  'best' | 'why' | 'plan' | 'threat' | 'eval' | 'worst' | 'help';

export interface CoachMove {
  san: string;
  color: Color;
  captured: Role | null;
}

/** Everything the review chat may cite, taken from the record and the engine. */
export interface CoachPosition {
  fen: string;
  turn: Color;
  /** Plies played up to the position on screen. */
  ply: number;
  /** White-perspective evaluation of this position, when one exists. */
  whiteCp: number | null;
  whiteMate: number | null;
  /** Engine choice and principal variation for this position, in UCI. */
  bestMove: string | null;
  bestSan: string | null;
  pv: string[];
  depth: number;
  /** Grade of the move that created this position, when a review exists. */
  grade: Grade | null;
  /** Centipawn loss of that move. */
  loss: number | null;
  /** What the engine would have played instead. */
  betterSan: string | null;
  moves: CoachMove[];
  human: Color;
  opponent: Opponent;
  result: Result;
}

export interface CoachMessage {
  id: string;
  role: 'you' | 'coach';
  text: string;
}

export interface CoachAnswer {
  intent: CoachIntent;
  text: string;
}

const PATTERNS: { intent: CoachIntent; match: RegExp }[] = [
  {
    intent: 'worst',
    match: /worst|biggest|blunder|where did (i|it)|go wrong|turning point/i,
  },
  {
    intent: 'threat',
    match: /threat|attacking|what (is|are) they|danger|hanging/i,
  },
  {
    intent: 'plan',
    match: /plan|idea|strategy|should i do|what now|next/i,
  },
  {
    intent: 'why',
    match: /why|explain|how (bad|good)|was that|mistake|inaccuracy/i,
  },
  {
    intent: 'eval',
    match:
      /who('| i)?s (better|winning)|evaluat|score|advantage|good for|position/i,
  },
  {
    intent: 'best',
    match:
      /best|strongest|suggest|recommend|hint|what (should|can) i play|move/i,
  },
];

export function classify(question: string): CoachIntent {
  const text = question.trim();
  if (!text) return 'help';
  for (const { intent, match } of PATTERNS) if (match.test(text)) return intent;
  return 'help';
}

export const COACH_TOPICS = [
  "What's the best move?",
  'Why was that a mistake?',
  "What's the plan?",
  "Who's better?",
  'Where did I go wrong?',
] as const;

/** Suggested questions, ordered by what the position can actually answer. */
export function topicsFor(context: CoachPosition): string[] {
  const topics: string[] = [];
  if (context.turn === context.human) topics.push(COACH_TOPICS[0]);
  if (context.grade && context.grade !== 'best') topics.push(COACH_TOPICS[1]);
  topics.push(COACH_TOPICS[2], COACH_TOPICS[3]);
  if (context.grade === null && context.moves.length)
    topics.push(COACH_TOPICS[4]);
  return topics.slice(0, 3);
}

function side(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

function who(color: Color, context: CoachPosition): string {
  return color === context.human
    ? 'you'
    : context.opponent === 'human'
      ? side(color)
      : 'the bot';
}

function line(fen: string, pv: string[], limit: number): string {
  const sans = pvSan(fen, pv, limit);
  return sans.length ? sans.join(' ') : '';
}

function moveName(context: CoachPosition, ply: number): string {
  const move = context.moves[ply - 1];
  if (!move) return 'that move';
  return `${Math.ceil(ply / 2)}${move.color === 'white' ? '.' : '…'} ${move.san}`;
}

function scoreLine(context: CoachPosition): string {
  const cp = context.whiteCp;
  const mate = context.whiteMate;
  if (cp === null) return '';
  const label = formatScore(cp, mate ?? null);
  if (mate !== null && mate !== 0)
    return `${mate > 0 ? 'White' : 'Black'} can force mate (${label}).`;
  if (cp === 0) return 'The engine sees the position as level.';
  return `${cp > 0 ? 'White' : 'Black'} is better by about ${(Math.abs(cp) / 100).toFixed(2)} (${label}).`;
}

function unavailable(context: CoachPosition): string {
  return context.turn === context.human
    ? 'No engine evaluation for this position yet. It arrives with the next analysis pass, and the arrow is the engine’s own line, not a guess.'
    : 'No engine evaluation for this position yet; the analysis pass for the side to move is still running.';
}

function best(context: CoachPosition): CoachAnswer {
  if (!context.bestSan) return { intent: 'best', text: unavailable(context) };
  const continuation = line(context.fen, context.pv, 6);
  const parts = [
    `${context.bestSan} is the engine’s choice for ${who(context.turn, context)} here (depth ${context.depth}).`,
  ];
  if (continuation) parts.push(`It expects the continuation ${continuation}.`);
  const score = scoreLine(context);
  if (score) parts.push(score);
  return { intent: 'best', text: parts.join(' ') };
}

function why(context: CoachPosition): CoachAnswer {
  if (context.ply === 0 || !context.grade)
    return {
      intent: 'why',
      text: 'There is no graded move at this point yet. Step forward through the game with a review loaded and ask again.',
    };
  const name = moveName(context, context.ply);
  if (context.grade === 'best')
    return {
      intent: 'why',
      text: `${name} was the engine’s own first choice here, so there is nothing to fix. ${scoreLine(context)}`.trim(),
    };
  const loss = context.loss ?? 0;
  const parts = [
    `${name} is graded ${context.grade} — about ${loss} centipawns worse than the engine’s line.`,
  ];
  if (context.betterSan)
    parts.push(`${context.betterSan} was the move it preferred.`);
  const score = scoreLine(context);
  if (score) parts.push(score);
  return { intent: 'why', text: parts.join(' ') };
}

function plan(context: CoachPosition): CoachAnswer {
  const continuation = line(context.fen, context.pv, 8);
  if (!continuation) return { intent: 'plan', text: unavailable(context) };
  const parts = [
    `The engine’s line for this position runs ${continuation}.`,
    context.turn === context.human
      ? `Your side of it starts with ${context.bestSan ?? 'the move shown by the arrow'}.`
      : `${side(context.turn)} is to move, so the plan belongs to them until your turn comes back.`,
  ];
  const score = scoreLine(context);
  if (score) parts.push(score);
  return { intent: 'plan', text: parts.join(' ') };
}

function threat(context: CoachPosition): CoachAnswer {
  // The engine only shows the line for the side to move, so their answer inside
  // that line is the honest threat, not an invented one.
  const reply = pvSan(context.fen, context.pv, 4)[1];
  if (!reply)
    return {
      intent: 'threat',
      text: `${unavailable(context)} Threats appear once the engine prints a line, because the second move of that line is the opponent’s answer.`,
    };
  const mover = side(context.turn === 'white' ? 'black' : 'white');
  return {
    intent: 'threat',
    text: `In the engine’s line, ${mover} answers with ${reply}. That reply is the thing the engine is defending against, not a claim about everything on the board.`,
  };
}

function evaluation(context: CoachPosition): CoachAnswer {
  if (context.whiteCp === null)
    return { intent: 'eval', text: unavailable(context) };
  const score = scoreLine(context);
  const material = context.moves.reduce(
    (total, move) => total + (move.captured ? 1 : 0),
    0,
  );
  const detail = material
    ? ` ${material} ${material === 1 ? 'capture has' : 'captures have'} been made in the moves up to here.`
    : ' No captures yet in the moves up to here.';
  return { intent: 'eval', text: `${score}${detail}` };
}

function worst(context: CoachPosition): CoachAnswer {
  const human = context.human;
  const played = context.moves.length;
  if (!played)
    return { intent: 'worst', text: 'No moves have been played yet.' };
  // The chat only scores the reader's own moves; the stored review holds the
  // grades, so this answers from the move that is actually on screen.
  const move = context.moves[played - 1];
  if (context.grade === null)
    return {
      intent: 'worst',
      text: 'Run a review of this game first: without stored evaluations the chat cannot tell a blunder from a good move, and it will not guess.',
    };
  if (context.grade === 'blunder' || context.grade === 'mistake')
    return {
      intent: 'worst',
      text: `${moveName(context, played)}${move?.color === human ? '' : ' (played by the opponent)'} is the move on screen, and the recorded grade here is ${context.grade}: ${context.loss ?? 0} centipawns lost.`,
    };
  return {
    intent: 'worst',
    text: `The move on screen, ${moveName(context, played)}, is graded ${context.grade}. Step to another move, or use the turning points list, and ask again.`,
  };
}

/** The opening line of a chat, which says what the chat is and is not. */
export function greeting(context: CoachPosition): string {
  return context.moves.length
    ? 'Ask about this position or the game. Every answer comes from the engine’s own evaluation and your saved review.'
    : 'Load a game or a position and ask about it. The chat explains what the engine found, and says so when it has found nothing yet.';
}

function help(context: CoachPosition): CoachAnswer {
  return {
    intent: 'help',
    text: `Ask about this position and the game in your own words — ${topicsFor(
      context,
    ).join(
      ' · ',
    )}. Answers come from the engine’s own evaluation, principal variation, and your stored review, so nothing here is invented.`,
  };
}

/** Compose the reply for one question about one position. */
export function answer(question: string, context: CoachPosition): CoachAnswer {
  const intent = classify(question);
  if (!context.moves.length && intent !== 'help')
    return {
      intent,
      text: 'This game has no moves yet. Play or import a game first, then the chat can discuss real positions.',
    };
  if (intent === 'best') return best(context);
  if (intent === 'why') return why(context);
  if (intent === 'plan') return plan(context);
  if (intent === 'threat') return threat(context);
  if (intent === 'eval') return evaluation(context);
  if (intent === 'worst') return worst(context);
  return help(context);
}
