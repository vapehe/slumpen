import { describe, expect, it } from "vitest";
import type { Lottery, Participant } from "./db";
import { computeLotteryDrawRows } from "./execute-lottery-draw";

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
  it("throws when lottery has no seed", () => {
    const lottery = makeLottery({
      seed: null,
      num_draws: 1,
      with_replacement: false,
    });
    expect(() => computeLotteryDrawRows(lottery, [makeParticipant(1)])).toThrow(/seed/i);
  });

  it("throws when there are no participants", () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 1,
      with_replacement: false,
    });
    expect(() => computeLotteryDrawRows(lottery, [])).toThrow(/deltagare/i);
  });

  it("returns ordered positions without replacement", () => {
    const lottery = makeLottery({
      seed: "012345670102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(10), makeParticipant(20), makeParticipant(30)];
    const rows = computeLotteryDrawRows(lottery, participants);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ position: 1, participantId: expect.any(Number) });
    expect(rows[1]).toEqual({ position: 2, participantId: expect.any(Number) });
    expect(new Set(rows.map((r) => r.participantId)).size).toBe(2);
  });

  it("is deterministic for the same lottery and participant order", () => {
    const lottery = makeLottery({
      seed: "cafef00d0102030405060708090a0b0c",
      num_draws: 2,
      with_replacement: false,
    });
    const participants = [makeParticipant(1), makeParticipant(2), makeParticipant(3)];
    expect(computeLotteryDrawRows(lottery, participants)).toEqual(
      computeLotteryDrawRows(lottery, participants),
    );
  });

  it("supports with replacement", () => {
    const lottery = makeLottery({
      seed: "abababab0102030405060708090a0b0c",
      num_draws: 5,
      with_replacement: true,
    });
    const participants = [makeParticipant(100), makeParticipant(200)];
    const rows = computeLotteryDrawRows(lottery, participants);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => [100, 200].includes(r.participantId))).toBe(true);
  });
});
