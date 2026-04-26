import { afterEach, describe, expect, it } from "vitest";
import {
  EUROPE_STOCKHOLM,
  formatDateSv,
  formatDateTimeSv,
  normalizeSqlUtcTimestamp,
} from "./format-swedish-time";

describe("format-swedish-time", () => {
  const origTz = process.env.TZ;

  afterEach(() => {
    if (origTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = origTz;
    }
  });

  it("formatDateTimeSv uses Europe/Stockholm, not process default TZ", () => {
    process.env.TZ = "America/New_York";
    const inst = "2025-06-15T12:00:00.000Z";
    const d = new Date(inst);
    const naive = d.toLocaleString("sv-SE");
    const stockholm = formatDateTimeSv(inst);
    expect(naive).not.toBe(stockholm);
    expect(stockholm).toBe(d.toLocaleString("sv-SE", { timeZone: EUROPE_STOCKHOLM }));
  });

  it("formatDateSv uses calendar day in Stockholm", () => {
    process.env.TZ = "America/New_York";
    const inst = "2025-01-01T23:00:00.000Z";
    const d = new Date(inst);
    const naive = d.toLocaleDateString("sv-SE", { dateStyle: "medium" });
    expect(formatDateSv(inst)).not.toBe(naive);
    expect(formatDateSv(inst)).toBe(
      d.toLocaleDateString("sv-SE", { timeZone: EUROPE_STOCKHOLM, dateStyle: "medium" }),
    );
  });

  it("returns raw string for unparseable input", () => {
    expect(formatDateTimeSv("")).toBe("");
    expect(formatDateTimeSv("not-a-date")).toBe("not-a-date");
    expect(formatDateSv("")).toBe("");
  });

  it("formatDateTimeSv forwards Intl options", () => {
    const s = formatDateTimeSv("2025-06-15T12:00:00.000Z", { dateStyle: "medium", timeStyle: "short" });
    expect(s.length).toBeGreaterThan(0);
    expect(s).toBe(
      new Date("2025-06-15T12:00:00.000Z").toLocaleString("sv-SE", {
        timeZone: EUROPE_STOCKHOLM,
        dateStyle: "medium",
        timeStyle: "short",
      }),
    );
  });

  it("normalizeSqlUtcTimestamp maps SQLite UTC strings to ISO Z", () => {
    expect(normalizeSqlUtcTimestamp("2026-04-26 09:13:48")).toBe("2026-04-26T09:13:48Z");
    expect(normalizeSqlUtcTimestamp("2026-04-26T09:13:48")).toBe("2026-04-26T09:13:48Z");
    expect(normalizeSqlUtcTimestamp("2026-04-26 09:13:48.123")).toBe("2026-04-26T09:13:48.123Z");
    expect(normalizeSqlUtcTimestamp("2025-06-15T12:00:00.000Z")).toBe("2025-06-15T12:00:00.000Z");
  });

  it("SQLite space-separated datetime matches explicit UTC Z in Stockholm", () => {
    const space = "2026-04-26 09:13:48";
    const z = "2026-04-26T09:13:48.000Z";
    expect(formatDateTimeSv(space)).toBe(formatDateTimeSv(z));
    expect(formatDateTimeSv(space)).toMatch(/11:13:48/);
  });

  it("formatDateSv handles SQLite space-separated UTC datetime", () => {
    expect(formatDateSv("2026-04-26 09:13:48")).toBe(
      new Date("2026-04-26T09:13:48Z").toLocaleDateString("sv-SE", {
        timeZone: EUROPE_STOCKHOLM,
        dateStyle: "medium",
      }),
    );
  });
});
