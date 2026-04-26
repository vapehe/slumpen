import { describe, expect, it, vi } from "vitest";
import type { Draw, Lottery, Participant } from "./db";
import { verifyLotteryDraw } from "./verify-lottery-draw";
import { drawWinners } from "./random";

vi.mock("./random", () => ({
  drawWinners: vi.fn(),
}));

const drawWinnersMock = vi.mocked(drawWinners);

function makeLottery(over: Partial<Lottery> & Pick<Lottery, "with_replacement" | "num_draws" | "seed">): Lottery {
  return {
    id: 1,
    name: "Test",
    description: null,
    created_at: "",
    name_column: "name",
    protocol_signatories: null,
    ...over,
  };
}

function makeParticipant(id: number, lotteryId = 1): Participant {
  return {
    id,
    lottery_id: lotteryId,
    row_index: id - 1,
    data_json: "{}",
  };
}

function makeDraw(position: number, participantId: number, id = 1): Draw {
  return {
    id,
    lottery_id: 1,
    position,
    participant_id: participantId,
    drawn_at: "2025-01-01T00:00:00.000Z",
  };
}

describe("verifyLotteryDraw", () => {
  it("returns no_seed when lottery has no seed", async () => {
    const lottery = makeLottery({
      seed: null,
      num_draws: 1,
      with_replacement: false,
    });
    const result = await verifyLotteryDraw(lottery, [makeParticipant(1)], [makeDraw(1, 1)]);
    expect(result).toEqual({ ok: false, reason: "no_seed" });
    expect(drawWinnersMock).not.toHaveBeenCalled();
  });

  it("returns no_draws when draws array is empty", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 1,
      with_replacement: false,
    });
    const result = await verifyLotteryDraw(lottery, [makeParticipant(1)], []);
    expect(result).toEqual({ ok: false, reason: "no_draws" });
    expect(drawWinnersMock).not.toHaveBeenCalled();
  });

  it("returns draw_count_mismatch when saved draw count differs from recomputed", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20)];
    drawWinnersMock.mockResolvedValueOnce([10, 20]);
    const result = await verifyLotteryDraw(lottery, participants, [makeDraw(1, 10, 1)]);
    expect(result).toEqual({ ok: false, reason: "draw_count_mismatch" });
  });

  it("returns ok true when recomputed outcome matches saved draws", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20), makeParticipant(30)];
    drawWinnersMock.mockResolvedValueOnce([20, 10]);
    const draws = [makeDraw(1, 20, 1), makeDraw(2, 10, 2)];
    const result = await verifyLotteryDraw(lottery, participants, draws);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expected).toEqual([
        { position: 1, participantId: 20 },
        { position: 2, participantId: 10 },
      ]);
    }
  });

  it("is agnostic to draw order in input (sorts by position)", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20), makeParticipant(30)];
    drawWinnersMock.mockResolvedValueOnce([20, 10]);
    const drawsReversed = [makeDraw(2, 10, 2), makeDraw(1, 20, 1)];
    const result = await verifyLotteryDraw(lottery, participants, drawsReversed);
    expect(result.ok).toBe(true);
  });

  it("returns mismatches when at least one position differs", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20), makeParticipant(30)];
    drawWinnersMock.mockResolvedValueOnce([20, 10]);
    const draws = [makeDraw(1, 20, 1), makeDraw(2, 30, 2)];
    const result = await verifyLotteryDraw(lottery, participants, draws);
    expect(result.ok).toBe(false);
    if (!result.ok && "mismatches" in result) {
      expect(result.mismatches).toEqual([{ position: 2, expectedId: 10, actualId: 30 }]);
    } else {
      expect.fail("expected mismatches");
    }
  });
});
