import { describe, expect, it } from "vitest";
import type { ParsedCSV } from "./csv-parser";
import { validateLotteryCreate } from "./lottery-create-validation";

function csv(overrides: Partial<ParsedCSV> = {}): ParsedCSV {
  return {
    data: [{ namn: "Anna" }],
    columns: ["namn"],
    errors: [],
    ...overrides,
  };
}

describe("validateLotteryCreate", () => {
  it("rejects empty name", () => {
    const r = validateLotteryCreate({
      name: "   ",
      numDraws: 1,
      selectedNameColumn: "namn",
      parsedCSV: csv(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/namn/i);
  });

  it("rejects missing CSV", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1,
      selectedNameColumn: "namn",
      parsedCSV: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/CSV/i);
  });

  it("rejects when parser reported errors", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1,
      selectedNameColumn: "namn",
      parsedCSV: csv({ errors: ["bad row"] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/parsningsfel/i);
  });

  it("rejects zero data rows", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1,
      selectedNameColumn: "namn",
      parsedCSV: csv({ data: [], columns: ["namn"] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/inga datarader/i);
  });

  it("rejects missing name column selection", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1,
      selectedNameColumn: "",
      parsedCSV: csv(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/kolumn/i);
  });

  it("rejects name column not in CSV columns", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1,
      selectedNameColumn: "email",
      parsedCSV: csv(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/namnkolumn/i);
  });

  it("rejects numDraws below 1", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 0,
      selectedNameColumn: "namn",
      parsedCSV: csv({ data: [{ namn: "A" }, { namn: "B" }] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/minst 1/i);
  });

  it("rejects non-integer numDraws", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 1.5,
      selectedNameColumn: "namn",
      parsedCSV: csv({ data: [{ namn: "A" }, { namn: "B" }] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/heltal|minst 1/i);
  });

  it("rejects numDraws greater than row count", () => {
    const r = validateLotteryCreate({
      name: "Test",
      numDraws: 5,
      selectedNameColumn: "namn",
      parsedCSV: csv({ data: [{ namn: "A" }, { namn: "B" }] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/2/);
  });

  it("accepts valid input and returns trimmed display name", () => {
    const r = validateLotteryCreate({
      name: "  Årsmöte  ",
      numDraws: 2,
      selectedNameColumn: "namn",
      parsedCSV: csv({
        data: [{ namn: "A" }, { namn: "B" }, { namn: "C" }],
      }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.displayName).toBe("Årsmöte");
  });
});
