import { Effect } from "effect";
import { parseOptionalSigFigsParam } from "../utils/param-parsers";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

export const MARKET_INTERVALS = [
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

export type MarketInterval = (typeof MARKET_INTERVALS)[number];

const badRequest = (message: string): Effect.Effect<never, HttpError> =>
  Effect.fail({ status: 400, message });

export const parseRequiredString = (
  params: URLSearchParams,
  key: string
): Effect.Effect<string, HttpError> => {
  const value = params.get(key)?.trim();
  if (!value) {
    return badRequest(`Missing required query parameter: ${key}`);
  }
  return Effect.succeed(value);
};

export const parseOptionalDate = (
  params: URLSearchParams,
  key: string
): Effect.Effect<Date | undefined, HttpError> => {
  const value = params.get(key);
  if (!value) {
    return Effect.succeed(undefined);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return badRequest(`Invalid date for ${key}: ${value}`);
  }

  return Effect.succeed(parsed);
};

export const parseOptionalPositiveInt = (
  params: URLSearchParams,
  key: string
): Effect.Effect<number | undefined, HttpError> => {
  const rawValue = params.get(key);
  if (!rawValue) {
    return Effect.succeed(undefined);
  }

  const value = rawValue.trim();
  if (!/^[+-]?\d+$/.test(value)) {
    return badRequest(`Invalid integer for ${key}: ${rawValue}`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return badRequest(`Invalid integer for ${key}: ${rawValue}`);
  }

  return Effect.succeed(parsed);
};

export const parseOptionalSigFigs = (
  params: URLSearchParams,
  key: string
): Effect.Effect<2 | 3 | 4 | 5 | undefined, HttpError> => {
  const value = parseOptionalSigFigsParam(params, key);
  if (value === null) {
    return badRequest(`Invalid ${key}: ${params.get(key)}. Supported values are 2, 3, 4, 5.`);
  }

  return Effect.succeed(value);
};

export const parseInterval = (
  params: URLSearchParams
): Effect.Effect<MarketInterval, HttpError> => {
  const value = params.get("interval") ?? params.get("timeframe");
  if (!value) {
    return badRequest("Missing required query parameter: interval");
  }
  if (!MARKET_INTERVALS.includes(value as MarketInterval)) {
    return badRequest(`Unsupported interval: ${value}`);
  }
  return Effect.succeed(value as MarketInterval);
};
