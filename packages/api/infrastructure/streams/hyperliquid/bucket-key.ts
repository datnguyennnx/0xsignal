import type { MarketWsSubscription } from "../../../schemas/market-data/ws";

export const buildMarketWsBucketKey = (subscription: MarketWsSubscription): string => {
  if (subscription.channel === "candle") {
    return `candle:${subscription.symbol}:${subscription.interval}`;
  }
  if (subscription.channel === "l2Book") {
    return `l2Book:${subscription.symbol}:${subscription.nSigFigs ?? "raw"}`;
  }
  if (subscription.channel === "trades") {
    return `trades:${subscription.symbol}`;
  }
  return `allMids:${subscription.dex ?? ""}`;
};
