import { describe, expect, it } from "vitest";
import {
  drawWithReplacement,
  drawWithoutReplacement,
  generateSeed,
  shuffleWithSeed,
} from "./random";

describe("generateSeed", () => {
  it("returns a 32-character hex string (16 bytes)", () => {
    const s = generateSeed();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns different values across calls (very likely)", () => {
    const a = generateSeed();
    const b = generateSeed();
    expect(a).not.toBe(b);
  });
});

describe("shuffleWithSeed", () => {
  it("is deterministic for the same seed", () => {
    const items = ["a", "b", "c", "d", "e"];
    const seed = "deadbeef0123456789abcdef01234567";
    expect(shuffleWithSeed(items, seed)).toEqual(shuffleWithSeed(items, seed));
  });

  it("does not mutate the original array", () => {
    const items = [1, 2, 3];
    const copy = [...items];
    shuffleWithSeed(items, "aaaaaaaa0102030405060708090a0b0c");
    expect(items).toEqual(copy);
  });

  it("throws for invalid seed", () => {
    expect(() => shuffleWithSeed([1], "")).toThrow(/seed/i);
    expect(() => shuffleWithSeed([1], "short")).toThrow(/seed/i);
    expect(() => shuffleWithSeed([1], "gggggggg0102030405060708090a0b0c")).toThrow(/seed/i);
  });
});

describe("drawWithoutReplacement", () => {
  it("returns numDraws unique entries from the pool", () => {
    const pool = ["x", "y", "z", "w"];
    const seed = "cafebabe0102030405060708090a0b0c";
    const result = drawWithoutReplacement(pool, 2, seed);
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
    expect(result.every((r) => pool.includes(r))).toBe(true);
  });

  it("matches deterministic output for fixed seed and pool", () => {
    const pool = ["a", "b", "c"];
    const seed = "012345670102030405060708090a0b0c";
    const first = drawWithoutReplacement(pool, 2, seed);
    const second = drawWithoutReplacement(pool, 2, seed);
    expect(first).toEqual(second);
  });

  it("throws for invalid seed", () => {
    expect(() => drawWithoutReplacement([1], 1, "")).toThrow(/seed/i);
  });
});

describe("drawWithReplacement", () => {
  it("returns exactly numDraws entries", () => {
    const pool = [10, 20];
    const seed = "babec0de0102030405060708090a0b0c";
    const result = drawWithReplacement(pool, 7, seed);
    expect(result).toHaveLength(7);
    expect(result.every((r) => pool.includes(r))).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const pool = [1, 2, 3];
    const seed = "facade0102030405060708090a0b0c0d";
    expect(drawWithReplacement(pool, 5, seed)).toEqual(drawWithReplacement(pool, 5, seed));
  });

  it("throws for invalid seed", () => {
    expect(() => drawWithReplacement([1], 1, "bad")).toThrow(/seed/i);
  });
});
