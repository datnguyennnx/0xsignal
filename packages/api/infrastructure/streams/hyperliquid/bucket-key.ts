import { Match } from "effect";
import type { MarketWsSubscription } from "./hub-types";

export const buildMarketWsBucketKey = (subscription: MarketWsSubscription): string =>
  Match.value(subscription.channel).pipe(
    Match.when("candle", () => `candle:${subscription.symbol}:${subscription.interval}`),
    Match.when("l2Book", () => `l2Book:${subscription.symbol}:${subscription.nSigFigs ?? "raw"}`),
    Match.when("trades", () => `trades:${subscription.symbol}`),
    Match.when("allMids", () => `allMids:${subscription.dex ?? ""}`),
    Match.exhaustive
  );
