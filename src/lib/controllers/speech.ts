// Let the characters say their lines through the platform's own speech engine.
import { planUtterance } from '../domain/chat';
import type { SpeechVoice } from '../domain/chat';
import type { AppState } from '../state/app.svelte';

/** The platform speech engine, or null when this browser has none. */
function engine(): SpeechSynthesis | null {
  return typeof window === 'undefined' || !('speechSynthesis' in window)
    ? null
    : window.speechSynthesis;
}

export class SpeechController {
  private spoken = '';
  private warned = false;
  constructor(private readonly state: AppState) {}

  private voices(): SpeechVoice[] {
    const list = engine()?.getVoices() ?? [];
    return list.map((voice) => ({ name: voice.name, lang: voice.lang }));
  }

  private pick(voiceName: string | null): SpeechSynthesisVoice | null {
    if (!voiceName) return null;
    const list = engine()?.getVoices() ?? [];
    return list.find((voice) => voice.name === voiceName) ?? null;
  }

  /**
   * Say one line in the character's own manner. Speaking is skipped when the
   * reader turned it off, when the tab is in the background, and when the same
   * line would be repeated.
   */
  speak(text: string): void {
    const synthesis = engine();
    if (!synthesis || !this.state.preferences.speech) return;
    const plan = planUtterance(
      text,
      this.state.gameBot?.voice ?? null,
      this.voices(),
    );
    if (!plan || plan.text === this.spoken) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.spoken = plan.text;
    synthesis.cancel();
    try {
      const utterance = new SpeechSynthesisUtterance(plan.text);
      utterance.lang = plan.lang;
      utterance.rate = plan.rate;
      utterance.pitch = plan.pitch;
      const voice = this.pick(plan.voiceName);
      if (voice) utterance.voice = voice;
      synthesis.speak(utterance);
    } catch {
      // A platform that refuses a voice, an utterance, or the call itself must
      // never be allowed to break the game.
      this.warned = true;
    }
  }

  /** Stop talking at once, so a new game is not drowned out by the old one. */
  cancel(): void {
    this.spoken = '';
    engine()?.cancel();
  }

  get unsupported(): boolean {
    return engine() === null || this.warned;
  }
}
