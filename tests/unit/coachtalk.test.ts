// Verify the coach's remarks are read off the board, not off a script: the same
// function has to describe two different positions differently.
import { describe, expect, it } from 'vitest';
import {
  betterLineFor,
  momentMessage,
  scoreWords,
  summaryMessage,
  type CoachMoment,
  type CoachSummary,
} from '../../src/lib/domain/coachtalk';

/** One side's standing, in words, from a centipawn score. */
function words(cp: number | null): string {
  return scoreWords(cp, null, 'white', true);
}

/** A royal fork waiting on c7: the knight on b5 hits the rook and the king. */
function royalFork(overrides: Partial<CoachMoment> = {}): CoachMoment {
  return {
    ply: 14,
    san: 'Ke2',
    color: 'white',
    mine: true,
    grade: 'blunder',
    loss: 320,
    before: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 7',
    after: 'r3k3/8/8/8/8/8/4K3/8 b - - 1 7',
    uci: 'e1e2',
    betterSan: 'Nc7+',
    betterUci: 'b5c7',
    betterLine: ['Nc7+', 'Kd8', 'Nxa8'],
    continuation: ['Nc7+', 'Kd8', 'Nxa8'],
    scoreAfter: -320,
    evalMate: null,
    ...overrides,
  };
}

/** The played move left a knight on e5 where a pawn can take it. */
function looseKnight(overrides: Partial<CoachMoment> = {}): CoachMoment {
  return {
    ply: 22,
    san: 'Ne5',
    color: 'white',
    mine: true,
    grade: 'mistake',
    loss: 180,
    before: '4k3/8/3p4/8/8/2N5/8/4K3 w - - 0 11',
    after: '4k3/8/3p4/4N3/8/8/8/4K3 b - - 1 11',
    uci: 'c3e5',
    betterSan: 'Nb1',
    betterUci: 'c3b1',
    betterLine: ['Nb1', 'Ke7', 'Kd2'],
    continuation: ['Ke7', 'Kd2'],
    scoreAfter: -180,
    evalMate: null,
    ...overrides,
  };
}

describe('talking through one move', () => {
  it('names what the better move does, read off the position it changes', () => {
    const text = momentMessage('nay-chi', royalFork());
    expect(text).toContain('Ke2');
    expect(text).toContain('Nc7+');
    expect(text).toContain('check');
    expect(text).toContain('the rook on a8');
  });

  it('finds the loose piece a different move left behind', () => {
    const text = momentMessage('kyar-nyo', looseKnight());
    expect(text).toContain('Ne5');
    expect(text).toContain('knight on e5');
    expect(text).toContain('nothing defending it');
  });

  it('describes two positions differently, because nothing is hardcoded', () => {
    const fork = momentMessage('nay-chi', royalFork());
    const loose = momentMessage('nay-chi', looseKnight());
    expect(fork).not.toBe(loose);
    expect(fork).not.toContain('knight on e5');
    expect(loose).not.toContain('the rook on a8');
  });

  it('never mentions a tactic the position does not have', () => {
    const quiet = momentMessage(
      'kyaw-gyi',
      looseKnight({
        before: '4k3/8/8/8/8/8/8/4K3 w - - 0 11',
        after: '4k3/8/8/8/8/8/8/3K4 b - - 1 11',
        san: 'Kd1',
        uci: 'e1d1',
        betterSan: null,
        betterUci: null,
        betterLine: [],
        continuation: [],
        loss: 150,
      }),
    );
    expect(quiet).not.toContain('forks');
    expect(quiet).not.toContain('pins');
    expect(quiet).not.toContain('nothing defending');
    expect(quiet).toContain('Kd1');
  });

  it('praises a good move without suggesting a replacement', () => {
    const text = momentMessage(
      'kyar-nyo',
      royalFork({
        san: 'Nc7+',
        uci: 'b5c7',
        grade: 'best',
        loss: 0,
        betterSan: null,
        betterUci: null,
        betterLine: [],
      }),
    );
    expect(text).toContain('Nc7+');
    expect(text).not.toContain('was the move');
    expect(text).toContain('continues');
  });

  it('never uses a word the reader would have to translate', () => {
    for (const moment of [royalFork(), looseKnight()]) {
      for (const voice of ['kyar-nyo', 'nay-chi', 'kyaw-gyi'] as const) {
        const text = momentMessage(voice, moment);
        expect(text).not.toMatch(
          /engine|centipawn|\bdepth\b|\bcp\b|points?\b|\bres\b/i,
        );
      }
    }
  });

  it('describes how the game stands in words, not in numbers', () => {
    expect(words(-900)).toContain('lost');
    expect(words(-350)).toContain('clearly worse');
    expect(words(-120)).toContain('worse here');
    expect(words(0)).toBe('The game is still level.');
    expect(words(60)).toContain('slightly better');
    expect(words(120)).toContain('better here');
    expect(words(600)).toContain('winning');
    expect(words(null)).toBe('');
    expect(scoreWords(0, 3, 'white', true)).toContain('mating');
    expect(scoreWords(0, 3, 'black', false)).toContain('getting mated');
    for (const cp of [-900, -350, -120, -40, 0, 40, 60, 600])
      expect(words(cp)).not.toMatch(/\d|engine|centipawn/i);
  });

  it('writes a sentence, not a template', () => {
    for (const moment of [royalFork(), looseKnight()]) {
      const text = momentMessage('kyaw-gyi', moment);
      expect(text).not.toMatch(/[{}]/);
      expect(text).not.toContain('undefined');
      expect(text.length).toBeGreaterThan(40);
      expect(text.trim()).toBe(text);
    }
  });

  it('speaks in the voice of whoever is coaching', () => {
    const lines = (['kyar-nyo', 'nay-chi', 'kyaw-gyi'] as const).map((voice) =>
      momentMessage(voice, royalFork()),
    );
    expect(new Set(lines).size).toBe(3);
    for (const line of lines) expect(line).toContain('Nc7+');
  });

  it('says nothing about a better move when there is none', () => {
    expect(betterLineFor(royalFork({ betterSan: null, betterUci: null }))).toBe(
      '',
    );
  });
});

