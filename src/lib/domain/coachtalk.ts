// Turn what a coach can see into what a coach would say. Every noun, square and
// tactic in a sentence comes from the board or from the engine's own line, so a
// remark can be specific to any game without being written for any game.
import {
  discoveredBy,
  forksBy,
  hangingFor,
  pinsFor,
  pieceOn,
  roleName,
  targetOf,
  kingFor,
  materialFor,
} from './tactics';
import type { ForkFact, PieceFact } from './tactics';
import { position } from './chess';
import { makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { isNormal } from 'chessops/types';
import { formatScore } from './review';
import type { Color, Grade } from './types';
import type { VoiceId } from './chat';

export interface CoachMoment {
  ply: number;
  san: string;
  color: Color;
  /** True when the reader played it, false for the opponent. */
  mine: boolean;
  grade: Grade;
  loss: number;
  /** Position before the move, and after it. */
  before: string;
  after: string;
  uci: string;
  /** The engine's move for the position before it, when one is stored. */
  betterSan: string | null;
  betterUci: string | null;
  /** SAN continuation from `before`, starting with the better move. */
  betterLine: string[];
  /** SAN continuation from `after`: what the engine expects next. */
  continuation: string[];
  /** White-perspective evaluation of the position after the move. */
  scoreAfter: number | null;
  evalMate: number | null;
}

export interface CoachSummary {
  plies: number;
  mistakes: number;
  blunders: number;
  best: number;
  worstSan: string | null;
  worstLoss: number;
  reviewed: boolean;
}

function clause(parts: (string | null | undefined | false)[]): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function list(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** "the knight on e5", ready to drop into a sentence. */
function piecePhrase(fact: PieceFact): string {
  return `the ${roleName(fact.role)} on ${fact.square}`;
}

/** "your rook on b5 and the queen on d5" */
function targetPhrase(fork: ForkFact): string {
  return list(fork.targets.map((target) => piecePhrase(target)));
}

/** "your" for the reader's moves, and the colour's name otherwise. */
function whose(moment: CoachMoment): string {
  return moment.mine
    ? 'your'
    : `${moment.color === 'white' ? 'White' : 'Black'}’s`;
}

/** Play one move, so a suggestion can be tested against the board it changes. */
function playFor(fen: string, uci: string): string {
  const parsed = parseUci(uci);
  const pos = position(fen);
  if (!parsed || !isNormal(parsed) || !pos.isLegal(parsed)) return fen;
  pos.play(parsed);
  return makeFen(pos.toSetup());
}

/** A piece of the side that just moved, left loose by that move. */
function looseLine(moment: CoachMoment): string {
  const loose = hangingFor(moment.after, moment.color).filter(
    (fact) => fact.value >= 3,
  )[0];
  if (!loose) return '';
  const subject = `${whose(moment)} ${roleName(loose.role)} on ${loose.square}`;
  if (!loose.defended)
    return `That leaves ${subject} with nothing defending it, and it is worth ${loose.value}.`;
  if (loose.attackerValue === 1)
    return `That leaves ${subject} where a pawn can take it and only a pawn comes back.`;
  return `That leaves ${subject} attacked by something cheaper than it is.`;
}

/** A pin the side that just moved is now under. */
function pinLine(moment: CoachMoment): string {
  const pin = pinsFor(moment.after, moment.color).toSorted(
    (a, b) => b.value - a.value,
  )[0];
  if (!pin) return '';
  const subject = `${whose(moment)} ${roleName(pin.role)} on ${pin.square}`;
  return pin.behind === 'king'
    ? `It also pins ${subject} to the king, so it cannot move.`
    : `It also pins ${subject} to the ${roleName(pin.behind)} on ${pin.behindSquare}.`;
}

/** Something true when there is no tactic to name. */
function positionalLine(voiceId: VoiceId, moment: CoachMoment): string {
  const king = kingFor(moment.after, moment.color);
  const material = materialFor(moment.after);
  const mine = moment.color === 'white' ? material.white : material.black;
  const theirs = moment.color === 'white' ? material.black : material.white;
  if (theirs - mine >= 2)
    return `Material is ${theirs - mine} points down now, and there is no attack to show for it.`;
  // An uncastled king only matters while there is still an army to attack it.
  const heavy = mine + theirs >= 20;
  if (heavy && !king.castled && king.shelter <= 1 && moment.ply >= 12)
    return 'The king is still in the middle with almost no cover, which is the real problem here.';
  if (heavy && king.heavyOnRank && king.shelter <= 1)
    return 'The back rank is bare, and heavy pieces belong there.';
  if (heavy && king.luft === 0 && moment.ply >= 16)
    return 'There is no air around the king, so every check becomes dangerous.';
  // Nothing to point at on the board, so say plainly that the number moved.
  if (voiceId === 'kyaw-gyi')
    return 'No tactic, no excuse. The engine simply prefers the move I named.';
  if (voiceId === 'nay-chi')
    return 'No tactic explains it; the engine simply likes the other move more.';
  return 'The board does not show the reason yet, but the engine prefers the move I named by a lot.';
}

/** What the engine had instead, with the reason taken from the board. */
export function betterLineFor(moment: CoachMoment): string {
  const better = moment.betterSan;
  if (!better) return '';
  const uci = moment.betterUci;
  const reasons: string[] = [];
  if (uci) {
    const fork = forksBy(moment.before, uci)[0];
    if (fork)
      reasons.push(
        fork.check
          ? `it gives check while hitting ${targetPhrase(fork)}`
          : `it forks ${targetPhrase(fork)}`,
      );
    const discovery = discoveredBy(moment.before, uci)[0];
    if (discovery) {
      const victim = discovery.victim;
      reasons.push(
        victim === 'king'
          ? `it uncovers the ${roleName(discovery.role)} on ${discovery.square} onto the king`
          : `it uncovers the ${roleName(discovery.role)} on ${discovery.square} onto the ${roleName(victim.role)} on ${victim.square}`,
      );
    }
    // Does it keep safe what the played move left loose?
    const loose = hangingFor(moment.after, moment.color)[0];
    if (
      loose &&
      !hangingFor(playFor(moment.before, uci), moment.color).some(
        (fact) => fact.square === loose.square,
      )
    )
      reasons.push(
        `it does not put the ${roleName(loose.role)} where it can be taken`,
      );
    const before = pinsFor(moment.before, moment.color).length;
    const after = pinsFor(playFor(moment.before, uci), moment.color).length;
    if (after < before) reasons.push('it breaks the pin');
    if (!reasons.length) {
      const target = targetOf(uci);
      const moved = target ? pieceOn(moment.before, target.from) : null;
      const home = moment.color === 'white' ? '1' : '8';
      if (target && moved && target.from[1] === home && moved.role !== 'pawn')
        reasons.push(
          `it develops the ${roleName(moved.role)} to ${target.to} and puts it to work`,
        );
      else if (moved?.role === 'pawn')
        reasons.push(
          'it takes the square first instead of loosening the structure',
        );
    }
  }
  if (better.startsWith('O-O-O'))
    reasons.push(
      'it brings the king off the open lines with the rook into play',
    );
  else if (better.startsWith('O-O'))
    reasons.push('it gets the king off the open lines');
  const line = moment.betterLine.slice(1, 4);
  const continuation = line.length
    ? ` The engine’s line after it runs ${line.join(' ')}.`
    : '';
  const reason = reasons.length ? `: ${list(reasons)}` : '';
  return `${better} was the move${reason}.${continuation}`;
}

/** How the played move is judged, in the coach's own manner. */
function verdict(voiceId: VoiceId, moment: CoachMoment): string {
  const pawns = Math.max(1, Math.round(moment.loss / 100));
  const open: Record<VoiceId, Record<Grade, string>> = {
    'kyar-nyo': {
      best: `${moment.san} — that is the move I was worried about.`,
      good: `${moment.san} is patient and good.`,
      inaccuracy: `${moment.san} is only a little loose, nothing to panic about.`,
      mistake: `${moment.san} is a small gift, and I will take it kindly.`,
      blunder: `${moment.san} is a real mistake, around ${pawns} points.`,
    },
    'nay-chi': {
      best: `${moment.san}. Of course you found that.`,
      good: `${moment.san} is fine. Boring, but fine.`,
      inaccuracy: `${moment.san} lets me breathe a little.`,
      mistake: `${moment.san} is a mistake, and I am counting it.`,
      blunder: `${moment.san} is a blunder — about ${pawns} points gone.`,
    },
    'kyaw-gyi': {
      best: `${moment.san}. Correct.`,
      good: `${moment.san} is acceptable.`,
      inaccuracy: `${moment.san} is a concession, small but countable.`,
      mistake: `${moment.san} is a mistake. Name it and move on.`,
      blunder: `${moment.san} is a blunder worth about ${pawns} points.`,
    },
  };
  return open[voiceId][moment.grade];
}

/** The remark for a move that was right. */
function praise(voiceId: VoiceId, moment: CoachMoment): string {
  const discovery = moment.uci
    ? discoveredBy(moment.before, moment.uci)[0]
    : null;
  const bonus = discovery
    ? ` It opens the ${roleName(discovery.role)} on ${discovery.square}, which is why it works.`
    : '';
  const line = moment.continuation.slice(0, 3);
  const continuation = line.length
    ? ` The engine continues ${line.join(' ')}.`
    : '';
  return clause([verdict(voiceId, moment), bonus, continuation]);
}

/** The whole remark for one moment: verdict, evidence, and what was better. */
export function momentMessage(voiceId: VoiceId, moment: CoachMoment): string {
  if (moment.grade === 'best' || moment.grade === 'good')
    return praise(voiceId, moment);
  const next = moment.continuation.slice(0, 3);
  const coming = next.length ? `Expect ${next.join(' ')} from here.` : '';
  const score =
    moment.scoreAfter === null
      ? ''
      : `The engine puts the game at ${formatScore(moment.scoreAfter, moment.evalMate)}.`;
  // Name the tactic if there is one; only fall back to the position at large
  // when the board itself has nothing specific to point at.
  const loose = looseLine(moment);
  const pin = pinLine(moment);
  return clause([
    verdict(voiceId, moment),
    score,
    loose,
    pin,
    loose || pin ? '' : positionalLine(voiceId, moment),
    coming,
    betterLineFor(moment),
  ]);
}

/** The opening remark of a review: what the game held, in real numbers. */
export function summaryMessage(
  voiceId: VoiceId,
  summary: CoachSummary,
): string {
  if (!summary.reviewed)
    return 'Run the review and I will walk the whole game with you, move by move.';
  if (!summary.plies)
    return 'There are no moves to discuss yet. Play or import a game first, then ask me again.';
  const trouble = clause([
    summary.blunders
      ? `${summary.blunders} blunder${summary.blunders > 1 ? 's' : ''}`
      : '',
    summary.mistakes
      ? `${summary.mistakes} mistake${summary.mistakes > 1 ? 's' : ''}`
      : '',
  ]);
  const open: Record<VoiceId, string> = {
    'kyar-nyo': `I read all ${summary.plies} moves, and ${summary.best} of them were exactly right.`,
    'nay-chi': `${summary.plies} moves, ${summary.best} that I would call good, and ${trouble || 'nothing serious'} in between.`,
    'kyaw-gyi': `${summary.plies} moves. ${trouble || 'No blunders'}, and only ${summary.best} that earned respect.`,
  };
  const worst = summary.worstSan
    ? `The one to feel worst about is ${summary.worstSan}: about ${Math.max(1, Math.round(summary.worstLoss / 100))} points gone.`
    : 'There was nothing to be ashamed of in this one.';
  const closer: Record<VoiceId, string> = {
    'kyar-nyo': 'Step through with me and I will point at each moment.',
    'nay-chi': 'Tap a move and I will tell you what to play instead.',
    'kyaw-gyi': 'Read every one of them. That is the work.',
  };
  return `${open[voiceId]} ${worst} ${closer[voiceId]}`;
}
