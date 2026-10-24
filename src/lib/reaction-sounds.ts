const SOUND_ENABLED_KEY = "trouvix_reaction_sounds";

let audioContext: AudioContext | null = null;
let lastSoundAt = 0;

type Tone = { frequency: number; endFrequency?: number; wave: OscillatorType; duration: number; delay: number; gain: number };

const REACTION_TONES: Record<string, Tone[]> = {
  "👍": [
    { frequency: 660, wave: "sine", duration: 0.15, delay: 0, gain: 0.12 },
    { frequency: 880, wave: "sine", duration: 0.2, delay: 0.11, gain: 0.13 },
    { frequency: 1100, wave: "sine", duration: 0.3, delay: 0.23, gain: 0.12 },
  ],
  "❤️": [
    { frequency: 520, wave: "sine", duration: 0.18, delay: 0, gain: 0.12 },
    { frequency: 660, wave: "sine", duration: 0.28, delay: 0.19, gain: 0.12 },
  ],
  "😂": [
    { frequency: 570, endFrequency: 760, wave: "triangle", duration: 0.12, delay: 0, gain: 0.13 },
    { frequency: 500, endFrequency: 700, wave: "triangle", duration: 0.12, delay: 0.15, gain: 0.13 },
    { frequency: 620, endFrequency: 850, wave: "triangle", duration: 0.17, delay: 0.3, gain: 0.13 },
  ],
  "😮": [
    { frequency: 260, endFrequency: 880, wave: "sine", duration: 0.45, delay: 0, gain: 0.14 },
  ],
  "🔥": [
    { frequency: 220, endFrequency: 520, wave: "sawtooth", duration: 0.16, delay: 0, gain: 0.08 },
    { frequency: 390, endFrequency: 170, wave: "sawtooth", duration: 0.25, delay: 0.13, gain: 0.08 },
    { frequency: 580, endFrequency: 210, wave: "triangle", duration: 0.19, delay: 0.28, gain: 0.07 },
  ],
  "👏": [
    { frequency: 1500, endFrequency: 700, wave: "square", duration: 0.055, delay: 0, gain: 0.045 },
    { frequency: 1250, endFrequency: 600, wave: "square", duration: 0.055, delay: 0.12, gain: 0.045 },
    { frequency: 1600, endFrequency: 800, wave: "square", duration: 0.065, delay: 0.24, gain: 0.05 },
  ],
  "💪": [
    { frequency: 130, endFrequency: 190, wave: "triangle", duration: 0.24, delay: 0, gain: 0.17 },
    { frequency: 195, endFrequency: 260, wave: "triangle", duration: 0.27, delay: 0.18, gain: 0.15 },
  ],
  "💔": [
    { frequency: 620, endFrequency: 500, wave: "sine", duration: 0.16, delay: 0, gain: 0.12 },
    { frequency: 470, endFrequency: 280, wave: "sine", duration: 0.4, delay: 0.16, gain: 0.13 },
  ],
  "😭": [
    { frequency: 740, wave: "sine", duration: 0.13, delay: 0, gain: 0.12 },
    { frequency: 520, wave: "sine", duration: 0.13, delay: 0.14, gain: 0.12 },
    { frequency: 390, wave: "sine", duration: 0.2, delay: 0.28, gain: 0.12 },
  ],
  "😡": [
    { frequency: 115, endFrequency: 82, wave: "sawtooth", duration: 0.24, delay: 0, gain: 0.12 },
    { frequency: 98, endFrequency: 75, wave: "sawtooth", duration: 0.2, delay: 0.25, gain: 0.11 },
  ],
};

export function areReactionSoundsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setReactionSoundsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {}
}

function playToneSequence(tones: Tone[]) {
  try {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    const context = audioContext;
    const play = () => {
      const now = context.currentTime;
      tones.forEach(({ frequency, endFrequency, wave, duration, delay, gain: volume }) => {
        const start = now + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency, start);
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      });
    };
    if (context.state === "suspended") void context.resume().then(play).catch(() => {});
    else play();
  } catch {}
}

export function playReactionSound(emoji: string) {
  if (typeof window === "undefined" || !areReactionSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastSoundAt < 700) return;
  lastSoundAt = now;

  playToneSequence(REACTION_TONES[emoji] ?? REACTION_TONES["😮"]);
}

export function playTrouvixMagicChime() {
  if (typeof window === "undefined" || !areReactionSoundsEnabled()) return;
  const tones: Tone[] = [
    { frequency: 523, endFrequency: 659, wave: "triangle", duration: 0.14, delay: 0, gain: 0.1 },
    { frequency: 784, endFrequency: 1046, wave: "triangle", duration: 0.16, delay: 0.08, gain: 0.12 },
    { frequency: 1318, endFrequency: 1568, wave: "sine", duration: 0.3, delay: 0.16, gain: 0.12 },
  ];
  playToneSequence(tones);
}
