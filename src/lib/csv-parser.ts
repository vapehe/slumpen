import Papa from "papaparse";
import { readFile } from "@tauri-apps/plugin-fs";

/** Result of parsing CSV text (header row + body rows). */
export interface ParsedCSV {
  /** One object per row; keys are trimmed header names. */
  data: Record<string, string>[];
  columns: string[];
  errors: string[];
}

/** Strip Unicode BOM so the header row parses correctly (UTF-8 BOM from Excel etc.). */
export function stripLeadingBom(text: string): string {
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}

/** Decode UTF-8 bytes; rejects invalid sequences (shows a clear message in UI). */
export function decodeUtf8(bytes: Uint8Array): { text?: string; error?: string } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text };
  } catch {
    return {
      error:
        "Filen är inte giltig UTF-8. Spara CSV-filen som UTF-8 (utan konstiga tecken) och försök igen.",
    };
  }
}

/**
 * Parse CSV text with header row and skip empty lines.
 * Exported for unit tests and callers that already have text.
 */
export function parseCSVText(rawText: string): ParsedCSV {
  const text = stripLeadingBom(rawText);

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => String(h).trim(),
  });

  const errors: string[] = [];
  if (parsed.errors?.length) {
    for (const e of parsed.errors) {
      errors.push(e.message ?? String(e.code));
    }
  }

  const fields =
    parsed.meta.fields?.filter((h): h is string => typeof h === "string" && h.trim() !== "") ??
    [];

  /** Column order from parser (excluding empty headers). */
  const columns = fields.map((h) => h.trim()).filter(Boolean);

  const rows = parsed.data ?? [];
  const data: Record<string, string>[] = [];

  for (const row of rows) {
    const normalized: Record<string, string> = {};
    for (const col of columns) {
      const raw = row[col];
      normalized[col] =
        raw === undefined || raw === null ? "" : String(raw).trim();
    }
    data.push(normalized);
  }

  return { data, columns, errors };
}

/** Read bytes from disk and parse as CSV (UTF-8). Use with paths from the Tauri dialog. */
export async function parseCSVFile(filePath: string): Promise<ParsedCSV> {
  const bytes = await readFile(filePath);
  const decoded = decodeUtf8(bytes);
  if (decoded.error) {
    return { data: [], columns: [], errors: [decoded.error] };
  }
  const parsed = parseCSVText(decoded.text!);
  return parsed;
}

export function detectDuplicates(
  data: Record<string, string>[],
  columnName: string,
): { total: number; unique: number; duplicates: number } {
  const values = data.map((row) => row[columnName]).filter(Boolean);
  const uniqueValues = new Set(values);

  return {
    total: values.length,
    unique: uniqueValues.size,
    duplicates: values.length - uniqueValues.size,
  };
}
