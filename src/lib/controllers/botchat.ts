// Watch the game and let the opponent say what it actually sees.
import {
  chatLine,
  type BotLine,
  type ChatFacts,
  type ChatKind,
} from '../domain/chat';
import { botForGame } from '../domain/bots';
import { whiteScore } from '../domain/review';
import { pvSan } from '../domain/chess';
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

export class BotChatController {
  /** Wall-clock time of the move that is on the board, for the slow-move line. */
  private moveAt = 0;
  /** Position evaluation from the engine, keyed by ply (white's point of view). */
  private readonly evals = new Map<number, Verdict>();
  private pending: Pending | null = null;
  private recordId = '';
  private reportedPly = -1;
  private result = '';
  private lastRemark = -9;
  private lastAhead = -9;
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
    const text = chatLine(bot.voice, kind, facts, ply * 7 + kind.length);
    if (!text) return;
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
    this.evals.clear();
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
  observeReport(report: Report): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    const ply = s.record.moves.length;
    const score = whiteScore(report.scoreCp, report.mate, s.pos.turn);
    if (score !== null)
      this.evals.set(ply, { score, best: report.bestMove ?? null });
    if (ply === this.reportedPly) return;
    this.reportedPly = ply;
    const pending = this.pending;
    if (!pending || pending.ply !== ply) return;
    // The engine has now answered for the position this move created, so the
    // move can be judged against the evaluation that existed before it.
    this.pending = null;
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
    this.judge(pending, loss, report);
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

  private judge(
    pending: Pending,
    loss: number | null,
    report: Report | null,
  ): void {
    const s = this.state;
    const bot = this.bot();
    if (!bot) return;
    const human = s.record.human;
    const mine = pending.move.color !== human;
    const facts: ChatFacts = {
      move: pending.move.san,
      victim: pending.move.captured ?? undefined,
      seconds: pending.seconds,
      loss: loss ?? undefined,
      plies: s.record.moves.length,
    };
    if (report && report.pv.length) {
      const line = pvSan(s.fen, report.pv, 4);
      // The line starts with the reader's move, so the character's own plan is
      // the move after it; that is what it can honestly claim to intend.
      facts.reply = line[0];
      facts.plan = line[1] ?? line[0];
    }
    const ownLoss = loss !== null && mine ? loss : null;
    const theirLoss = loss !== null && !mine ? loss : null;
    if (ownLoss !== null && ownLoss >= 120) {
      this.say('bot-slips', facts, pending.ply);
      return;
    }
    if (mine) {
      this.ownMove(facts, pending, report);
      return;
    }
    this.readerMove(facts, pending, theirLoss);
  }

  /** The character rates its own move, then says what it is playing for. */
  private ownMove(
    facts: ChatFacts,
    pending: Pending,
    report: Report | null,
  ): void {
    if (facts.victim) {
      this.say('bot-capture', facts, pending.ply);
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
    if (report && facts.plan) {
      this.say('bot-plan', facts, pending.ply);
      return;
    }
    this.trend(pending.ply);
  }

  /** The character answers the reader's move, hardest when it was a blunder. */
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
    if (loss !== null && loss >= 200) {
      this.say('your-blunder', facts, pending.ply);
      return;
    }
    if (wasBest) {
      this.say('your-best', facts, pending.ply);
      return;
    }
    if (facts.victim) {
      this.say('your-capture', facts, pending.ply);
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
    if (loss !== null && loss >= 80) {
      this.say('your-slip', facts, pending.ply);
      return;
    }
    if (pending.seconds >= 20) {
      this.say('your-slow', facts, pending.ply);
      return;
    }
    // Ordinary moves get a light comment now and then, not every single ply.
    if (pending.ply - this.lastRemark >= 3) {
      this.say('your-quiet', facts, pending.ply);
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
