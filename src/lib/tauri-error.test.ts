import { describe, expect, it } from "vitest";
import { messageFromTauriInvokeError } from "./tauri-error";

describe("messageFromTauriInvokeError", () => {
  it("returns message from Error", () => {
    expect(messageFromTauriInvokeError(new Error("plain"))).toBe("plain");
  });

  it("returns string as-is", () => {
    expect(messageFromTauriInvokeError("str")).toBe("str");
  });

  it("extracts message from Tauri / serde AppError shape (adjacent tag)", () => {
    const e = {
      code: "InvalidInput",
      details: { message: "Kan inte dra fler vinnare än antalet deltagare utan återläggning." },
    };
    expect(messageFromTauriInvokeError(e)).toBe(
      "Kan inte dra fler vinnare än antalet deltagare utan återläggning.",
    );
  });

  it("uses top-level message when present", () => {
    expect(messageFromTauriInvokeError({ message: "top" })).toBe("top");
  });

  it("has a generic fallback for unknown values", () => {
    expect(messageFromTauriInvokeError(null)).toMatch(/okänt/i);
    expect(messageFromTauriInvokeError({})).toMatch(/okänt/i);
  });
});
