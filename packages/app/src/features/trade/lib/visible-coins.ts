import type { MarketRowData } from "./market-row-data";

export type VisibleCoinRows = readonly MarketRowData[];

export function visibleCoinsOf(
  rows: VisibleCoinRows,
  range: { start: number; end: number },
): readonly string[] {
  const start = Math.max(0, range.start);
  const end = Math.min(rows.length, range.end);
  const coins: string[] = [];
  const seen = new Set<string>();

  for (let index = start; index < end; index += 1) {
    const row = rows[index];
    if (row.marketType !== "perp") continue;
    if (seen.has(row.midKey)) continue;
    seen.add(row.midKey);
    coins.push(row.midKey);
  }

  return coins;
}
