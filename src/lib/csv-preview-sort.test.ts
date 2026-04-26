import { describe, expect, it } from "vitest";
import { sortRowsByFirstColumn } from "./csv-preview-sort";

describe("sortRowsByFirstColumn", () => {
  it("does not mutate the input array", () => {
    const rows = [{ name: "b" }, { name: "a" }];
    const copy = [...rows];
    sortRowsByFirstColumn(rows, "name");
    expect(rows).toEqual(copy);
  });

  it("sorts by first column with sv-SE (å, ä, ö after z)", () => {
    const rows = [
      { name: "ö", id: "1" },
      { name: "a", id: "2" },
      { name: "z", id: "3" },
      { name: "å", id: "4" },
      { name: "ä", id: "5" },
    ];
    const sorted = sortRowsByFirstColumn(rows, "name");
    expect(sorted.map((r) => r.name)).toEqual(["a", "z", "å", "ä", "ö"]);
  });

  it("places uppercase Z before å like Swedish collation", () => {
    const rows = [{ name: "å" }, { name: "Z" }];
    const sorted = sortRowsByFirstColumn(rows, "name");
    expect(sorted.map((r) => r.name)).toEqual(["Z", "å"]);
  });

  it("treats missing cell as empty string", () => {
    const rows = [{ name: "b" }, { name: "" }, { name: "a" }];
    const sorted = sortRowsByFirstColumn(rows, "name");
    expect(sorted.map((r) => r.name)).toEqual(["", "a", "b"]);
  });

  it("uses injected collator when provided", () => {
    const rows = [{ k: "b" }, { k: "a" }];
    const descending: Intl.Collator = {
      compare: (x: string, y: string) => y.localeCompare(x, "sv-SE"),
    } as Intl.Collator;
    const sorted = sortRowsByFirstColumn(rows, "k", descending);
    expect(sorted.map((r) => r.k)).toEqual(["b", "a"]);
  });
});
