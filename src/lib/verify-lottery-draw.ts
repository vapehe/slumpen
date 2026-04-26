import type { Draw, Lottery, Participant } from "./db";
import { computeLotteryDrawRows, type DrawRow } from "./execute-lottery-draw";

export type { DrawRow };

export type VerificationResult =
  | { ok: true; expected: DrawRow[] }
  | { ok: false; reason: "no_seed" | "no_draws" | "draw_count_mismatch" }
  | {
      ok: false;
      mismatches: Array<{ position: number; expectedId: number; actualId: number }>;
    };

/**
 * Kör om dragningen med samma seed och deltagare som vid skapande och jämför med sparade rader.
 */
export async function verifyLotteryDraw(
  lottery: Lottery,
  participants: Participant[],
  draws: Draw[],
): Promise<VerificationResult> {
  if (!lottery.seed) {
    return { ok: false, reason: "no_seed" };
  }
  if (draws.length === 0) {
    return { ok: false, reason: "no_draws" };
  }

  const sorted = [...draws].sort((a, b) => a.position - b.position);
  const expected = await computeLotteryDrawRows(lottery, participants);

  if (sorted.length !== expected.length) {
    return { ok: false, reason: "draw_count_mismatch" };
  }

  const drawByPosition = new Map<number, Draw>();
  for (const d of sorted) {
    drawByPosition.set(d.position, d);
  }

  const mismatches: Array<{ position: number; expectedId: number; actualId: number }> = [];
  for (const eRow of expected) {
    const actual = drawByPosition.get(eRow.position);
    if (actual == null) {
      mismatches.push({
        position: eRow.position,
        expectedId: eRow.participantId,
        actualId: -1,
      });
    } else if (actual.participant_id !== eRow.participantId) {
      mismatches.push({
        position: eRow.position,
        expectedId: eRow.participantId,
        actualId: actual.participant_id,
      });
    }
  }

  if (mismatches.length > 0) {
    return { ok: false, mismatches };
  }

  return { ok: true, expected };
}
