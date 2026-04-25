import type { Lottery, Participant } from "./db";
import { drawWinners } from "./random";

export type DrawRow = { position: number; participantId: number };

export async function computeLotteryDrawRows(
  lottery: Lottery,
  participants: Participant[],
): Promise<DrawRow[]> {
  if (!lottery.seed) {
    throw new Error("Lotteriet saknar slumpseed; dragning kan inte reproduceras.");
  }
  if (participants.length === 0) {
    throw new Error("Inga deltagare att dra.");
  }

  const seed = lottery.seed;
  const n = lottery.num_draws;
  const participantIds = participants.map((p) => p.id);
  const winnerIds = await drawWinners(participantIds, n, lottery.with_replacement, seed);

  return winnerIds.map((participantId, index) => ({
    position: index + 1,
    participantId,
  }));
}
