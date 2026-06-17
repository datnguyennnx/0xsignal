import { Match, Schema } from "effect";
import { WS_MARKET_INTERVALS } from "@0xsignal/shared";

// Re-export shared interval constants/types as the single source of truth
export { WS_MARKET_INTERVALS as MARKET_TIMEFRAMES };

// Schema-based branded type — validation happens once at boundaries, not at call sites.
// Use `Schema.decodeUnknownEffect(MarketTimeframeSchema)(raw)` at API/event edges.
const MarketTimeframeSchema = Schema.Literals(WS_MARKET_INTERVALS).pipe(
  Schema.brand("MarketTimeframe"),
);

// Branded type: assignable to WsMarketInterval | string, but not vice-versa.
export type MarketTimeframe = typeof MarketTimeframeSchema.Type;

// Export schema for decoding at boundaries (HTTP parsers, WS subscriptions, etc.)
export { MarketTimeframeSchema };

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
