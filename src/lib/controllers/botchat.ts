// Watch the game and let the opponent say what it actually sees.
import {
  chatLine,
  isPrize,
  pieceWorth,
  voiceById,
  type BotLine,
  type ChatFacts,
  type ChatKind,
} from '../domain/chat';
import { botForGame } from '../domain/bots';
import { gradeOf } from '../domain/feedback';
import { whiteScore } from '../domain/review';
import { bestSan, fenAt, position } from '../domain/chess';
import type { AppState } from '../state/app.svelte';
import type { MoveEntry } from '../domain/types';
import type { Report } from '../engine/types';

export type Bubble = BotLine;

/** What the engine said about one position, filed by ply. */
interface Verdict {
  score: number;
  best: string | null;
}

/** A move that has been played but not yet judged, waiting for its evaluation. */
interface Pending {
  ply: number;
  move: MoveEntry;
  before: Verdict | null;
  seconds: number;
}

/** Keep a long game readable: the strip shows the newest line plus a little history. */
const KEEP = 40;

/** Whose turn it is in a record at a given ply, without touching the cursor. */
function turnAt(record: AppState['record'], ply: number): 'white' | 'black' {
  return position(fenAt(record, ply)).turn;
}

export class BotChatController {
  /** Wall-clock time of the move that is on the board, for the slow-move line. */
  private moveAt = 0;
  /** Position evaluation from the engine, keyed by ply (white's point of view). */
  private readonly evals = new Map<number, Verdict>();
  private pending: Pending | null = null;
  /** Plies already judged, so one move is never commented on twice. */
  private readonly judged = new Set<number>();
  private recordId = '';
  private reportedPly = -1;
  private result = '';
  private lastRemark = -9;
  private lastAhead = -9;
  /** Lines already used in this game, so nothing is ever said twice. */
  private readonly said = new Set<string>();
  /** Mistakes the reader has made, which decides when advice replaces a remark. */
  private mistakes = 0;
  constructor(private readonly state: AppState) {}

  /** The character that talks in the loaded game, if the opponent is a bot. */
  private bot() {
    const s = this.state;
    return botForGame(s.record, s.bots);
  }

