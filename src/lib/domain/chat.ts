// Give the three opponents a voice: what they say, and how hard they say it.
import type { Color, Role } from './types';

export type VoiceId = 'kyar-nyo' | 'nay-chi' | 'kyaw-gyi';

/** One thing the opponent said, kept so the strip can show the conversation. */
export interface BotLine {
  id: string;
  name: string;
  /** Ply the line was spoken at; 0 is the greeting. */
  ply: number;
  text: string;
}

/** Everything a line may mention, taken from the game the reader can see. */
export interface ChatFacts {
  /** The reader's or the character's move, in standard notation. */
  move?: string;
  /** Piece that was just captured. */
  victim?: Role;
  /** The reply the engine expects from the reader, in standard notation. */
  reply?: string;
  /** The character's own follow-up move from its line. */
  plan?: string;
  /** Centipawns the move on the board cost. */
  loss?: number;
  /** Seconds the reader spent on the move. */
  seconds?: number;
  /** Plies played in the finished game. */
  plies?: number;
}

export type ChatKind =
  | 'greet'
  | 'your-best'
  | 'your-slip'
  | 'your-blunder'
  | 'your-capture'
  | 'your-check'
  | 'your-promotion'
  | 'your-slow'
  | 'your-quiet'
  | 'your-resign'
  | 'bot-capture'
  | 'bot-check'
  | 'bot-promotion'
  | 'bot-plan'
  | 'bot-slips'
  | 'bot-ahead'
  | 'bot-behind'
  | 'level'
  | 'win'
  | 'lose'
  | 'draw'
  | 'hint';

export interface Voice {
  id: VoiceId;
  name: string;
  /** One line describing the voice, shown where the reader picks it. */
  about: string;
  lines: Partial<Record<ChatKind, readonly string[]>>;
}

const PIECE: Record<Role, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

function fill(template: string, facts: ChatFacts): string {
  const pawns =
    facts.loss === undefined ? '' : (Math.max(facts.loss, 0) / 100).toFixed(1);
  return template
    .replaceAll('{move}', facts.move ?? 'that')
    .replaceAll('{victim}', facts.victim ? PIECE[facts.victim] : 'piece')
    .replaceAll('{reply}', facts.reply ?? 'your best try')
    .replaceAll('{plan}', facts.plan ?? 'the next one')
    .replaceAll('{pawns}', pawns)
    .replaceAll('{seconds}', String(Math.round(facts.seconds ?? 0)))
    .replaceAll('{plies}', String(facts.plies ?? 0));
}

/**
 * Kyar Nyo: the gentlest of the three. She notices everything and says it
 * kindly, and she apologises for taking material even while she takes it.
 */
const KYAR_NYO: Voice = {
  id: 'kyar-nyo',
  name: 'Gentle',
  about: 'Warm, chatty, and kind about your mistakes. Still takes the piece.',
  lines: {
    greet: [
      "Hi! Good luck — let's have a nice one.",
      "Hello! I'll try to keep up with you.",
      "Right, I'm ready when you are. Play well!",
    ],
    'your-best': [
      'Ooh, {move} — that was the move I wanted.',
      '{move} is strong. I was hoping you would miss that.',
      'Good move. I have to be careful now.',
    ],
    'your-slip': [
      'Hmm, {move}. I might be able to use that.',
      '{move} gives me a little something to aim at.',
      'Slightly loose, that one. Only a little though!',
    ],
    'your-blunder': [
      'Ouch. I think {move} drops {pawns} pawns — sorry!',
      'Oh no, {move} loses material. I felt bad taking it.',
      '{move} is a big one, about {pawns} pawns. Sorry about your luck.',
    ],
    'your-capture': [
      'Fair enough, the {victim} was loose.',
      'You took the {victim} — I saw that coming and let it happen.',
      'Enjoy the {victim}, I have something in return.',
    ],
    'your-check': [
      'Check! Careful with my king.',
      "You're pushing my king around now.",
      'Check. I can defend, but nicely played.',
    ],
    'your-promotion': [
      'A new queen! Well done, that is real.',
      'You promoted. I have to be honest, that hurts.',
    ],
    'your-slow': [
      'You are thinking hard about {move}. Take your time, I am fine here.',
      '{seconds} seconds on one move — it must be tricky.',
    ],
    'your-quiet': [
      '{move}. Calm and sensible, I like that.',
      'Good, {move} keeps things tidy.',
      'Okay, {move}. I am still comfortable.',
    ],
    'bot-capture': [
      'Sorry, I am taking the {victim}.',
      'The {victim} was hanging, so I helped myself.',
      'I will keep the {victim}, thank you.',
    ],
    'bot-check': [
      'Check — just a small one.',
      'Sorry, check. I am not trying to be rude.',
    ],
    'bot-promotion': [
      'I promoted! That feels lucky.',
      'My pawn made it all the way through.',
    ],
    'bot-plan': [
      'After {reply}, I was thinking {plan}.',
      'I will try {plan} next if you let me.',
    ],
    'bot-slips': [
      'Oh, that was careless from me.',
      'I slipped there. I should have found better.',
    ],
    'bot-ahead': [
      'I think I am a bit better here, but it is not over.',
      'This feels good for me. You can still fight.',
    ],
    'bot-behind': [
      'You are better here. I need to be careful.',
      'Hmm, you have the initiative. Well played so far.',
    ],
    level: [
      'Even game so far. I like it.',
      'Nothing in it yet. Long way to go.',
    ],
    win: [
      'Good game! That was close in places.',
      'I won, but thank you for the game — I enjoyed it.',
    ],
    lose: [
      'You got me. Well played, honestly.',
      'Good game, you were better today.',
      'That was clean. Nice finish.',
    ],
    draw: ['A draw. Fair result, that.', 'Even game. Thanks for playing.'],
    'your-resign': [
      'Thanks for the game — it was a good one.',
      'Fair enough. Well played up to there.',
    ],
    hint: [
      'Need a hand? No shame in it.',
      'Asking for help? I will pretend I did not see.',
    ],
  },
};

