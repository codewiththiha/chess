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
  /** The move the engine wanted instead, in standard notation. */
  better?: string;
  /** What the captured piece is worth, in pawns. */
  value?: number;
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
  | 'your-advice'
  | 'your-capture'
  | 'your-prize'
  | 'your-check'
  | 'your-promotion'
  | 'your-slow'
  | 'your-resign'
  | 'bot-capture'
  | 'bot-prize'
  | 'bot-check'
  | 'bot-promotion'
  | 'bot-slips'
  | 'bot-ahead'
  | 'bot-behind'
  | 'level'
  | 'win'
  | 'lose'
  | 'draw'
  | 'hint';

export interface SpeechProfile {
  /** How fast the character talks, relative to the system voice. */
  rate: number;
  pitch: number;
  /** Which kind of system voice to look for, when the platform offers a choice. */
  gender: 'feminine' | 'masculine';
}

export interface Voice {
  id: VoiceId;
  name: string;
  /** One line describing the voice, shown where the reader picks it. */
  about: string;
  /**
   * How often this character answers a mistake with advice instead of a remark.
   * The gentler the character, the more often it teaches.
   */
  teaches: number;
  /** How it sounds when the platform can speak the lines. */
  speech: SpeechProfile;
  lines: Partial<Record<ChatKind, readonly string[]>>;
}

/** The part of a platform voice this app needs; kept small so it can be tested. */
export interface SpeechVoice {
  name: string;
  lang: string;
}

export interface Utterance {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voiceName: string | null;
}

const FEMININE_NAMES = [
  'amy',
  'zira',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'serena',
  'joanna',
  'aria',
  'jenny',
  'salli',
  'nicky',
];
const FEMININE_WORDS = ['female', 'woman'];
const MASCULINE_NAMES = [
  'david',
  'mark',
  'daniel',
  'alex',
  'fred',
  'george',
  'oliver',
  'thomas',
  'guy',
  'ryan',
  'brian',
  'matthew',
  'aaron',
];
const MASCULINE_WORDS = ['male', 'man'];

/**
 * Does this platform voice sound like the gender a character speaks in? A known
 * voice name is enough on its own; a general word only counts when it stands
 * alone, because "Samantha" contains "man" and is nobody's male voice.
 */
function soundsLike(
  voice: SpeechVoice,
  names: readonly string[],
  words: readonly string[],
): boolean {
  const name = voice.name.toLowerCase();
  return (
    names.some((one) => name.includes(one)) ||
    name.split(/[^a-z]+/).some((part) => words.includes(part))
  );
}

/** Find a platform voice for one character, never inventing one that is absent. */
export function pickSpeechVoice(
  voices: readonly SpeechVoice[],
  profile: SpeechProfile,
  lang = 'en',
): SpeechVoice | null {
  const candidates = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(lang),
  );
  const feminine = profile.gender === 'feminine';
  const named = candidates.find((voice) =>
    soundsLike(
      voice,
      feminine ? FEMININE_NAMES : MASCULINE_NAMES,
      feminine ? FEMININE_WORDS : MASCULINE_WORDS,
    ),
  );
  return named ?? candidates[0] ?? null;
}

/**
 * What to hand the platform's speech engine for one line, or null when there is
 * nothing to say. Pure, so the plan can be tested without a speaking platform.
 */
export function planUtterance(
  text: string,
  voiceId: string | null | undefined,
  voices: readonly SpeechVoice[] = [],
  lang = 'en',
): Utterance | null {
  const line = text.trim();
  if (!line) return null;
  const profile = voiceById(voiceId).speech;
  const chosen = pickSpeechVoice(voices, profile, lang);
  return {
    text: line,
    lang: chosen?.lang ?? lang,
    rate: profile.rate,
    pitch: profile.pitch,
    voiceName: chosen?.name ?? null,
  };
}

const PIECE: Record<Role, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

/** What each piece is worth in pawns, used when a capture deserves a joke. */
const WORTH: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/** A capture worth this much or more gets a joke of its own. */
export const PRIZE_WORTH = 5;

export function pieceWorth(role: Role | null | undefined): number {
  return role ? WORTH[role] : 0;
}

/** Is this capture worth a bigger reaction than an ordinary pawn? */
export function isPrize(role: Role | null | undefined): boolean {
  return pieceWorth(role) >= PRIZE_WORTH;
}

