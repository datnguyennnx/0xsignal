export const MARKET_WS_INTERVALS = [
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

export type MarketWsInterval = (typeof MARKET_WS_INTERVALS)[number];

export type MarketWsChannel = "candle" | "l2Book" | "trades" | "allMids";

export type MarketWsSubscription = {
  readonly channel: MarketWsChannel;
  readonly symbol?: string;
  readonly interval?: MarketWsInterval;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly dex?: string;
};