/**
 * Nay Chi: confident and quick with a needle, but she still tells the truth
 * about the position and gives you credit when you earn it.
 */
const NAY_CHI: Voice = {
  id: 'nay-chi',
  name: 'Confident',
  about:
    'Plays fast, talks faster. Needles you, then admits when you are right.',
  lines: {
    greet: [
      "Let's go. I don't like long games.",
      'Ready. Try to keep the pieces on the board.',
      'Right — my clock is not going to tick itself.',
    ],
    'your-best': [
      'Fine, {move} was right. I hate that you found it.',
      'Okay, that is the move. Credit where it is due.',
      'You saw {move}. Irritating. Good.',
    ],
    'your-slip': [
      '{move}? I like my position a lot more now.',
      'That loses a bit of ground, {move}. I will take it.',
      'Hmm, {move}. You gave me the tempo I wanted.',
    ],
    'your-blunder': [
      '{move}? That is {pawns} pawns. Thanks, I will bank those.',
      'Oh, {move} drops material. You cannot do that against me.',
      'That is a blunder — {pawns} pawns gone. Keep up.',
    ],
    'your-capture': [
      'Okay, the {victim} is yours. That was part of my plan anyway.',
      'Take the {victim}. I am playing the position, not the material.',
      'Enjoy that {victim}, because it will not happen twice.',
    ],
    'your-check': [
      'Check. I saw it before you did.',
      'Check — you are making me work. Fine.',
      'Check. You are quicker than I expected.',
    ],
    'your-promotion': [
      'A queen. Impressive. Annoying, but impressive.',
      'You promoted? Okay. Now I have to actually try.',
    ],
    'your-slow': [
      '{seconds} seconds for {move}? My nanosecond clock would be dead.',
      'Thinking that long about {move}. Hope it was worth it.',
      'You are burning clock. I am not.',
    ],
    'your-quiet': [
      '{move}. Development. Wake me when you have an idea.',
      'Fine, {move}. You are playing it safe. I can wait.',
      'That is a move. Nothing more than a move, though.',
    ],
    'bot-capture': [
      'Mine. The {victim} was never really yours.',
      'I will take that {victim}, thank you very much.',
      'That {victim} fell straight into my hands.',
    ],
    'bot-check': [
      'Check. Keep it tidy.',
      'Check — you are not the only one attacking.',
    ],
    'bot-promotion': ['Queen. Deal with it.', 'My pawn finished the job.'],
    'bot-plan': [
      'Next: {plan}. Watch closely.',
      'Play {reply} if you want, then I am going {plan}.',
    ],
    'bot-slips': [
      'Bad move from me. Even I do that.',
      'That was sloppy. You should punish it.',
    ],
    'bot-ahead': [
      'You are drifting. I am not in a rush.',
      'This is mine to lose now, and I do not lose these.',
    ],
    'bot-behind': [
      'Okay, you are better. I am not admitting more than that.',
      'You have the pull here. For now.',
    ],
    level: ['Dead level. Somebody has to blink.', 'Nothing in it. Fight me.'],
    win: [
      'Told you. Rematch whenever you feel brave.',
      'Mine. Good game though.',
    ],
    lose: [
      'You got me. That was clean, I will say it once.',
      'Fine. Well played.',
    ],
    draw: ['A draw. We can both be annoyed about that.', 'Level. Rematch?'],
    'your-resign': ['Smart. Saves us both time.', 'Resigned. Sensible.'],
    hint: [
      'Asking the engine now? Bold.',
      'A hint, really? Fine, but I am watching.',
    ],
  },
};

