import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { awaitWithTimeout } from "./await-with-timeout";

describe("awaitWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the fulfilled value when promise resolves before timeout", async () => {
    const result = await awaitWithTimeout(Promise.resolve(42), 10_000);
    expect(result).toBe(42);
  });

  it("propagates rejection when promise rejects before timeout", async () => {
    await expect(awaitWithTimeout(Promise.reject(new Error("boom")), 10_000)).rejects.toThrow("boom");
  });

  it("returns undefined when timeout elapses first", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const never = new Promise<number>(() => {});
    const resultPromise = awaitWithTimeout(never, 5000);

    vi.advanceTimersByTime(5000);
    await expect(resultPromise).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
  });

  it("throws RangeError for non-positive or non-finite timeoutMs", async () => {
    await expect(awaitWithTimeout(Promise.resolve(1), 0)).rejects.toThrow(RangeError);
    await expect(awaitWithTimeout(Promise.resolve(1), -1)).rejects.toThrow(RangeError);
    await expect(awaitWithTimeout(Promise.resolve(1), Number.NaN)).rejects.toThrow(RangeError);
  });

  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("clears timer when promise fulfills quickly", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const p = Promise.resolve("ok");
      const resultPromise = awaitWithTimeout(p, 5000);

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("ok");
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
