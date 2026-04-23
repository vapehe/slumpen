import type { Participant } from "./db";

export interface ReelItem {
  id: number;
  name: string;
}

const MISSING = "(saknas)";
const MALFORMED = "(felaktig rad)";

export function participantDisplayName(participant: Participant, nameColumn: string): string {
  try {
    const obj = JSON.parse(participant.data_json) as Record<string, unknown>;
    const value = obj[nameColumn];
    if (typeof value === "string" && value !== "") return value;
    return MISSING;
  } catch {
    return MALFORMED;
  }
}

export function buildReelItems(participants: Participant[], nameColumn: string): ReelItem[] {
  return participants.map((p) => ({
    id: p.id,
    name: participantDisplayName(p, nameColumn),
  }));
}

export function reelForSpin(
  all: ReelItem[],
  revealedWinnerIds: number[],
  withReplacement: boolean,
): ReelItem[] {
  if (withReplacement) return all;
  const excluded = new Set(revealedWinnerIds);
  return all.filter((item) => !excluded.has(item.id));
}
