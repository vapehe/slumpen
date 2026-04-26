import type { Participant, ParticipantData } from "./db";

/** Kolumnordning som vid CSV-import (första radens nyckelordning). */
export function getParticipantCsvColumnOrder(participants: Participant[]): string[] {
  const sorted = [...participants].sort((a, b) => a.row_index - b.row_index);
  const first = sorted[0];
  if (first == null) {
    return [];
  }
  try {
    const data = JSON.parse(first.data_json) as ParticipantData;
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      return [];
    }
    return Object.keys(data);
  } catch {
    return [];
  }
}

function parseParticipantRow(p: Participant): ParticipantData {
  try {
    const data = JSON.parse(p.data_json) as ParticipantData;
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    return data;
  } catch {
    return {};
  }
}

/** En rad per deltagare i samma kolumnordning som `columns`. */
export function buildParticipantTableRows(
  participants: Participant[],
  columns: string[],
): string[][] {
  const sorted = [...participants].sort((a, b) => a.row_index - b.row_index);
  return sorted.map((p) => {
    const data = parseParticipantRow(p);
    return columns.map((col) => {
      const v = data[col];
      return v === undefined || v === null ? "" : String(v);
    });
  });
}
