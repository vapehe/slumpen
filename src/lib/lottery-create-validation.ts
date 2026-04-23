import type { ParsedCSV } from "./csv-parser";

export type LotteryCreateValidation =
  | { ok: true; displayName: string }
  | { ok: false; message: string };

export function validateLotteryCreate(params: {
  name: string;
  numDraws: number;
  selectedNameColumn: string;
  parsedCSV: ParsedCSV | null;
}): LotteryCreateValidation {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    return { ok: false, message: "Ange ett namn för lotteriet." };
  }

  if (!params.parsedCSV) {
    return { ok: false, message: "Välj och läs in en CSV-fil först." };
  }

  if (params.parsedCSV.errors.length > 0) {
    return {
      ok: false,
      message:
        "CSV-filen innehåller parsningsfel. Rätta filen eller välj en annan.",
    };
  }

  if (params.parsedCSV.data.length === 0) {
    return { ok: false, message: "CSV-filen innehåller inga datarader." };
  }

  const col = params.selectedNameColumn.trim();
  if (!col) {
    return {
      ok: false,
      message: "Välj vilken kolumn som visar deltagarens namn.",
    };
  }

  if (!params.parsedCSV.columns.includes(col)) {
    return {
      ok: false,
      message: "Vald namnkolumn finns inte i CSV-filen.",
    };
  }

  const n = params.numDraws;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return {
      ok: false,
      message: "Antal dragningar måste vara ett heltal som är minst 1.",
    };
  }

  const max = params.parsedCSV.data.length;
  if (n > max) {
    return {
      ok: false,
      message: `Antal dragningar får inte överstiga antal rader (${max}).`,
    };
  }

  return { ok: true, displayName: trimmedName };
}
