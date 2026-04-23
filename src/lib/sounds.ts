/**
 * Procedurellt genererade ljudeffekter via Web Audio API.
 * Inga audiofiler – alla ljud byggs av oscillator + envelope så att de
 * fungerar offline utan att behöva skeppa mediafiler med appen.
 */

type AudioCtx = AudioContext & { state: AudioContextState };

let ctx: AudioCtx | null = null;

function getCtx(): AudioCtx | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor() as AudioCtx;
    return ctx;
  } catch {
    return null;
  }
}

async function ensureRunning(ac: AudioCtx): Promise<void> {
  if (ac.state === "suspended") {
    try {
      await ac.resume();
    } catch {
      // Webkitar kräver ibland gestbaserad resume; tyst ignorera.
    }
  }
}

function playTone(
  ac: AudioCtx,
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.15,
  startOffset = 0,
): void {
  const now = ac.currentTime + startOffset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Ett kort klickljud, ungefär som en kugge i en tombola. */
export async function playTick(): Promise<void> {
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  playTone(ac, 900, 0.04, "square", 0.08);
}

/** Segerfanfar (tre stigande toner). */
export async function playFanfare(): Promise<void> {
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone(ac, freq, 0.18, "triangle", 0.2, i * 0.12);
  });
}

/** Stäng och nollställ ljudkontexten, t.ex. vid sidnavigering. */
export function closeAudio(): void {
  if (!ctx) return;
  try {
    void ctx.close();
  } catch {
    // Ignorera – vi nollställer ändå.
  }
  ctx = null;
}
