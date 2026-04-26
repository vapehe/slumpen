import { describe, expect, it } from "vitest";
import type { Participant } from "./db";
import { buildParticipantTableRows, getParticipantCsvColumnOrder } from "./participant-table-for-pdf";

function makeParticipant(rowIndex: number, data: Record<string, string>, id = rowIndex + 1): Participant {
  return {
    id,
    lottery_id: 1,
    row_index: rowIndex,
    data_json: JSON.stringify(data),
  };
}

describe("getParticipantCsvColumnOrder", () => {
  it("returns key order from first row by row_index", () => {
    const p = [
      makeParticipant(1, { z: "1", a: "2" }),
      makeParticipant(0, { z: "0", a: "3" }),
    ];
    expect(getParticipantCsvColumnOrder(p)).toEqual(["z", "a"]);
  });

  it("returns empty array when no participants", () => {
    expect(getParticipantCsvColumnOrder([])).toEqual([]);
  });
});

describe("buildParticipantTableRows", () => {
  it("sorts by row_index and fills missing keys with empty string", () => {
    const p = [
      makeParticipant(1, { name: "B", extra: "x" }, 2),
      makeParticipant(0, { name: "A" }, 1),
    ];
    const cols = ["name", "extra"];
    expect(buildParticipantTableRows(p, cols)).toEqual([
      ["A", ""],
      ["B", "x"],
    ]);
  });
});