/** Does this line ask for a fact the event does not have? */
function needs(template: string, facts: ChatFacts): boolean {
  if (template.includes('{better}') && !facts.better) return true;
  if (template.includes('{victim}') && !facts.victim) return true;
  if (template.includes('{value}') && !facts.victim) return true;
  return false;
}

function fill(template: string, facts: ChatFacts): string {
  const pawns =
    facts.loss === undefined ? '' : (Math.max(facts.loss, 0) / 100).toFixed(1);
  const value = facts.value ?? pieceWorth(facts.victim);
  return template
    .replaceAll('{move}', facts.move ?? 'that')
    .replaceAll('{victim}', facts.victim ? PIECE[facts.victim] : 'piece')
    .replaceAll('{better}', facts.better ?? 'the quiet move')
    .replaceAll('{value}', String(value))
    .replaceAll('{pawns}', pawns)
    .replaceAll('{seconds}', String(Math.round(facts.seconds ?? 0)))
    .replaceAll('{plies}', String(Math.round(facts.plies ?? 0)));
}

/**
 * Kyar Nyo: the gentlest of the three. She notices everything, says it kindly,
 * teaches more often than she teases, and apologises for taking material even
 * while she takes it.
 */
const KYAR_NYO: Voice = {
  id: 'kyar-nyo',
  name: 'Gentle',
  about: 'Warm, chatty, and kind about your mistakes. Still takes the piece.',
  teaches: 2,
  speech: { rate: 1, pitch: 1.15, gender: 'feminine' },
  lines: {
    greet: [
      "Hi! Good luck — let's have a nice one.",
      "Hello! I'll try to keep up with you.",
      "Right, I'm ready when you are. Play well!",
      'Hi there. No rush at all — take your time.',
      'Hello! I always get a little nervous at the start. Do you?',
      "Ready when you are. I promise I'll be gentle.",
    ],
    'your-best': [
      'Ooh, {move} — that was the move I wanted. Nicely spotted.',
      '{move} is the right idea. I was hoping you would miss it.',
      'That is the strong one. I have to be careful now.',
      '{move}? I felt that from here. Very tidy.',
      'You found {move}, and I am a little worried already.',
    ],
    'your-slip': [
      'Hmm, {move}. I might be able to use that — gently.',
      '{move} gives me something small to aim at. Only small!',
      'Slightly loose, that one. We all do it.',
      'Oh — {move} lets me breathe a little. Sorry to notice.',
      'That is a tiny drop, {move}. Nothing you cannot fix.',
    ],
    'your-blunder': [
      'Ouch. I think {move} drops {pawns} pawns. I am sorry.',
      'Oh no, {move} loses material. I felt bad taking it.',
      '{move} is a big one — about {pawns} pawns. Sorry about that.',
      'Oh dear. {move} hands me {pawns} pawns and I did not want them.',
      'I have to say it: {move} costs about {pawns} pawns. Take a breath.',
    ],
    'your-advice': [
      'May I say something? {better} was the move. I would have feared it.',
      'Small tip, no offence at all: {better} keeps everything together.',
      'If it helps, the safe idea was {better}. You are still in this game.',
      'I would have played {better} myself, slowly. Something to try.',
      'Please do not be hard on yourself. {better} was there, that is all.',
      'One thought for the next game: {better}, before anything else.',
    ],
    'your-capture': [
      'Fair enough, the {victim} was loose.',
      'You took the {victim} — I saw it coming and let it happen.',
      'Enjoy the {victim}; I have something in return.',
      'The {victim} is yours. I forgot about that one, honestly.',
    ],
    'your-prize': [
      'My {victim}! Oh, that really was careless of me.',
      'You took my {victim}. I will be thinking about that all game.',
      'The {victim} — that is {value} pawns of mine gone. Well spotted.',
      'I cannot believe I left the {victim} there. Goodness me.',
      'Ouch, my {victim}. That hurt and it was my own fault.',
      'The {victim} for you, {value} pawns for you, and no excuse from me.',
    ],
    'your-check': [
      'Check! Careful with my king, please.',
      'You are pushing my king around now.',
      'Check. I can defend, but nicely played.',
      'Oh — check. My poor king.',
    ],
    'your-promotion': [
      'A new queen! Well done, that is real.',
      'You promoted. I have to be honest, that hurts.',
      'A queen appears. That was a long walk for that pawn.',
      'Promotion — the one thing I could not stop. Good for you.',
    ],
    'your-slow': [
      'You are thinking hard about {move}. Take your time, I am fine here.',
      '{seconds} seconds on one move — it must be tricky.',
      'No rush at all. {seconds} seconds is nothing, I do that too.',
      'Take as long as you like. I am enjoying this position.',
    ],
    'bot-capture': [
      'Sorry, I am taking the {victim}.',
      'The {victim} was hanging, so I helped myself.',
      'I will keep the {victim}, thank you.',
      'I did notice the {victim} was free. Forgive me.',
    ],
    'bot-prize': [
      'Your {victim} is mine. I feel bad about how easy that was.',
      'I took your {victim}. {value} pawns. I will try not to gloat.',
      'Oh dear, the {victim}. That is the one you will want back.',
      'I have your {victim}. I promise I will look after it.',
      'The {victim} was standing there all alone. What could I do?',
    ],
    'bot-check': [
      'Check — just a small one.',
      'Sorry, check. I am not trying to be rude.',
      'Check. Only because I have to.',
      'Check — nothing personal, I promise.',
    ],
    'bot-promotion': [
      'I promoted! That feels lucky.',
      'My pawn made it all the way through.',
      'A new queen for me. I hope you are not cross.',
      'Promotion. Even I did not expect that.',
    ],
    'bot-slips': [
      'Oh, that was careless from me.',
      'I slipped there. I should have found better.',
      'That was a gift, honestly. My apologies.',
      'I do not know what I was thinking. Punish me, please.',
    ],
    'bot-ahead': [
      'I think I am a bit better here, but it is not over.',
      'This feels good for me. You can still fight.',
      'I am a little ahead. There is plenty of game left.',
      'The engine likes my side. It is not always right, you know.',
    ],
    'bot-behind': [
      'You are better here. I need to be careful.',
      'Hmm, you have the initiative. Well played so far.',
      'I am behind and I know it. Let us see if I can wriggle.',
      'It is your game at the moment. I will keep trying.',
    ],
    level: [
      'Even game so far. I like it.',
      'Nothing in it yet. Long way to go.',
      'Perfectly balanced. Somebody will blink.',
      'Level. I am quite happy with that, actually.',
    ],
    win: [
      'Good game! That was close in places.',
      'I won, but thank you for the game — I enjoyed it.',
      'That went my way in the end. You made me work.',
      '{plies} plies and you never gave up. Thank you for that.',
    ],
    lose: [
      'You got me. Well played, honestly.',
      'Good game, you were better today.',
      'That was clean. Nice finish.',
      'I lost that fairly. I will be thinking about it later.',
    ],
    draw: [
      'A draw. Fair result, that.',
      'Even game. Thanks for playing.',
      'A draw — I think we both deserved that.',
    ],
    'your-resign': [
      'Thanks for the game — it was a good one.',
      'Fair enough. Well played up to there.',
      'That is alright. Nobody enjoys the losing side.',
    ],
    hint: [
      'Need a hand? No shame in it.',
      'Asking for help? I will pretend I did not see.',
      'The engine knows more than both of us. Use it well.',
      'A hint is a fine thing to ask for. I do it too.',
    ],
  },
};

