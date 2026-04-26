import { describe, expect, it } from "vitest";
import type { Participant } from "./db";
import { buildReelItems, participantDisplayName, reelForSpin } from "./draw-reel";

function makeParticipant(id: number, data: Record<string, string> | string): Participant {
  return {
    id,
    lottery_id: 1,
    row_index: id - 1,
    data_json: typeof data === "string" ? data : JSON.stringify(data),
  };
}

describe("participantDisplayName", () => {
  it("returns the value for the configured column", () => {
    const p = makeParticipant(1, { name: "Anna", email: "a@ex.com" });
    expect(participantDisplayName(p, "name")).toBe("Anna");
  });

  it("returns placeholder when the column is missing", () => {
    const p = makeParticipant(1, { email: "a@ex.com" });
    expect(participantDisplayName(p, "name")).toBe("(saknas)");
  });

  it("returns placeholder when the value is an empty string", () => {
    const p = makeParticipant(1, { name: "" });
    expect(participantDisplayName(p, "name")).toBe("(saknas)");
  });

  it("returns placeholder when the JSON is malformed", () => {
    const p = makeParticipant(1, "{not json");
    expect(participantDisplayName(p, "name")).toBe("(felaktig rad)");
  });
});

describe("buildReelItems", () => {
  it("maps participants to id/name pairs via the name column", () => {
    const items = buildReelItems(
      [
        makeParticipant(10, { name: "Anna" }),
        makeParticipant(20, { name: "Bosse" }),
      ],
      "name",
    );
    expect(items).toEqual([
      { id: 10, name: "Anna" },
      { id: 20, name: "Bosse" },
    ]);
  });

  it("sorts by display name using sv-SE collation", () => {
    const items = buildReelItems(
      [
        makeParticipant(3, { name: "C" }),
        makeParticipant(1, { name: "A" }),
        makeParticipant(2, { name: "B" }),
      ],
      "name",
    );
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("sorts å, ä, ö after z in Swedish order", () => {
    const items = buildReelItems(
      [
        makeParticipant(4, { name: "ö" }),
        makeParticipant(1, { name: "a" }),
        makeParticipant(3, { name: "å" }),
        makeParticipant(2, { name: "z" }),
      ],
      "name",
    );
    expect(items.map((i) => i.name)).toEqual(["a", "z", "å", "ö"]);
  });
});

describe("reelForSpin", () => {
  const all = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" },
    { id: 4, name: "D" },
  ];

  it("returns all items when with replacement regardless of prior winners", () => {
    expect(reelForSpin(all, [1, 2], true)).toEqual(all);
  });

  it("removes prior winners when without replacement", () => {
    expect(reelForSpin(all, [2], false)).toEqual([
      { id: 1, name: "A" },
      { id: 3, name: "C" },
      { id: 4, name: "D" },
    ]);
  });

  it("returns full list on first spin without replacement", () => {
    expect(reelForSpin(all, [], false)).toEqual(all);
  });

  it("keeps input order when filtering", () => {
    expect(reelForSpin(all, [1, 3], false).map((i) => i.id)).toEqual([2, 4]);
  });
});