  private say(kind: ChatKind, facts: ChatFacts, ply: number): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    const text = chatLine(
      bot.voice,
      kind,
      facts,
      ply * 7 + kind.length,
      this.said,
    );
    if (!text) return;
    this.said.add(text);
    s.botChat = [
      ...s.botChat,
      { id: crypto.randomUUID(), name: bot.name, ply, text },
    ].slice(-KEEP);
    this.lastRemark = ply;
  }

  /** A fresh game opens with the character introducing the mood. */
  greet(): void {
    const s = this.state;
    this.reset();
    if (!this.bot()) return;
    this.recordId = s.record.id;
    this.result = s.record.result;
    this.reportedPly = -1;
    this.moveAt = performance.now();
    this.say('greet', {}, 0);
  }

  reset(): void {
    this.state.botChat = [];
    this.state.verdict = null;
    this.said.clear();
    this.mistakes = 0;
    this.evals.clear();
    this.judged.clear();
    this.pending = null;
    this.recordId = '';
    this.reportedPly = -1;
    this.result = '';
    this.lastRemark = -9;
    this.lastAhead = -9;
  }

  /**
   * Fold one engine report into what the character knows. The report describes
   * the position on the board, so it is filed against the current ply and used
   * to judge the move that created the position.
   */
  observeReport(
    report: Report,
    at: number = this.state.record.moves.length,
  ): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    // `at` is the ply the search was started for, so a report that arrives after
    // a move is still filed against the position it actually describes.
    const ply = at;
    const score = whiteScore(
      report.scoreCp,
      report.mate,
      turnAt(s.record, ply),
    );
    // Answers for older positions are history; they must never overwrite the
    // scoreboard the character is reading from.
    if (ply < this.reportedPly) return;
    if (score !== null)
      this.evals.set(ply, { score, best: report.bestMove ?? null });
    // A search reports as it deepens, so only the settled answer earns a verdict.
    if (!report.finished || ply === this.reportedPly || this.judged.has(ply))
      return;
    this.reportedPly = ply;
    const pending = this.pending;
    if (!pending || pending.ply !== ply) return;
    // The engine has now answered for the position this move created, so the
    // move can be judged against the evaluation that existed before it.
    this.pending = null;
    this.judged.add(ply);
    const loss =
      pending.before !== null && score !== null
        ? Math.max(
            0,
            Math.round(
              (pending.before.score - score) *
                (pending.move.color === 'white' ? 1 : -1),
            ),
          )
        : null;
    this.judge(pending, loss);
  }

  /** Notice a new move, a resignation, or a finished game. */
  observe(): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    if (this.recordId !== s.record.id) {
      this.recordId = s.record.id;
      this.result = s.record.result;
      this.reportedPly = s.record.moves.length;
      this.moveAt = performance.now();
      return;
    }
    const ply = s.record.moves.length;
    const move = s.record.moves.at(-1);
    if (ply > 0 && move && (!this.pending || this.pending.ply !== ply)) {
      const seconds = (performance.now() - this.moveAt) / 1000;
      this.moveAt = performance.now();
      this.pending = {
        ply,
        move,
        before: this.evals.get(ply - 1) ?? null,
        seconds,
      };
    }
    if (s.record.result !== '*' && this.result === '*') {
      this.result = s.record.result;
      this.finish();
    }
  }

  /** The reader asked the engine for help, and the character notices. */
  heardHint(): void {
    const ply = this.state.record.moves.length;
    if (ply - this.lastRemark < 1) return;
    this.say('hint', {}, ply);
  }

  private judge(pending: Pending, loss: number | null): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    const human = s.record.human;
    const mine = pending.move.color !== human;
    const victim = pending.move.captured ?? undefined;
    // What the engine wanted in the position this move was played from, which
    // is the only move a character may honestly offer as advice.
    const wanted = this.evals.get(pending.ply - 1)?.best ?? null;
    const better =
      !mine && wanted
        ? (bestSan(fenAt(s.record, pending.ply - 1), wanted) ?? undefined)
        : undefined;
    const facts: ChatFacts = {
      move: pending.move.san,
      victim,
      value: victim ? pieceWorth(victim) : undefined,
      better,
      seconds: pending.seconds,
      loss: loss ?? undefined,
      plies: s.record.moves.length,
    };
    const ownLoss = loss !== null && mine ? loss : null;
    const theirLoss = loss !== null && !mine ? loss : null;
    // The board shows the engine's verdict on the move it just judged, unless
    // the engine prefers the move — which is the one case that earns no mark.
    if (loss !== null && loss >= 50 && wanted !== pending.move.uci)
      s.verdict = { ply: pending.ply, grade: gradeOf(loss) };
    if (ownLoss !== null && ownLoss >= 120) {
      this.say('bot-slips', facts, pending.ply);
      return;
    }
    if (mine) {
      this.ownMove(facts, pending);
      return;
    }
    this.readerMove(facts, pending, theirLoss);
  }

  /** The character rates its own move; an ordinary move passes without comment. */
  private ownMove(facts: ChatFacts, pending: Pending): void {
    if (facts.victim) {
      this.say(
        isPrize(pending.move.captured) ? 'bot-prize' : 'bot-capture',
        facts,
        pending.ply,
      );
      return;
    }
    if (pending.move.check) {
      this.say('bot-check', facts, pending.ply);
      return;
    }
    if (pending.move.san.includes('=')) {
      this.say('bot-promotion', facts, pending.ply);
      return;
    }
    // Nothing special happened, so the character says nothing at all.
    this.trend(pending.ply);
  }

  /**
   * The character answers the reader's move. A real mistake is answered with a
   * remark, and now and then — more often for the gentler characters — with the
   * move the engine preferred instead. Anything ordinary passes in silence.
   */
  private readerMove(
    facts: ChatFacts,
    pending: Pending,
    loss: number | null,
  ): void {
    // Praise only the move the engine itself wanted, never a lucky quiet move.
    const wanted = this.evals.get(pending.ply - 1)?.best ?? null;
    const wasBest =
      wanted !== null
        ? pending.move.uci === wanted
        : loss !== null && loss <= 10;
    if (loss !== null && loss >= 80) {
      this.mistakes += 1;
      const teachEvery = voiceById(this.bot()?.voice).teaches;
      const teach = this.mistakes % teachEvery === 0 && Boolean(facts.better);
      if (teach) this.say('your-advice', facts, pending.ply);
      else if (loss >= 200) this.say('your-blunder', facts, pending.ply);
      else this.say('your-slip', facts, pending.ply);
      return;
    }
    if (wasBest) {
      this.say('your-best', facts, pending.ply);
      return;
    }
    if (facts.victim) {
      this.say(
        isPrize(pending.move.captured) ? 'your-prize' : 'your-capture',
        facts,
        pending.ply,
      );
      return;
    }
    if (pending.move.check) {
      this.say('your-check', facts, pending.ply);
      return;
    }
    if (pending.move.san.includes('=')) {
      this.say('your-promotion', facts, pending.ply);
      return;
    }
    if (pending.seconds >= 20) {
      this.say('your-slow', facts, pending.ply);
      return;
    }
    this.trend(pending.ply);
  }

  /** Read the scoreboard out loud, at most every few moves. */
  private trend(ply: number): void {
    const s = this.state;
    if (ply - this.lastRemark < 2 || ply - this.lastAhead < 8) return;
    const verdict = this.evals.get(ply);
    if (!verdict) return;
    const swing = verdict.score * (s.record.human === 'white' ? -1 : 1);
    this.lastAhead = ply;
    if (swing >= 200) this.say('bot-ahead', {}, ply);
    else if (swing <= -200) this.say('bot-behind', {}, ply);
    else if (swing === 0) this.say('level', {}, ply);
  }

  private finish(): void {
    const s = this.state;
    const ply = s.record.moves.length;
    const facts: ChatFacts = { plies: ply };
    const result = s.record.result;
    if (result === '1/2-1/2') {
      this.say('draw', facts, ply);
      return;
    }
    const botWon =
      (result === '1-0' && s.record.human === 'black') ||
      (result === '0-1' && s.record.human === 'white');
    this.say(botWon ? 'win' : 'lose', facts, ply);
  }
}
