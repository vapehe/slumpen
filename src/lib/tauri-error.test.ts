import { describe, expect, it } from "vitest";
import {
  GENERIC_USER_FACING_ERROR,
  messageFromTauriInvokeError,
  userFacingErrorMessage,
} from "./tauri-error";

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

describe("userFacingErrorMessage", () => {
  it("uses contextual fallback when the error is not a string, Error, or structured message", () => {
    expect(userFacingErrorMessage(null, "Kunde inte läsa lotterier.")).toBe("Kunde inte läsa lotterier.");
    expect(userFacingErrorMessage({}, "Kunde inte läsa lotterier.")).toBe("Kunde inte läsa lotterier.");
  });

  it("preserves Error message", () => {
    expect(userFacingErrorMessage(new Error("disk full"), "fallback")).toBe("disk full");
  });

  it("preserves Tauri details.message", () => {
    const e = {
      code: "InvalidInput",
      details: { message: "Saknar kolumn." },
    };
    expect(userFacingErrorMessage(e, "fallback")).toBe("Saknar kolumn.");
  });

  it("exposes the same generic string as messageFromTauriInvokeError for empty unknown", () => {
    expect(GENERIC_USER_FACING_ERROR).toBe(messageFromTauriInvokeError(null));
  });
});
