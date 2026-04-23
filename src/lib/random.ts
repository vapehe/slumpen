/**
 * Seed-generering och deterministisk dragning (Mulberry32 + Fisher–Yates).
 */

export function generateSeed(bytes = 16): string {
  const seedArray = new Uint8Array(bytes);
  crypto.getRandomValues(seedArray);
  return Array.from(seedArray, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseSeedToInitialState(seed: string): number {
  if (seed.length < 8) {
    throw new Error("Ogiltig slumpseed: för kort.");
  }
  const prefix = seed.slice(0, 8);
  if (!/^[0-9a-fA-F]{8}$/.test(prefix)) {
    throw new Error("Ogiltig slumpseed: måste börja med 8 hexadecimala tecken.");
  }
  const n = parseInt(prefix, 16);
  if (!Number.isFinite(n)) {
    throw new Error("Ogiltig slumpseed.");
  }
  return n >>> 0;
}

/** Seeded PRNG (Mulberry32‑variant), deterministisk för samma seed-sträng. */
class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = parseSeedToInitialState(seed);
  }

  /** Slump tal i [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  parseSeedToInitialState(seed);
  const rng = new SeededRandom(seed);
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function drawWithoutReplacement<T>(participants: T[], numDraws: number, seed: string): T[] {
  const shuffled = shuffleWithSeed(participants, seed);
  return shuffled.slice(0, numDraws);
}

export function drawWithReplacement<T>(participants: T[], numDraws: number, seed: string): T[] {
  parseSeedToInitialState(seed);
  const rng = new SeededRandom(seed);
  const winners: T[] = [];

  for (let i = 0; i < numDraws; i++) {
    const index = Math.floor(rng.next() * participants.length);
    winners.push(participants[index]);
  }

  return winners;
}
