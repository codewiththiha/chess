// Verify the review chat quotes the engine and admits when it has nothing to say.
import { describe, expect, it } from 'vitest';
import {
  answer,
  classify,
  greeting,
  topicsFor,
  type CoachPosition,
} from '../../src/lib/domain/coach';

/** The position after 1. e4 e5, with the engine having just answered. */
function context(overrides: Partial<CoachPosition> = {}): CoachPosition {
  return {
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    turn: 'white',
    ply: 2,
    whiteCp: 20,
    whiteMate: null,
    bestMove: 'g1f3',
    bestSan: 'Nf3',
    pv: ['g1f3', 'b8c6', 'f1b5', 'g8f6'],
    depth: 12,
    grade: 'good',
    loss: 12,
    betterSan: null,
    moves: [
      { san: 'e4', color: 'white', captured: null },
      { san: 'e5', color: 'black', captured: null },
    ],
    human: 'white',
    opponent: 'bot',
    result: '*',
    ...overrides,
  };
}

describe('classifying a question', () => {
  it('maps the questions people actually type to one intent', () => {
    const cases: [string, string][] = [
      ['what is the best move here', 'best'],
      ["what's the strongest move", 'best'],
      ['give me a hint', 'best'],
      ['why was that a mistake', 'why'],
      ['explain that move', 'why'],
      ["what's the plan", 'plan'],
      ['what should i do now', 'plan'],
      ['what is my opponent threatening', 'threat'],
      ['is anything hanging', 'threat'],
      ["who's better", 'eval'],
      ['what do you think of this position', 'eval'],
      ['where did i go wrong', 'worst'],
      ['biggest blunder', 'worst'],
      ['', 'help'],
      ['hello there', 'help'],
    ];
    for (const [question, intent] of cases)
      expect(classify(question), question).toBe(intent);
  });
});

describe('answering from engine output', () => {
  it('quotes the real move, line, and score for the best move', () => {
    const reply = answer("What's the best move?", context());
    expect(reply.intent).toBe('best');
    expect(reply.text).toContain('Nf3');
    expect(reply.text).toContain('Nf3 Nc6 Bb5 Nf6');
    expect(reply.text).toContain('White is better by about 0.20');
    expect(reply.text).toContain('depth 12');
  });

  it('describes a graded mistake with the loss and the better move', () => {
    const reply = answer(
      'why was that bad?',
      context({
        ply: 2,
        grade: 'blunder',
        loss: 320,
        betterSan: 'Nf3',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
      }),
    );
    expect(reply.intent).toBe('why');
    expect(reply.text).toContain('1… e5');
    expect(reply.text).toContain('blunder');
    expect(reply.text).toContain('320 centipawns');
    expect(reply.text).toContain('Nf3');
  });

  it('says a good move needed no fix instead of inventing a criticism', () => {
    const reply = answer('was that good?', context({ grade: 'best' }));
    expect(reply.text).toContain('first choice');
    expect(reply.text).not.toContain('centipawns worse');
  });

  it('names the opponent reply inside the line as the threat', () => {
    const reply = answer('what is he threatening?', context());
    expect(reply.intent).toBe('threat');
    expect(reply.text).toContain('Nc6');
    expect(reply.text).toContain('not a claim about everything on the board');
  });

  it('reports the evaluation and counts captures from the record', () => {
    const reply = answer("who's better?", context({ whiteCp: -180 }));
    expect(reply.intent).toBe('eval');
    expect(reply.text).toContain('Black is better by about 1.80');
    expect(reply.text).toContain('No captures yet');
  });

  it('reports a forced mate without a centipawn claim', () => {
    const reply = answer(
      "who's better?",
      context({ whiteCp: 30000, whiteMate: 3 }),
    );
    expect(reply.text).toContain('White can force mate');
    expect(reply.text).toContain('M3');
    expect(reply.text).not.toContain('better by about');
  });

  it('refuses to grade without a review rather than guessing', () => {
    const reply = answer(
      'where did i go wrong?',
      context({ grade: null, loss: null }),
    );
    expect(reply.intent).toBe('worst');
    expect(reply.text).toContain('Run a review');
    expect(reply.text).not.toMatch(/\d+ centipawns/);
  });

  it('says an evaluation is missing rather than making one up', () => {
    const reply = answer(
      'best move?',
      context({ bestSan: null, whiteCp: null, pv: [] }),
    );
    expect(reply.text).toContain('No engine evaluation');
    expect(reply.text).not.toContain('better by');
  });

  it('tells the reader what it can answer when the question is unclear', () => {
    const reply = answer('hello', context());
    expect(reply.intent).toBe('help');
    expect(reply.text).toContain("What's the best move?");
  });

  it('refuses to discuss a game with no moves', () => {
    const reply = answer('best move?', context({ moves: [], ply: 0 }));
    expect(reply.text).toContain('no moves yet');
  });

  it('greets a loaded game differently from an empty board', () => {
    expect(greeting(context())).toContain('Ask about this position');
    expect(greeting(context({ moves: [] }))).toContain('Load a game');
  });
});

describe('suggested questions', () => {
  it('offers the best move only when the reader is to move', () => {
    expect(topicsFor(context())[0]).toBe("What's the best move?");
    expect(topicsFor(context({ turn: 'black' }))).not.toContain(
      "What's the best move?",
    );
  });

  it('offers the mistake question only for a graded slip', () => {
    expect(topicsFor(context({ grade: 'blunder' }))).toContain(
      'Why was that a mistake?',
    );
    const clean = topicsFor(context({ grade: 'best', turn: 'black' }));
    expect(clean).not.toContain('Why was that a mistake?');
    expect(clean).not.toContain("What's the best move?");
    // Without a review the chat can only offer the question it cannot answer yet.
    expect(topicsFor(context({ grade: null, turn: 'black' }))).toContain(
      'Where did I go wrong?',
    );
  });
});
