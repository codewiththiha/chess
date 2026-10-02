// Run the review chat: gather real engine facts, then answer in the reader's words.
import { answer, greeting, topicsFor } from '../domain/coach';
import { grades, whiteScore } from '../domain/review';
import { bestSan } from '../domain/chess';
import type { AppState } from '../state/app.svelte';
import type { CoachPosition } from '../domain/coach';

export class CoachController {
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

  /** Seed the chat once per record so a reopened game keeps its conversation. */
  open(): void {
    if (this.state.coach.length) return;
    this.state.coach = [
      {
        id: crypto.randomUUID(),
        role: 'coach',
        text: greeting(this.context()),
      },
    ];
  }

  reset(): void {
    this.state.coach = [];
  }

  ask(question: string): void {
    const text = question.trim();
    if (!text) return;
    const reply = answer(text, this.context());
    this.state.coach = [
      ...this.state.coach,
      { id: crypto.randomUUID(), role: 'you', text },
      { id: crypto.randomUUID(), role: 'coach', text: reply.text },
    ];
  }
}
