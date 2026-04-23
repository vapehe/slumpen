import type { Lottery, Participant } from "./db";
import { drawWithReplacement, drawWithoutReplacement } from "./random";

export type DrawRow = { position: number; participantId: number };

export function computeLotteryDrawRows(lottery: Lottery, participants: Participant[]): DrawRow[] {
  if (!lottery.seed) {
    throw new Error("Lotteriet saknar slumpseed; dragning kan inte reproduceras.");
  }
  if (participants.length === 0) {
    throw new Error("Inga deltagare att dra.");
  }

  const seed = lottery.seed;
  const n = lottery.num_draws;
  const winners = lottery.with_replacement
    ? drawWithReplacement(participants, n, seed)
    : drawWithoutReplacement(participants, n, seed);

  return winners.map((p, index) => ({
    position: index + 1,
    participantId: p.id,
  }));
}
