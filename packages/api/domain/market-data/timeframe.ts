export const MARKET_TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "1w",
] as const;

export type MarketTimeframe = (typeof MARKET_TIMEFRAMES)[number];

export const getTimeframeMs = (timeframe: MarketTimeframe): number => {
  switch (timeframe) {
    case "1m":
      return 60 * 1000;
    case "3m":
      return 3 * 60 * 1000;
    case "5m":
      return 5 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "2h":
      return 2 * 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "8h":
      return 8 * 60 * 60 * 1000;
    case "12h":
      return 12 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
  }
};
