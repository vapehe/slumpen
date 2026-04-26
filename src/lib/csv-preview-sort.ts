const defaultCollator = new Intl.Collator("sv-SE");

/**
 * Sort CSV row objects by the value in `firstColumn` using Swedish collation
 * (å, ä, ö after z). Does not mutate `rows`.
 */
export function sortRowsByFirstColumn(
  rows: Record<string, string>[],
  firstColumn: string,
  collator: Intl.Collator = defaultCollator,
): Record<string, string>[] {
  return [...rows].sort((a, b) =>
    collator.compare(a[firstColumn] ?? "", b[firstColumn] ?? ""),
  );
}
