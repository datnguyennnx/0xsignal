import { Schema } from "effect";
import { MarketTimeframeSchema } from "./timeframe";
import {
  PositiveIntegerFromQuery,
  TrimmedString,
  parseQuery,
} from "../../platform/http/utils/param-parsers";

export const DEFAULT_EXCHANGE = "Hyperliquid";

const requiredSymbol = TrimmedString.pipe(
  Schema.annotateKey({ messageMissingKey: "Missing required query parameter: symbol" }),
);

const requiredInterval = MarketTimeframeSchema.pipe(
  Schema.annotateKey({ messageMissingKey: "Missing required query parameter: interval" }),
);

const optionalExchange = {
  exchange: Schema.optionalKey(TrimmedString),
};

const windowEnd = {
  end_time: Schema.optionalKey(Schema.DateFromString),
};

const marketCandlesQuery = Schema.Struct({
  symbol: requiredSymbol,
  interval: requiredInterval,
  ...optionalExchange,
  start_time: Schema.optionalKey(Schema.DateFromString),
  ...windowEnd,
  limit: Schema.optionalKey(PositiveIntegerFromQuery),
});

const marketRecentCandlesQuery = Schema.Struct({
  symbol: requiredSymbol,
  interval: requiredInterval,
  ...optionalExchange,
  ...windowEnd,
  limit: Schema.optionalKey(PositiveIntegerFromQuery),
});

const marketSymbolQuery = Schema.Struct({
  symbol: requiredSymbol,
});

// `timeframe` predates `interval`; keep accepting it without duplicating the schema.
const withIntervalAlias = (searchParams: URLSearchParams): URLSearchParams => {
  const alias = searchParams.get("timeframe");
  if (alias === null || searchParams.has("interval")) return searchParams;

  const resolved = new URLSearchParams(searchParams);
  resolved.set("interval", alias);
  return resolved;
};

export const parseMarketCandlesQuery = (searchParams: URLSearchParams) =>
  parseQuery(withIntervalAlias(searchParams), marketCandlesQuery);

export const parseMarketRecentCandlesQuery = (searchParams: URLSearchParams) =>
  parseQuery(withIntervalAlias(searchParams), marketRecentCandlesQuery);

export const parseMarketSymbolQuery = (searchParams: URLSearchParams) =>
  parseQuery(searchParams, marketSymbolQuery);