/**
 * Kyaw Gyi: the strongest and the rudest. He never softens a mistake and he
 * expects you to keep up; when you beat him he says so, once, without a smile.
 */
const KYAW_GYI: Voice = {
  id: 'kyaw-gyi',
  name: 'Ruthless',
  about: 'Unsparing. Names every mistake, counts every pawn, applauds nothing.',
  lines: {
    greet: [
      'You have my attention. Briefly.',
      'Start. I have seen your games.',
      'Let us not waste the clock. Play.',
    ],
    'your-best': [
      '{move}. Correct, and still not enough.',
      'The only move. You found it — so did I, from here.',
    ],
    'your-slip': [
      '{move} is a concession. Small, but I count them.',
      'That gives me a target. You should not have played {move}.',
      'Loose. I will collect on that later.',
    ],
    'your-blunder': [
      '{move}. {pawns} pawns. That is the game, and we both know it.',
      'A blunder. I do not need to explain {move} to you.',
      'You handed me {pawns} pawns. Sit with that.',
    ],
    'your-capture': [
      'You took the {victim}. It costs you more than it costs me.',
      'Keep the {victim}. It was a fair trade for the square I get.',
      'Material. The last resort of the worried.',
    ],
    'your-check': [
      'Check. My king does not panic.',
      'A check. Order restored shortly.',
    ],
    'your-promotion': [
      'A queen. Now prove you know how to use it.',
      'Promotion. Rare respect for that.',
    ],
    'your-slow': [
      '{seconds} seconds for {move}. You are already losing the clock as well.',
      'Long thought, weak move. Time is not your ally here.',
    ],
    'your-quiet': [
      '{move}. Acceptable. It changes nothing I have not calculated.',
      'A quiet {move}. The position does not care.',
    ],
    'bot-capture': [
      '{victim} taken. Keep what is left tidy.',
      'That {victim} was yours by accident. It is mine by right.',
      'The {victim}. No comment needed.',
    ],
    'bot-check': [
      'Check. Do not embarrass yourself.',
      'Check. Your king is a tenant.',
    ],
    'bot-promotion': [
      'Promotion. The end is arithmetic now.',
      'Queen. Resume.',
    ],
    'bot-plan': [
      'I intend {plan}. Stop it if you can.',
      'After {reply}, my next move is {plan}. That is not a threat, it is a plan.',
    ],
    'bot-slips': ['Careless. It changes nothing.', 'A slip. Correct it.'],
    'bot-ahead': [
      'This is over unless you find something precise.',
      'You are worse everywhere. Fix one thing at a time.',
    ],
    'bot-behind': [
      'You are better. That is a fact, not a compliment.',
      'I am behind. The position does not care how I feel.',
    ],
    level: ['Level. For now.', 'Balanced. Somebody must improve first.'],
    win: [
      'As expected. Bring a better game next time.',
      'Won. Review it — you will learn more than I will.',
    ],
    lose: [
      'You played well. I do not say that often.',
      'You won. Recognition given.',
    ],
    draw: ['A draw. Acceptable for one of us.', 'Held. Barely.'],
    'your-resign': [
      'Correct decision.',
      'Resigned. That was the professional choice.',
    ],
    hint: [
      'You are asking the engine. It will not be there in the next game.',
      'A hint. Use it — then explain it to yourself.',
    ],
  },
};

export const VOICES: readonly Voice[] = [KYAR_NYO, NAY_CHI, KYAW_GYI];
export const DEFAULT_VOICE: VoiceId = 'kyar-nyo';

export function voiceById(id: string | null | undefined): Voice {
  return VOICES.find((voice) => voice.id === id) ?? KYAR_NYO;
}

function seedOf(seed: number, kind: ChatKind): number {
  let hash = Math.abs(Math.trunc(seed)) * 2654435761;
  for (const character of kind)
    hash = (hash ^ character.charCodeAt(0)) * 16777619;
  return Math.abs(hash);
}

/**
 * What this character says about one event, or null when it has nothing to add
 * (a mild character does not taunt a blunder, and nobody repeats a line twice).
 */
export function chatLine(
  voiceId: string | null | undefined,
  kind: ChatKind,
  facts: ChatFacts,
  seed: number,
): string | null {
  const bank = voiceById(voiceId).lines[kind];
  if (!bank?.length) return null;
  const index = seedOf(seed, kind) % bank.length;
  return fill(bank[index]!, facts);
}

/** Does this character talk at all about the given event? */
export function talksAt(
  voiceId: string | null | undefined,
  kind: ChatKind,
): boolean {
  return Boolean(voiceById(voiceId).lines[kind]?.length);
}

/** Names for the human side of a bubble, used by the tests and the UI. */
export function voiceAbout(id: string | null | undefined): string {
  return voiceById(id).about;
}

export function mention(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}
