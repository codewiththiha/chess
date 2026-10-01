// Produce a short opt-in move cue without downloading audio or autoplaying music.
let context: AudioContext | null = null;
export function moveSound(capture: boolean): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
      capture ? 330 : 520,
      context.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      capture ? 170 : 350,
      context.currentTime + 0.07,
    );
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.09);
  } catch {
    /* Sound must never block a legal move in browsers that deny audio. */
  }
}
