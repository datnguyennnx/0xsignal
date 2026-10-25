import { Effect, Schema } from "effect";
import {
  WHALE_POSITIONS_LIMIT_DEFAULT,
  WHALE_POSITIONS_LIMIT_MAX,
  WHALE_POSITIONS_LIMIT_MIN,
} from "@0xsignal/shared";
import {
  NormalizedEnum,
  PositiveIntegerFromQuery,
  TrimmedString,
  parseQuery,
} from "../../platform/http/utils/param-parsers";

const whaleSide = NormalizedEnum(["buy", "sell"]);

const whaleSort = NormalizedEnum(["notional", "pnl", "funding"]);

const whalePositionsQuery = Schema.Struct({
  symbol: Schema.optionalKey(TrimmedString),
  side: Schema.optionalKey(whaleSide),
  pnlMin: Schema.optionalKey(Schema.FiniteFromString),
  pnlMax: Schema.optionalKey(Schema.FiniteFromString),
  fundingMin: Schema.optionalKey(Schema.FiniteFromString),
  sort: Schema.optionalKey(whaleSort),
  limit: Schema.optionalKey(PositiveIntegerFromQuery),
  cursor: Schema.optionalKey(TrimmedString),
});

const clampLimit = (limit: number | undefined): number =>
  Math.min(
    Math.max(limit ?? WHALE_POSITIONS_LIMIT_DEFAULT, WHALE_POSITIONS_LIMIT_MIN),
    WHALE_POSITIONS_LIMIT_MAX,
  );

export const parseWhalePositionsQuery = (searchParams: URLSearchParams) =>
  parseQuery(searchParams, whalePositionsQuery).pipe(
    Effect.map((query) =>
      Object.assign(query, {
        sort: query.sort ?? "notional",
        limit: clampLimit(query.limit),
      }),
    ),
  );
