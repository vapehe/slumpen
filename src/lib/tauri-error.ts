import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri 2 `invoke` rejects with structured JSON for Rust `Serialize` errors, not `Error` instances.
 * Normalize so catch blocks and UI can use `.message` consistently.
 */
export function messageFromTauriInvokeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) {
      return o.message;
    }
    const details = o.details;
    if (details && typeof details === "object") {
      const d = details as Record<string, unknown>;
      if (typeof d.message === "string" && d.message.length > 0) {
        return d.message;
      }
    }
  }
  return "Okänt fel från programmet.";
}

/** Wraps `invoke` and throws `Error` with a readable `message` for all failure shapes. */
export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    if (args === undefined) {
      return (await invoke(cmd)) as T;
    }
    return (await invoke(cmd, args)) as T;
  } catch (e) {
    throw new Error(messageFromTauriInvokeError(e));
  }
}
