const TIMEOUT_MARKER = Symbol("awaitWithTimeout.timeout");

/**
 * Races `promise` against a wall-clock timeout.
 * - If `promise` fulfills first, returns its value and clears the timer.
 * - If `promise` rejects first, propagates the rejection and clears the timer.
 * - If the timeout elapses first, returns `undefined` and logs a warning (the
 *   underlying promise may still settle later).
 */
export async function awaitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  if (!(timeoutMs > 0) || !Number.isFinite(timeoutMs)) {
    throw new RangeError("timeoutMs must be a finite number > 0");
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<typeof TIMEOUT_MARKER>((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      console.warn("awaitWithTimeout: promise did not settle within timeoutMs", { timeoutMs });
      resolve(TIMEOUT_MARKER);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      promise.then(
        (value) => {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          return value as T | typeof TIMEOUT_MARKER;
        },
        (error: unknown) => {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          throw error;
        },
      ),
      timeoutPromise,
    ]);

    if (result === TIMEOUT_MARKER) {
      return undefined;
    }
    return result as T;
  } catch (e) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    throw e;
  }
}
