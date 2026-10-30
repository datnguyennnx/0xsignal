import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WhalePosition, WhaleSide } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { getCoinPositions } from "@/services/api/whales";

const LADDER_DEPTH = 5;
const LADDER_MARK_BAND = 0.3;
const SHARE_PERCENT_FLOOR = 1;
const NO_ROWS: readonly WhalePosition[] = [];

export interface CoinMarket {
  long: { notional: number; count: number };
  short: { notional: number; count: number };
  ladder: { price: number; side: "buy" | "sell"; notional: number }[];
  truncated: boolean;
}

type LevelDistance = CoinMarket["ladder"][number] & { distance: number };

/** One parser for every price string on the wire: Hyperliquid sends `"0"` for an unknown price. */
export function parsePx(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Percentage of `total`, or null when the denominator carries no weight. */
export function sharePercent(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return (part / total) * 100;
}

/** Share worth printing: below one percent the headline rounds to `0.0%`. */
export function meaningfulSharePercent(part: number, total: number): number | null {
  const percent = sharePercent(part, total);
  if (percent === null || percent < SHARE_PERCENT_FLOOR) return null;
  return percent;
}

/** Label for one side of a split: a side under one percent reads `<1%`, never `0.0%`. */
export function sharePercentLabel(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return "—";
  if (percent < SHARE_PERCENT_FLOOR) return "<1%";
  // Truncated, not rounded: a side must never print `100.0%` while its twin reads `<1%`.
  return `${(Math.floor(percent * 10 + 1e-9) / 10).toFixed(1)}%`;
}

export interface SideRank {
  rank: number;
  count: number;
  side: WhaleSide;
  notional: number;
}

/**
 * Open interest is one-sided: every contract has a long and a short holder, so
 * summing both tracked sides against it double-counts and can exceed 100%.
 */
export function trackedInterestAnchor(
  long: number,
  short: number,
  openInterestUsd: number | null,
): string | null {
  const percent = sharePercent(Math.max(long, short), openInterestUsd ?? 0);
  if (percent === null) return null;
  const side = long >= short ? "longs" : "shorts";
  const shown = percent < SHARE_PERCENT_FLOOR ? "<1%" : `${percent.toFixed(1)}%`;
  return `Tracked ${side} hold ${shown} of open interest`;
}

/** A share rounds to `0.0%` on a small sample; a rank reads at any sample size. */
export function rankOnSide(rows: readonly WhalePosition[], address: string): SideRank | null {
  const target = address.toLowerCase();
  const totals: Record<WhaleSide, Map<string, number>> = { buy: new Map(), sell: new Map() };

  for (const row of rows) {
    const key = row.userAddress.toLowerCase();
    const sideTotals = totals[row.side];
    sideTotals.set(key, (sideTotals.get(key) ?? 0) + row.notionalUsd);
  }

  const long = totals.buy.get(target);
  const short = totals.sell.get(target);
  if (long === undefined && short === undefined) return null;

  const side: WhaleSide = (short ?? 0) > (long ?? 0) ? "sell" : "buy";
  const notional = (side === "buy" ? long : short) ?? 0;

  let rank = 1;
  for (const [key, value] of totals[side]) {
    if (key !== target && value > notional) rank += 1;
  }

  return { rank, count: totals[side].size, side, notional };
}

export function summarizeCoinMarket(
  rows: readonly WhalePosition[],
  nextCursor: string | null | undefined,
  markPx: number | null,
): CoinMarket {
  let longNotional = 0;
  let longCount = 0;
  let shortNotional = 0;
  let shortCount = 0;
  const levels = new Map<string, LevelDistance>();
  const mark = markPx !== null && Number.isFinite(markPx) && markPx > 0 ? markPx : null;

  for (const row of rows) {
    if (row.side === "buy") {
      longNotional += row.notionalUsd;
      longCount += 1;
    } else {
      shortNotional += row.notionalUsd;
      shortCount += 1;
    }

    if (mark === null) continue;
    const price = parsePx(row.liquidationPx);
    if (price === null) continue;

    // A long liquidates below the mark and a short above it; the opposite side is a stale snapshot.
    if (row.side === "buy" ? price >= mark : price <= mark) continue;

    const distance = Math.abs(price - mark) / mark;
    if (distance > LADDER_MARK_BAND) continue;
    const key = `${row.side}-${price}`;
    const existing = levels.get(key);

    if (existing === undefined) {
      levels.set(key, { price, side: row.side, notional: row.notionalUsd, distance });
    } else {
      existing.notional += row.notionalUsd;
      existing.distance = distance;
    }
  }

  const ladder = [...levels.values()]
    .toSorted((a, b) => a.distance - b.distance)
    .slice(0, LADDER_DEPTH)
    .map(({ price, side, notional }) => ({ price, side, notional }));

  return {
    long: { notional: longNotional, count: longCount },
    short: { notional: shortNotional, count: shortCount },
    ladder,
    truncated: nextCursor !== null && nextCursor !== undefined,
  };
}

/** Same-side levels this close to the mark read as one shelf once drawn. */
export const LADDER_MERGE_TOLERANCE_PCT = 0.0015;

export type MergedLevel = CoinMarket["ladder"][number] & { count: number };

/**
 * Collapses a banded ladder into the shelves the chart can label. The merged
 * price is notional-weighted, so the deepest level pulls its neighbours rather
 * than being pulled by a rounding-level one; a pair merges only when the two
 * prices sit within `tolerancePct` of the mark. Input order (nearest first) is
 * kept, and `summary.ladder` itself stays raw for every other consumer.
 */
export function mergeNearbyLevels(
  levels: CoinMarket["ladder"],
  markPx: number,
  tolerancePct: number = LADDER_MERGE_TOLERANCE_PCT,
): MergedLevel[] {
  const usableMark = Number.isFinite(markPx) && markPx > 0;
  const merged: MergedLevel[] = [];

  for (const level of levels) {
    const group = usableMark
      ? merged.find(
          (candidate) =>
            candidate.side === level.side &&
            Math.abs(candidate.price - level.price) / markPx <= tolerancePct,
        )
      : undefined;

    if (group === undefined) {
      merged.push({ ...level, count: 1 });
      continue;
    }

    const notional = group.notional + level.notional;
    if (notional > 0) {
      group.price = (group.price * group.notional + level.price * level.notional) / notional;
    }
    group.notional = notional;
    group.count += 1;
  }

  return merged;
}

export function useCoinMarket(coin: string, markPx: number | null) {
  const query = useQuery({
    queryKey: queryKeys.whales.coin(coin),
    queryFn: () => getCoinPositions(coin),
    enabled: coin !== "",
  });

  const rows = query.data?.positions ?? NO_ROWS;
  const summary = useMemo(
    () => summarizeCoinMarket(rows, query.data?.nextCursor, markPx),
    [rows, query.data?.nextCursor, markPx],
  );

  return { ...query, rows, summary };
}
