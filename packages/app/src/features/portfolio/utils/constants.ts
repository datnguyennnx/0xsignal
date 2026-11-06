import { PORTFOLIO_PERIOD_KEYS } from "@0xsignal/shared/schemas/user-data.ts";
import type { PortfolioPeriodKey, PortfolioResponse } from "@0xsignal/shared";

export type PortfolioPeriod = "day" | "week" | "month" | "allTime";

export const PERIOD_LABELS: Record<PortfolioPeriod, string> = {
  day: "1D",
  week: "7D",
  month: "30D",
  allTime: "All",
};

export const PERIOD_KEYS: readonly PortfolioPeriod[] = ["day", "week", "month", "allTime"];
const VALID_PERIODS: readonly string[] = PERIOD_KEYS;

export function isPortfolioPeriod(v: string): v is PortfolioPeriod {
  return VALID_PERIODS.includes(v);
}

/** Name → tuple slot, derived from the single ordered list of wire periods. */
const PERIOD_SLOTS = new Map<PortfolioPeriodKey, number>(
  PORTFOLIO_PERIOD_KEYS.map((key, index) => [key, index]),
);

export function periodSlot(key: PortfolioPeriodKey): number {
  const slot = PERIOD_SLOTS.get(key);
  if (slot === undefined) throw new Error(`Unknown portfolio period: ${key}`);
  return slot;
}

/** The perp series mirrors the spot timeframe in the second half of the tuple. */
export const PERPS_PERIOD: Record<PortfolioPeriod, PortfolioPeriodKey> = {
  day: "perpDay",
  week: "perpWeek",
  month: "perpMonth",
  allTime: "perpAllTime",
};

export function findPeriodEntry(
  portfolio: PortfolioResponse | undefined,
  key: PortfolioPeriodKey,
): PortfolioResponse[number][1] | undefined {
  if (portfolio === undefined) return undefined;
  return portfolio[periodSlot(key)]?.[1];
}
