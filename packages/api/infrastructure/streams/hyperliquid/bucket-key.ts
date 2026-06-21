import type { MarketWsSubscription } from "./hub-types";

export const buildMarketWsBucketKey = (subscription: MarketWsSubscription): string => {
  const { channel, symbol, interval, nSigFigs, dex } = subscription;
  switch (channel) {
    case "candle":
      return `candle:${symbol}:${interval}`;
    case "l2Book":
      // All l2Book subscriptions for the same coin+nSigFigs share one hybrid upstream
      // (both fast 5-level and slow 20-level subscriptions). The fast/depth params are
      // no longer part of the key since all subscribers get the combined 20-level feed.
      return `l2Book:${symbol}:${nSigFigs ?? "raw"}`;
    case "trades":
      return `trades:${symbol}`;
    case "allMids":
      return `allMids:${dex ?? ""}`;
    default:
      return channel satisfies never;
  }
};