describe('the queen that walks into the king', () => {
  it('names the piece the king can simply take', () => {
    const text = momentMessage('kyar-nyo', {
      ply: 5,
      san: 'Qxf7+',
      color: 'white',
      mine: true,
      grade: 'blunder',
      loss: 380,
      before: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
      after: 'r1bqkbnr/pppp1Qpp/2n5/4p3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3',
      uci: 'h5f7',
      betterSan: 'Bc4',
      betterUci: 'f1c4',
      betterLine: ['Bc4', 'g6', 'Qd1'],
      continuation: ['Kxf7', 'Bc4', 'd6'],
      scoreAfter: -380,
      evalMate: null,
    });
    expect(text).toContain('queen on f7');
    expect(text).toContain('straight to the king');
    expect(text).toContain('Bc4 was the move');
  });
});

describe('opening a review', () => {
  const summary: CoachSummary = {
    plies: 42,
    mistakes: 3,
    blunders: 2,
    best: 12,
    worstSan: 'Ke2',
    worstLoss: 320,
    reviewed: true,
  };

  it('asks for a review before there are numbers to read', () => {
    const text = summaryMessage('nay-chi', { ...summary, reviewed: false });
    expect(text).toContain('Run the review');
  });

  it('says so when the game has no moves', () => {
    const text = summaryMessage('nay-chi', { ...summary, plies: 0 });
    expect(text).toContain('no moves');
  });

  it('reads the real counts back, per voice', () => {
    const lines = (['kyar-nyo', 'nay-chi', 'kyaw-gyi'] as const).map((voice) =>
      summaryMessage(voice, summary),
    );
    expect(new Set(lines).size).toBe(3);
    for (const line of lines) {
      expect(line).toContain('42');
      expect(line).toContain('Ke2');
      expect(line).not.toMatch(/[{}]/);
    }
  });

  it('has nothing to be ashamed of when the game was clean', () => {
    const text = summaryMessage('kyaw-gyi', {
      ...summary,
      mistakes: 0,
      blunders: 0,
      worstSan: null,
    });
    expect(text).toContain('No blunders');
    expect(text).not.toContain('Ke2');
  });
});
