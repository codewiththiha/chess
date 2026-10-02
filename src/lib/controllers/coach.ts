// Run the review chat: gather real engine facts, then answer in the reader's words.
import { answer, topicsFor } from '../domain/coach';
import { grades, whiteScore } from '../domain/review';
import { bestSan, fenAt, pvSan } from '../domain/chess';
import { momentMessage, summaryMessage } from '../domain/coachtalk';
import type { CoachMoment, CoachSummary } from '../domain/coachtalk';
import type { AppState } from '../state/app.svelte';
import type { CoachMessage, CoachPosition } from '../domain/coach';
import type { GameRecord, MoveGrade } from '../domain/types';

/** How many moments of a game the walkthrough talks about. */
const MOMENTS = 5;

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * The moves worth talking about: the reader's worst moments plus the best moves
 * they found, in the order they happened.
 */
export function keyMoments(record: GameRecord, all: MoveGrade[]): MoveGrade[] {
  const mine = all.filter(
    (grade) => record.moves[grade.ply - 1]?.color === record.human,
  );
  const trouble = mine
    .filter((grade) => grade.grade === 'mistake' || grade.grade === 'blunder')
    .toSorted((a, b) => b.loss - a.loss)
    .slice(0, MOMENTS - 1);
  const best = mine.filter((grade) => grade.grade === 'best').slice(0, 2);
  return [...trouble, ...best]
    .toSorted((a, b) => a.ply - b.ply)
    .slice(0, MOMENTS);
}

export class CoachController {
  /** The review state the current walkthrough was built from. */
  private built = '';
  constructor(private readonly state: AppState) {}

  topics(): string[] {
    return topicsFor(this.context());
  }

  /**
   * Cite the live analysis when it describes the position on screen, and the
   * stored review point otherwise; the two are never mixed into one claim.
   */
  private context(): CoachPosition {
    const s = this.state;
    const record = s.record;
    const point = (s.review?.points ?? []).find((p) => p.ply === s.cursor);
    const graded = grades(record, s.review?.points ?? []).find(
      (g) => g.ply === s.cursor,
    );
    const live = s.report !== null && (s.latest || point === undefined);
    const report = s.report;
    const bestMove = live
      ? (report?.bestMove ?? null)
      : (point?.bestMove ?? null);
    const whiteCp = live
      ? report
        ? whiteScore(report.scoreCp, report.mate, s.pos.turn)
        : null
      : (point?.whiteCp ?? null);
    return {
      fen: s.fen,
      turn: s.pos.turn,
      ply: s.cursor,
      whiteCp,
      whiteMate: live ? (report?.mate ?? null) : (point?.whiteMate ?? null),
      bestMove,
      bestSan: bestMove
        ? live
          ? bestSan(s.fen, bestMove)
          : (point?.bestSan ?? null)
        : null,
      pv: live ? (report?.pv ?? []) : (point?.pv ?? []),
      depth: live ? (report?.depth ?? 0) : (point?.depth ?? 0),
      grade: graded?.grade ?? null,
      loss: graded?.loss ?? null,
      betterSan: graded?.bestSan ?? null,
      moves: record.moves.slice(0, s.cursor).map((move) => ({
        san: move.san,
        color: move.color,
        captured: move.captured,
      })),
      human: record.human,
      opponent: record.opponent,
      result: record.result,
    };
  }

  /** The stored review as one moment the coach can talk about. */
  private moment(grade: MoveGrade): CoachMoment | null {
    const s = this.state;
    const record = s.record;
    const points = s.review?.points ?? [];
    const move = record.moves[grade.ply - 1];
    if (!move) return null;
    const beforePoint = points.find((point) => point.ply === grade.ply - 1);
    const afterPoint = points.find((point) => point.ply === grade.ply);
    const before = fenAt(record, grade.ply - 1);
    const after = fenAt(record, grade.ply);
    const betterUci = beforePoint?.bestMove ?? null;
    return {
      ply: grade.ply,
      san: move.san,
      color: move.color,
      mine: move.color === record.human,
      grade: grade.grade,
      loss: grade.loss,
      before,
      after,
      uci: move.uci,
      betterSan: beforePoint?.bestSan ?? null,
      betterUci,
      betterLine: pvSan(before, beforePoint?.pv ?? [], 5),
      continuation: pvSan(after, afterPoint?.pv ?? [], 4),
      scoreAfter: afterPoint?.whiteCp ?? null,
      evalMate: afterPoint?.whiteMate ?? null,
    };
  }

  private summary(): CoachSummary {
    const s = this.state;
    const points = s.review?.points ?? [];
    const all = grades(s.record, points);
    const mine = all.filter(
      (grade) => s.record.moves[grade.ply - 1]?.color === s.record.human,
    );
    const worst = mine.toSorted((a, b) => b.loss - a.loss)[0];
    return {
      plies: s.record.moves.length,
      mistakes: mine.filter((grade) => grade.grade === 'mistake').length,
      blunders: mine.filter((grade) => grade.grade === 'blunder').length,
      best: mine.filter((grade) => grade.grade === 'best').length,
      worstSan:
        worst && worst.loss >= 100
          ? (s.record.moves[worst.ply - 1]?.san ?? null)
          : null,
      worstLoss: worst?.loss ?? 0,
      reviewed: s.review !== null,
    };
  }

  /**
   * Seed the conversation: a summary of the game and the moments worth reading,
   * each tied to the move it is about so the reader can jump there. Questions
   * the reader asked are kept.
   */
  open(): void {
    const s = this.state;
    const voice = s.gameBot?.voice ?? 'kyar-nyo';
    const key = `${s.record.id}:${s.review?.points.length ?? 0}:${voice}`;
    if (this.built === key) return;
    this.built = key;
    const asked = s.coach.filter((message) => !message.walk);
    const walk: CoachMessage[] = [
      {
        id: `walk-summary-${s.record.id}`,
        role: 'coach',
        text: summaryMessage(voice, this.summary()),
        walk: true,
        ply: null,
      },
    ];
    const points = s.review?.points ?? [];
    if (points.length) {
      for (const grade of keyMoments(s.record, grades(s.record, points))) {
        const moment = this.moment(grade);
        if (!moment) continue;
        const text = momentMessage(voice, moment);
        if (!text) continue;
        walk.push({
          id: `walk-${grade.ply}-${voice}`,
          role: 'coach',
          text,
          walk: true,
          ply: grade.ply,
        });
      }
    }
    s.coach = [...walk, ...asked];
  }

  reset(): void {
    this.state.coach = [];
    this.built = '';
  }

  ask(question: string): void {
    const text = question.trim();
    if (!text) return;
    const reply = answer(text, this.context());
    this.state.coach = [
      ...this.state.coach,
      { id: uuid(), role: 'you', text },
      { id: uuid(), role: 'coach', text: reply.text },
    ];
  }
}