/**
 * Nay Chi: confident and quick with a needle, but she still tells the truth
 * about the position, credits a good move, and teaches when she feels like it.
 */
const NAY_CHI: Voice = {
  id: 'nay-chi',
  name: 'Confident',
  about:
    'Plays fast, talks faster. Needles you, then admits when you are right.',
  teaches: 3,
  speech: { rate: 1.12, pitch: 1.02, gender: 'feminine' },
  lines: {
    greet: [
      "Let's go. I don't like long games.",
      'Ready. Try to keep the pieces on the board.',
      'Right — my clock is not going to tick itself.',
      'I will tell you now: I play fast and I talk faster.',
      "Let's see what you have got. Blink first and it is over.",
      'Start moving. I get bored watching.',
    ],
    'your-best': [
      'Fine, {move} was right. I hate that you found it.',
      'Okay, that is the move. Credit where it is due.',
      'You saw {move}. Irritating. Good.',
      '{move}. I was hoping you would blink, and you did not.',
      'Right move, right time. Do not let it go to your head.',
    ],
    'your-slip': [
      '{move}? I like my position a lot more now.',
      'That loses a bit of ground, {move}. I will take it.',
      'Hmm, {move}. You gave me the tempo I wanted.',
      'Careless, {move}. I am already counting the follow-up.',
      'See, that is a move you only make once. {move}.',
    ],
    'your-blunder': [
      '{move}? That is {pawns} pawns. Thanks, I will bank those.',
      'Oh, {move} drops material. You cannot do that against me.',
      'That is a blunder — {pawns} pawns gone. Keep up.',
      '{pawns} pawns, {move}. I would apologise, but I am not sorry.',
      'And that is why I do not rush. {move} is mine now.',
    ],
    'your-advice': [
      'Here is a tip, free of charge: {better}. Try it next game.',
      '{better} was the move. I would have played it, but then, I am me.',
      'You want advice? {better}. That is the whole lesson.',
      'Slow down. {better} was right there and you walked past it.',
      'One thing, then I stop: {better} holds everything together.',
      'Free coaching: {better}. Now stop handing me positions.',
    ],
    'your-capture': [
      'Okay, the {victim} is yours. That was part of my plan anyway.',
      'Take the {victim}. I am playing the position, not the material.',
      'Enjoy that {victim}, because it will not happen twice.',
      'The {victim}? Fine. Watch what I do with the tempo.',
    ],
    'your-prize': [
      'My {victim}. Right. Goodness me. Enjoy it while it lasts.',
      'You took the {victim} — {value} points. I will remember that.',
      'The {victim} is yours, and I will not pretend to be upset.',
      'That {victim} was a gift. Happy birthday.',
      'One {victim} does not win a game. I have won from worse.',
      'You have my {victim}. {value} pawns. Let us see who uses them.',
    ],
    'your-check': [
      'Check. I saw it before you did.',
      'Check — you are making me work. Fine.',
      'Check. You are quicker than I expected.',
      'Check. My king has legs.',
    ],
    'your-promotion': [
      'A queen. Impressive. Annoying, but impressive.',
      'You promoted? Okay. Now I have to actually try.',
      'A new queen. Use her properly or hand her back.',
      'Promotion. I would clap, but I am busy defending.',
    ],
    'your-slow': [
      '{seconds} seconds for {move}? My clock would be dead.',
      'Thinking that long about {move}. Hope it was worth it.',
      'You are burning clock. I am not.',
      '{seconds} seconds. You either see it or you do not, you know.',
    ],
    'bot-capture': [
      'Mine. The {victim} was never really yours.',
      'I will take that {victim}, thank you very much.',
      'That {victim} fell straight into my hands.',
      'The {victim} is mine now. It suits me better.',
    ],
    'bot-prize': [
      'Your {victim}? Mine now. {value} points, no receipt.',
      'There goes your {victim}. I would send flowers, but it is chess.',
      'I took the {victim}. Try not to make that face.',
      'That is a {victim}, and it is on my side of the board.',
      'You left the {victim} unattended. So I did the obvious.',
    ],
    'bot-check': [
      'Check. Keep it tidy.',
      'Check — you are not the only one attacking.',
      'Check. Bet you saw that one coming.',
      'Check. Move the king, take your time.',
    ],
    'bot-promotion': [
      'Queen. Deal with it.',
      'My pawn finished the job.',
      'A new queen for me. That changes the conversation.',
      'Promotion. The material count now says what I have been saying.',
    ],
    'bot-slips': [
      'Bad move from me. Even I do that.',
      'That was sloppy. You should punish it.',
      'Okay, my mistake. Do not get excited.',
      'I gave you something there. Take it, or do not.',
    ],
    'bot-ahead': [
      'You are drifting. I am not in a rush.',
      'This is mine to lose now, and I do not lose these.',
      'The engine says I am winning. So do I.',
      'I am two pawns up and feeling generous. Your move.',
    ],
    'bot-behind': [
      'Okay, you are better. I am not admitting more than that.',
      'You have the pull here. For now.',
      'Fine, you are winning. I am still dangerous.',
      'The engine likes your side. It is being kind to you.',
    ],
    level: [
      'Dead level. Somebody has to blink.',
      'Nothing in it. Fight me.',
      'Level. I hate level. Do something.',
      'Even. I play these all day.',
    ],
    win: [
      'Told you. Rematch whenever you feel brave.',
      'Mine. Good game though.',
      'Won. You played decently for most of it.',
      '{plies} plies — and I still had time on the clock.',
    ],
    lose: [
      'You got me. That was clean, I will say it once.',
      'Fine. Well played.',
      'Okay, that was good. Do not expect it twice.',
      'You won. I am annoyed and impressed. Mostly annoyed.',
    ],
    draw: [
      'A draw. We can both be annoyed about that.',
      'Level. Rematch?',
      'A draw. Nobody wins, and nobody sleeps well either.',
    ],
    'your-resign': [
      'Smart. Saves us both time.',
      'Resigned. Sensible.',
      'Good call. I had it anyway.',
    ],
    hint: [
      'Asking the engine now? Bold.',
      'A hint, really? Fine, but I am watching.',
      'Sure, take the hint. I will take the win.',
      'The engine is helping you. Tell it I said hello.',
    ],
  },
};

