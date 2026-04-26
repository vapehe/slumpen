import type { Participant } from "./db";

export interface ReelItem {
  id: number;
  name: string;
}

const MISSING = "(saknas)";
const MALFORMED = "(felaktig rad)";

const nameCollator = new Intl.Collator("sv-SE");

/** Sort reel rows by visible name (sv-SE). Does not mutate `items`. */
function sortReelItemsByName(items: ReelItem[]): ReelItem[] {
  return [...items].sort((a, b) => nameCollator.compare(a.name, b.name));
}

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
  const mapped = participants.map((p) => ({
    id: p.id,
    name: participantDisplayName(p, nameColumn),
  }));
  return sortReelItemsByName(mapped);
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
