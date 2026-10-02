// Verify the three voices: what they say, how hard they say it, and when they
// stay quiet instead of repeating themselves.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOICE,
  VOICES,
  chatLine,
  pickSpeechVoice,
  planUtterance,
  talksAt,
  voiceById,
  type ChatKind,
  type SpeechVoice,
} from '../../src/lib/domain/chat';

const KINDS: ChatKind[] = [
  'greet',
  'your-best',
  'your-slip',
  'your-blunder',
  'your-capture',
  'your-check',
  'your-promotion',
  'your-slow',
  'bot-capture',
  'bot-check',
  'bot-promotion',
  'bot-plan',
  'bot-slips',
  'bot-ahead',
  'bot-behind',
  'level',
  'win',
  'lose',
  'draw',
  'hint',
];

describe('the three voices', () => {
  it('are the characters the app ships, each with a manner', () => {
    expect(VOICES.map((voice) => voice.id)).toEqual([
      'kyar-nyo',
      'nay-chi',
      'kyaw-gyi',
    ]);
    for (const voice of VOICES) {
      expect(voice.name.length).toBeGreaterThan(0);
      expect(voice.about.length).toBeGreaterThan(10);
    }
    expect(voiceById(DEFAULT_VOICE).id).toBe('kyar-nyo');
    expect(voiceById(null).id).toBe('kyar-nyo');
    expect(voiceById('someone-else').id).toBe('kyar-nyo');
  });

  it('greet, react to moves, and end a game in every character', () => {
    for (const voice of VOICES)
      for (const kind of [
        'greet',
        'your-blunder',
        'bot-capture',
        'win',
        'lose',
      ] as const)
        expect(talksAt(voice.id, kind), `${voice.id} ${kind}`).toBe(true);
  });

  it('fills a line with the move, the piece, and the cost', () => {
    const lines = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (seed) =>
        chatLine(
          'kyaw-gyi',
          'your-blunder',
          { move: 'Qxf7', loss: 420 },
          seed,
        ) ?? '',
    );
    // Each variant either names the move or quotes what it cost, and all of
    // them are usable lines for the bubble.
    expect(lines.some((line) => line.includes('Qxf7'))).toBe(true);
    expect(lines.some((line) => line.includes('4.2'))).toBe(true);
    for (const line of lines) expect(line.length).toBeGreaterThan(0);
  });

  it('names the captured piece and the plan it intends', () => {
    const capture = chatLine('nay-chi', 'bot-capture', { victim: 'rook' }, 3);
    expect(capture).toContain('rook');
    const plan = chatLine(
      'kyar-gyi',
      'bot-plan',
      {
        reply: 'Nf3',
        plan: 'Bc5',
      },
      7,
    );
    expect(plan).toContain('Nf3');
    expect(plan).toContain('Bc5');
  });

  it('is deterministic for one position and varies across positions', () => {
    const facts = { move: 'e4' };
    for (const kind of KINDS) {
      const first = chatLine('nay-chi', kind, facts, 9);
      expect(chatLine('nay-chi', kind, facts, 9)).toBe(first);
    }
    const seen = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        chatLine('nay-chi', 'greet', {}, seed),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('escalates: kind, then needling, then unsparing', () => {
    const blunder = { move: 'Qxf7', loss: 500 };
    const gentle = chatLine('kyar-nyo', 'your-blunder', blunder, 2) ?? '';
    const sharp = chatLine('nay-chi', 'your-blunder', blunder, 2) ?? '';
    const cold = chatLine('kyaw-gyi', 'your-blunder', blunder, 2) ?? '';
    expect(gentle).toMatch(/sorry|felt bad|Ouch/i);
    expect(sharp).toMatch(/thanks|cannot do that|blunder/i);
    expect(cold).toMatch(/game|blunder|Sit with that/i);
    expect(new Set([gentle, sharp, cold]).size).toBe(3);
  });

  it('tells the truth about the position regardless of who is ahead', () => {
    const behind = [0, 1, 2].map(
      (seed) => chatLine('kyaw-gyi', 'bot-behind', {}, seed) ?? '',
    );
    expect(behind.join(' ')).toMatch(/behind|better/i);
    expect(chatLine('kyaw-gyi', 'lose', {}, 1)).toMatch(/won|played well/i);
    expect(chatLine('kyar-nyo', 'win', {}, 1)).toMatch(/game|enjoyed|won/i);
  });

  it('keeps every line short enough to sit in a bubble', () => {
    for (const voice of VOICES)
      for (const kind of KINDS)
        for (let seed = 0; seed < 40; seed++) {
          const line = chatLine(
            voice.id,
            kind,
            {
              move: 'Nf3',
              victim: 'knight',
              reply: 'Bb5',
              plan: 'O-O',
              loss: 250,
              seconds: 42,
              plies: 20,
            },
            seed,
          );
          if (line === null) continue;
          expect(line.length, `${voice.id} ${kind}`).toBeLessThan(140);
          expect(line).not.toMatch(/\{[a-z]+\}/);
        }
  });
});

describe('saying the lines out loud', () => {
  const platform: SpeechVoice[] = [
    { name: 'Daniel', lang: 'en-GB' },
    { name: 'Samantha', lang: 'en-US' },
    { name: 'Kyaw', lang: 'my-MM' },
  ];

  it('plans an utterance with the character manner', () => {
    const gentle = planUtterance('Good move.', 'kyar-nyo', platform)!;
    expect(gentle.text).toBe('Good move.');
    expect(gentle.voiceName).toBe('Samantha');
    expect(gentle.lang).toBe('en-US');
    expect(gentle.pitch).toBeGreaterThan(1);
    const cold = planUtterance('Qxf7. Sit with that.', 'kyaw-gyi', platform)!;
    expect(cold.voiceName).toBe('Daniel');
    expect(cold.pitch).toBeLessThan(1);
    expect(cold.rate).toBeLessThan(gentle.rate);
  });

  it('picks voices per character and never invents one', () => {
    expect(pickSpeechVoice(platform, voiceById('nay-chi').speech)?.name).toBe(
      'Samantha',
    );
    expect(pickSpeechVoice(platform, voiceById('kyaw-gyi').speech)?.name).toBe(
      'Daniel',
    );
    // No matching platform voice means the first English one, or nothing.
    const unisex: SpeechVoice[] = [{ name: 'Voice 1', lang: 'en-US' }];
    expect(pickSpeechVoice(unisex, voiceById('kyaw-gyi').speech)?.name).toBe(
      'Voice 1',
    );
    expect(pickSpeechVoice([], voiceById('kyaw-gyi').speech)).toBeNull();
    // A platform that only offers a Burmese voice still gets a voice, because
    // speaking in the platform's own language beats staying silent.
    expect(
      pickSpeechVoice(
        [{ name: 'Kyaw', lang: 'my-MM' }],
        voiceById('kyaw-gyi').speech,
        'my',
      )?.lang,
    ).toBe('my-MM');
  });

  it('never mistakes a name for a gender word', () => {
    // "Samantha" contains "man" and is still not a male voice.
    const ordered: SpeechVoice[] = [
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Daniel', lang: 'en-GB' },
    ];
    expect(pickSpeechVoice(ordered, voiceById('kyaw-gyi').speech)?.name).toBe(
      'Daniel',
    );
    expect(pickSpeechVoice(ordered, voiceById('kyar-nyo').speech)?.name).toBe(
      'Samantha',
    );
    // A voice that says what it is still counts, word by word.
    const plain: SpeechVoice[] = [
      { name: 'English (United States)', lang: 'en-US' },
      { name: 'Microsoft Male Voice', lang: 'en-US' },
    ];
    expect(pickSpeechVoice(plain, voiceById('kyaw-gyi').speech)?.name).toBe(
      'Microsoft Male Voice',
    );
  });

  it('says nothing when there is nothing to say', () => {
    expect(planUtterance('   ', 'kyar-nyo', platform)).toBeNull();
    // Without a platform voice it still speaks, in the default language.
    const bare = planUtterance('Check.', 'kyar-nyo', [])!;
    expect(bare.voiceName).toBeNull();
    expect(bare.lang).toBe('en');
  });
});