/**
 * Kyaw Gyi: the strongest and the rudest. He never softens a mistake, he counts
 * every pawn, his jokes are arithmetic, and when the reader beats him he says so
 * once, without a smile.
 */
const KYAW_GYI: Voice = {
  id: 'kyaw-gyi',
  name: 'Ruthless',
  about: 'Unsparing. Names every mistake, counts every pawn, applauds nothing.',
  teaches: 4,
  speech: { rate: 0.92, pitch: 0.75, gender: 'masculine' },
  lines: {
    greet: [
      'You have my attention. Briefly.',
      'Start. I have seen your games.',
      'Let us not waste the clock. Play.',
      'I will not be gentle and I will not be cruel. I will simply win.',
      'Begin. Every move you make will be weighed.',
      'Sit down properly. This takes longer than you think.',
    ],
    'your-best': [
      '{move}. Correct, and still not enough.',
      'The only move. You found it — so did I, from here.',
      '{move}. Good. Do that five more times and we have a game.',
      'You played the right move. That is not the same as playing well.',
      "{move} is the engine's choice. Mine too. Continue.",
    ],
    'your-slip': [
      '{move} is a concession. Small, but I count them.',
      'That gives me a target. You should not have played {move}.',
      'Loose. I will collect on that later.',
      '{move} loses a fraction. Fractions become games.',
      'Sloppy. You will forget {move}. I will remember the square.',
    ],
    'your-blunder': [
      '{move}. {pawns} pawns. That is the game, and we both know it.',
      'A blunder. I do not need to explain {move} to you.',
      'You handed me {pawns} pawns. Sit with that.',
      '{move} gives me {pawns} pawns for nothing. Set it up again at home.',
      'That is not a mistake. That is a resignation you have not signed.',
    ],
    'your-advice': [
      '{better} was the move. Play it next time and this is still a game.',
      'One lesson, take it: {better}. That is the difference between us.',
      'You had {better}. I would have played it without thinking.',
      'Learn {better}. Not the move that wins, the move that does not lose.',
      'A tip, since you will see this again: {better}, before anything else.',
      'Understand {better} and you will stop losing to me like this.',
    ],
    'your-capture': [
      'You took the {victim}. It costs you more than it costs me.',
      'Keep the {victim}. It was a fair trade for the square I get.',
      'Material. The last resort of the worried.',
      'The {victim} is yours. Note how little it changes.',
    ],
    'your-prize': [
      'My {victim}. {value} pawns, handed over without a fight.',
      'You have my {victim}. That is not a sacrifice. It is litter.',
      'The {victim} goes to you. I will want it back with interest.',
      'One {victim} for you. Now watch what it cost you.',
      'Bold, taking the {victim}. Expensive, too. We shall see the ledger.',
    ],
    'your-check': [
      'Check. My king does not panic.',
      'A check. Order restored shortly.',
      'Check. You have my attention for one move.',
      'Check — noise, not a threat.',
    ],
    'your-promotion': [
      'A queen. Now prove you know how to use it.',
      'Promotion. Rare respect for that.',
      'A new queen. Queens lose games too, held badly.',
      'Your pawn arrived. Mine are still walking.',
    ],
    'your-slow': [
      '{seconds} seconds for {move}. You are losing the clock as well.',
      'Long thought, weak move. Time is not your ally here.',
      '{seconds} seconds. I have read this position while you decide.',
      'You are spending your clock on a move I have already answered.',
    ],
    'bot-capture': [
      '{victim} taken. Keep what is left tidy.',
      'That {victim} was yours by accident. It is mine by right.',
      'The {victim}. No comment needed.',
      '{victim} off the board. The square is what matters.',
    ],
    'bot-prize': [
      'Your {victim}. {value} pawns, and no defence behind them.',
      'There goes the {victim}. Count what is left before you move again.',
      'I have your {victim}. You left it alone all game. Do not look surprised.',
      'The {victim} is mine. Chess is arithmetic, and you just lost some.',
      'A {victim} for nothing. That is not a trade, it is an apology.',
    ],
    'bot-check': [
      'Check. Do not embarrass yourself.',
      'Check. Your king is a tenant.',
      'Check. Find the square. It is already mine.',
      'Check. Now the whole game reorganises around your king.',
    ],
    'bot-promotion': [
      'Promotion. The end is arithmetic now.',
      'Queen. Resume.',
      'My pawn is a queen. Yours is still a pawn.',
      'Promotion. Count the material and decide how you feel.',
    ],
    'bot-slips': [
      'Careless. It changes nothing.',
      'A slip. Correct it.',
      'My mistake. Do not read anything into it.',
      'I gave you a fraction. Spend it well, if you can.',
    ],
    'bot-ahead': [
      'This is over unless you find something precise.',
      'You are worse everywhere. Fix one thing at a time.',
      'I am winning and I am not interested in the scoreboard. Play.',
      'The engine agrees with me. That is rare and unhelpful to you.',
    ],
    'bot-behind': [
      'You are better. That is a fact, not a compliment.',
      'I am behind. The position does not care how I feel.',
      'You have the advantage. Now keep it, move by move.',
      'I am losing. There is no other way to say it.',
    ],
    level: [
      'Level. For now.',
      'Balanced. Somebody must improve first.',
      'Equal. The next careless move decides it.',
      'Nothing between us. Adequate.',
    ],
    win: [
      'As expected. Bring a better game next time.',
      'Won. Review it — you will learn more than I will.',
      'That is over. Read the game and find the move you regret.',
      'You lasted {plies} plies. Count that as the achievement.',
    ],
    lose: [
      'You played well. I do not say that often.',
      'You won. Recognition given.',
      'You were better. I will not pretend otherwise.',
      'I lost. Note the reason, and use it again.',
    ],
    draw: [
      'A draw. Acceptable for one of us.',
      'Held. Barely.',
      'Drawn. You defended better than you attacked.',
    ],
    'your-resign': [
      'Correct decision.',
      'Resigned. That was the professional choice.',
      'Sensible. The position was already decided.',
    ],
    hint: [
      'You are asking the engine. It will not be there next game.',
      'A hint. Use it — then explain it to yourself.',
      'Take the help. Understanding it is your homework.',
      'The engine is stronger than both of us. Not learning is the error.',
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
 * What this character says about one event, or null when it has nothing to add.
 * A line that needs a fact the event does not have is skipped, and a line the
 * character has already used in this game is never used again.
 */
export function chatLine(
  voiceId: string | null | undefined,
  kind: ChatKind,
  facts: ChatFacts,
  seed: number,
  except: ReadonlySet<string> = new Set(),
): string | null {
  const bank = voiceById(voiceId).lines[kind];
  if (!bank?.length) return null;
  const start = seedOf(seed, kind) % bank.length;
  for (let step = 0; step < bank.length; step++) {
    const line = fill(bank[(start + step) % bank.length]!, facts);
    if (!needs(bank[(start + step) % bank.length]!, facts) && !except.has(line))
      return line;
  }
  return null;
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

/** The kinds every character must be able to speak about. */
export const REQUIRED_KINDS: readonly ChatKind[] = [
  'greet',
  'your-best',
  'your-slip',
  'your-blunder',
  'your-advice',
  'your-capture',
  'your-prize',
  'your-check',
  'your-promotion',
  'your-slow',
  'your-resign',
  'bot-capture',
  'bot-prize',
  'bot-check',
  'bot-promotion',
  'bot-slips',
  'bot-ahead',
  'bot-behind',
  'level',
  'win',
  'lose',
  'draw',
  'hint',
];

export function mention(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}
