import { Effect } from "effect";
import {
  type WhalePositionSort,
  type WhalePositionsQuery,
  type WhaleSide,
  WHALE_POSITIONS_LIMIT_DEFAULT,
  WHALE_POSITIONS_LIMIT_MAX,
  WHALE_POSITIONS_LIMIT_MIN,
} from "@0xsignal/shared";
import { asHttpError, type HttpError } from "../error-response";

const badRequest = (message: string): Effect.Effect<never, HttpError> =>
  Effect.fail(asHttpError(400, message));

const parseOptionalPositiveInt = (
  raw: string | null,
  key: string,
): Effect.Effect<number | undefined, HttpError> => {
  if (raw === null) return Effect.succeed(undefined);
  const value = raw.trim();
  if (value === "") return Effect.succeed(undefined);
  if (!/^\d+$/.test(value)) return badRequest(`Invalid ${key}: ${raw}`);

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? Effect.succeed(parsed) : badRequest(`Invalid ${key}: ${raw}`);
};

const parseOptionalNumber = (
  raw: string | null,
  key: string,
): Effect.Effect<number | undefined, HttpError> => {
  if (raw === null) return Effect.succeed(undefined);
  const value = raw.trim();
  if (value === "") return Effect.succeed(undefined);

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Effect.succeed(parsed) : badRequest(`Invalid ${key}: ${raw}`);
};

const SORT_VALUES: readonly WhalePositionSort[] = ["notional", "pnl", "funding"];
const SIDE_VALUES: readonly WhaleSide[] = ["buy", "sell"];

const isSide = (value: string): value is WhaleSide =>
  (SIDE_VALUES as readonly string[]).includes(value);

const isSort = (value: string): value is WhalePositionSort =>
  (SORT_VALUES as readonly string[]).includes(value);

export const parseWhalePositionsQuery = (
  params: URLSearchParams,
): Effect.Effect<WhalePositionsQuery, HttpError> =>
  Effect.gen(function* () {
    const query: WhalePositionsQuery = {};

    const symbol = params.get("symbol")?.trim();
    if (symbol) query.symbol = symbol;
    const cursor = params.get("cursor")?.trim();
    if (cursor) query.cursor = cursor;

    const side = params.get("side")?.trim();
    if (side) {
      if (!isSide(side)) yield* badRequest(`Invalid side: ${side}`);
      else query.side = side;
    }

    const pnlMin = yield* parseOptionalNumber(params.get("pnlMin"), "pnlMin");
    if (pnlMin !== undefined) query.pnlMin = pnlMin;
    const pnlMax = yield* parseOptionalNumber(params.get("pnlMax"), "pnlMax");
    if (pnlMax !== undefined) query.pnlMax = pnlMax;
    const fundingMin = yield* parseOptionalNumber(params.get("fundingMin"), "fundingMin");
    if (fundingMin !== undefined) query.fundingMin = fundingMin;

    const sort = params.get("sort")?.trim();
    query.sort = sort !== undefined && isSort(sort) ? sort : "notional";

    const limit = yield* parseOptionalPositiveInt(params.get("limit"), "limit");
    query.limit = Math.min(
      Math.max(limit ?? WHALE_POSITIONS_LIMIT_DEFAULT, WHALE_POSITIONS_LIMIT_MIN),
      WHALE_POSITIONS_LIMIT_MAX,
    );

    return query;
  });
