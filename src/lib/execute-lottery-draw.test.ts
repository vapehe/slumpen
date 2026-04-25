import { describe, expect, it, vi } from "vitest";
import type { Lottery, Participant } from "./db";
import { computeLotteryDrawRows } from "./execute-lottery-draw";
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

describe("computeLotteryDrawRows", () => {
  it("throws when lottery has no seed", async () => {
    const lottery = makeLottery({
      seed: null,
      num_draws: 1,
      with_replacement: false,
    });
    await expect(computeLotteryDrawRows(lottery, [makeParticipant(1)])).rejects.toThrow(/seed/i);
  });

  it("throws when there are no participants", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 1,
      with_replacement: false,
    });
    await expect(computeLotteryDrawRows(lottery, [])).rejects.toThrow(/deltagare/i);
  });

  it("returns ordered positions without replacement", async () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20), makeParticipant(30)];
    drawWinnersMock.mockResolvedValueOnce([20, 10]);
    const rows = await computeLotteryDrawRows(lottery, participants);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ position: 1, participantId: expect.any(Number) });
    expect(rows[1]).toEqual({ position: 2, participantId: expect.any(Number) });
    expect(new Set(rows.map((r) => r.participantId)).size).toBe(2);
    expect(drawWinnersMock).toHaveBeenCalledWith([10, 20, 30], 2, false, lottery.seed);
  });

  it("is deterministic for the same lottery and participant order", async () => {
    const lottery = makeLottery({
      seed: "cafef00d0102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(1), makeParticipant(2), makeParticipant(3)];
    drawWinnersMock.mockResolvedValue([2, 3]);
    await expect(computeLotteryDrawRows(lottery, participants)).resolves.toEqual(
      await computeLotteryDrawRows(lottery, participants),
    );
  });

  it("supports with replacement", async () => {
    const lottery = makeLottery({
      seed: "abababab0102030405060708090a0b0c",
      num_draws: 5,
      with_replacement: true,
    });
    const participants = [makeParticipant(100), makeParticipant(200)];
    drawWinnersMock.mockResolvedValueOnce([100, 200, 100, 100, 200]);
    const rows = await computeLotteryDrawRows(lottery, participants);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => [100, 200].includes(r.participantId))).toBe(true);
    expect(drawWinnersMock).toHaveBeenCalledWith([100, 200], 5, true, lottery.seed);
  });
});
