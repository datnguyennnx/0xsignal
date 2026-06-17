import { Match } from "effect";
import { WS_MARKET_INTERVALS, type WsMarketInterval } from "@0xsignal/shared";

// Re-export shared interval constants/types as the single source of truth
export { WS_MARKET_INTERVALS as MARKET_TIMEFRAMES };
export type MarketTimeframe = WsMarketInterval;

export const getTimeframeMs = (timeframe: MarketTimeframe): number =>
  Match.value(timeframe).pipe(
    Match.when("1m", () => 60 * 1000),
    Match.when("3m", () => 3 * 60 * 1000),
    Match.when("5m", () => 5 * 60 * 1000),
    Match.when("15m", () => 15 * 60 * 1000),
    Match.when("30m", () => 30 * 60 * 1000),
    Match.when("1h", () => 60 * 60 * 1000),
    Match.when("2h", () => 2 * 60 * 60 * 1000),
    Match.when("4h", () => 4 * 60 * 60 * 1000),
    Match.when("8h", () => 8 * 60 * 60 * 1000),
    Match.when("12h", () => 12 * 60 * 60 * 1000),
    Match.when("1d", () => 24 * 60 * 60 * 1000),
    Match.when("1w", () => 7 * 24 * 60 * 60 * 1000),
    Match.exhaustive,
  );
