import { describe, expect, it } from "vitest";
import {
  decodeUtf8,
  detectDuplicates,
  parseCSVText,
  stripLeadingBom,
} from "./csv-parser";

describe("stripLeadingBom", () => {
  it("removes UTF-8 BOM from start of text", () => {
    expect(stripLeadingBom("\uFEFFname,value")).toBe("name,value");
  });

  it("leaves text unchanged when no BOM", () => {
    expect(stripLeadingBom("hello")).toBe("hello");
  });
});

describe("decodeUtf8", () => {
  it("decodes valid UTF-8", () => {
    const enc = new TextEncoder().encode("Åäö");
    expect(decodeUtf8(enc)).toEqual({ text: "Åäö" });
  });

  it("reports error for invalid UTF-8 sequences", () => {
    const bad = new Uint8Array([0xff, 0xfe, 0xfd]);
    expect(decodeUtf8(bad).error).toBeTruthy();
    expect(decodeUtf8(bad).text).toBeUndefined();
  });
});

describe("parseCSVText", () => {
  it("parses header and rows", () => {
    const csv = `fullname,email
Anna,anna@example.com
Berit,berit@example.com`;

    const result = parseCSVText(csv);

    expect(result.errors).toEqual([]);
    expect(result.columns).toEqual(["fullname", "email"]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      fullname: "Anna",
      email: "anna@example.com",
    });
  });

  it("skips empty rows", () => {
    const csv = `a,b
1,2


3,4`;

    const result = parseCSVText(csv);
    expect(result.data.map((r) => r.a)).toEqual(["1", "3"]);
  });

  it("parses CSV with BOM on first column name", () => {
    const csvWithBom = `\uFEFFfullname,note
Ada,hello`;

    const result = parseCSVText(csvWithBom);
    expect(result.columns).toContain("fullname");
    expect(result.data[0]?.fullname).toBe("Ada");
  });
});

describe("detectDuplicates", () => {
  it("counts duplicates in the chosen column", () => {
    const data = [
      { name: "Ada", id: "1" },
      { name: "Ada", id: "2" },
      { name: "Bob", id: "3" },
    ];

    expect(detectDuplicates(data, "name")).toEqual({
      total: 3,
      unique: 2,
      duplicates: 1,
    });
  });

  it(" ignores empty cells when counting presence", () => {
    const data = [{ name: "", id: "1" }];
    expect(detectDuplicates(data, "name")).toEqual({
      total: 0,
      unique: 0,
      duplicates: 0,
    });
  });
});
