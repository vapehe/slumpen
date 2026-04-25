import { describe, expect, it, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { drawWinners, generateSeed, simulateSyntheticDraws } from "./random";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("random IPC wrappers", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  describe("generateSeed", () => {
    it("invokes the Rust command and returns the seed", async () => {
      invokeMock.mockResolvedValueOnce("abc");
      await expect(generateSeed()).resolves.toBe("abc");
      expect(invokeMock).toHaveBeenCalledWith("generate_seed");
    });

    it("propagates invoke errors", async () => {
      invokeMock.mockRejectedValueOnce(new Error("boom"));
      await expect(generateSeed()).rejects.toThrow(/boom/i);
    });
  });

  describe("drawWinners", () => {
    it("invokes draw_winners with the expected payload", async () => {
      invokeMock.mockResolvedValueOnce([3, 1]);
      await expect(drawWinners([1, 2, 3], 2, false, "seed")).resolves.toEqual([3, 1]);
      expect(invokeMock).toHaveBeenCalledWith("draw_winners", {
        participantIds: [1, 2, 3],
        numDraws: 2,
        withReplacement: false,
        seed: "seed",
      });
    });
  });

  describe("simulateSyntheticDraws", () => {
    it("invokes simulate_synthetic_draws with the expected payload", async () => {
      invokeMock.mockResolvedValueOnce([1, 2, 1]);
      await expect(simulateSyntheticDraws(10, 3, "seed")).resolves.toEqual([1, 2, 1]);
      expect(invokeMock).toHaveBeenCalledWith("simulate_synthetic_draws", {
        numOutcomes: 10,
        sampleSize: 3,
        seed: "seed",
      });
    });
  });
});
