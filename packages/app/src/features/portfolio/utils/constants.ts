export type PortfolioPeriod = "day" | "week" | "month" | "allTime";

export const PERIOD_LABELS: Record<PortfolioPeriod, string> = {
  day: "1D",
  week: "7D",
  month: "30D",
  allTime: "All",
};

export const PERIOD_KEYS: PortfolioPeriod[] = ["day", "week", "month", "allTime"];
export const VALID_PERIODS: readonly string[] = PERIOD_KEYS;

export function isPortfolioPeriod(v: string): v is PortfolioPeriod {
  return VALID_PERIODS.includes(v);
}

export const TF_INDEX: Record<PortfolioPeriod, number> = { day: 0, week: 1, month: 2, allTime: 3 };
