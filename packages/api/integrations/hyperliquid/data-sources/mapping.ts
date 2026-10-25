import { Effect } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError, toHyperliquidError } from "./errors";
import { processMetaResults } from "./market-aggregation";
import type { TickerSnapshot, HyperliquidInfoClient } from "./types";
import { withDedup } from "./request-dedup";
import { acquireInfoWeight, type HyperliquidRateLimiter } from "../rate-limit";

/**
 * Narrow an InfoClient (from @nktkas/hyperliquid) to HyperliquidInfoClient.
 */
export const toHyperliquidInfoClient = (info: InfoClient): HyperliquidInfoClient => info;

export { getAggregatedMarketsSnapshot } from "./aggregated-markets";

/**
 * Fetch allMids with in-flight dedup. One attempt per call: pacing belongs to
 * the shared limiter, and retrying a 429 here only multiplies the burst.
 */
const fetchAllMids = (
  info: HyperliquidInfoClient,
): Effect.Effect<Record<string, string>, never, HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    yield* acquireInfoWeight;
    return yield* Effect.tryPromise({
      try: () => withDedup("allMids", () => info.allMids()),
      catch: (cause) => toHyperliquidError("Failed to fetch mids", cause),
    });
  }).pipe(
    Effect.tapError((e) => Effect.logWarning(`[mapping] allMids fetch failed: ${String(e)}`)),
    Effect.catch(() => Effect.succeed<Record<string, string>>({})),
  );

const fetchPerpDexs = (
  info: HyperliquidInfoClient,
): Effect.Effect<Array<null | { name: string }>, never, HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    yield* acquireInfoWeight;
    return yield* Effect.tryPromise({
      try: () => withDedup("perpDexs", () => info.perpDexs?.() ?? Promise.resolve([])),
      catch: (cause) => toHyperliquidError("Failed to fetch perp DEXs", cause),
    });
  }).pipe(
    Effect.tapError((e) =>
      Effect.logWarning(`[mapping] perpDexs fetch failed, falling back to empty: ${String(e)}`),
    ),
    Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>)),
  );

const fetchBaseSnapshot = (
  info: HyperliquidInfoClient,
  skipPerpDexs = false,
): Effect.Effect<
  [Array<null | { name: string }>, Record<string, string>],
  never,
  HyperliquidRateLimiter
> =>
  Effect.all(
    [
      skipPerpDexs ? Effect.succeed([] as Array<null | { name: string }>) : fetchPerpDexs(info),
      fetchAllMids(info),
    ],
    { concurrency: 3 },
  );

const fetchMetaAndAssetCtxs = (
  info: HyperliquidInfoClient,
  dexName: string,
): Effect.Effect<[unknown, unknown], never, HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    yield* acquireInfoWeight;
    return yield* Effect.tryPromise({
      try: () =>
        withDedup(`metaAndAssetCtxs:${dexName}`, () =>
          info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined),
        ),
      catch: (cause) => toHyperliquidError(`Failed to fetch meta for ${dexName || "main"}`, cause),
    });
  }).pipe(Effect.catch(() => Effect.succeed<[unknown, unknown]>([null, null])));

/** One cache identity per distinct upstream request set: every dex, or one dex. */
const ALL_DEXS_SCOPE = "*";
const DEX_SCOPE_PREFIX = "dex:";

const resolveDex = (symbol: string): string => {
  const normalized = normalizeSymbol(symbol);
  return normalized.includes(":") ? normalized.split(":")[0].toLowerCase() : "";
};

/**
 * Symbol reads collapse to their single dex: every symbol on a dex issues the
 * same allMids + metaAndAssetCtxs pair, so the snapshot is identical for all of
 * them.
 */
export const tickerSnapshotCacheKey = (symbol?: string): string =>
  symbol === undefined
    ? ALL_DEXS_SCOPE
    : `${DEX_SCOPE_PREFIX}${symbol === "" ? "" : resolveDex(symbol)}`;

const dexNamesForScope = (
  scope: string,
  perpDexs: ReadonlyArray<null | { name: string }>,
): string[] =>
  scope === ALL_DEXS_SCOPE
    ? ["", ...perpDexs.filter((d): d is { name: string } => d !== null).map((d) => d.name)]
    : [scope.slice(DEX_SCOPE_PREFIX.length)];

const fetchTickerSnapshot = (
  info: HyperliquidInfoClient,
  scope: string,
): Effect.Effect<TickerSnapshot, HyperliquidError, HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    const includeAllDexs = scope === ALL_DEXS_SCOPE;
    const [perpDexs, allMids] = yield* fetchBaseSnapshot(info, !includeAllDexs);

    const metaResults = yield* Effect.all(
      dexNamesForScope(scope, perpDexs).map((dexName) => fetchMetaAndAssetCtxs(info, dexName)),
      { concurrency: 3 },
    );

    const { flattenedUniverse, flattenedAssetCtxs } = processMetaResults(metaResults);

    return {
      universe: flattenedUniverse,
      assetCtxs: flattenedAssetCtxs,
      allMids,
    };
  });

export const getTickerSnapshotByCacheKey = (
  info: HyperliquidInfoClient,
  key: string,
): Effect.Effect<TickerSnapshot, HyperliquidError, HyperliquidRateLimiter> =>
  fetchTickerSnapshot(info, key);

export const getTickerSnapshot = (
  info: HyperliquidInfoClient,
  symbol?: string,
): Effect.Effect<TickerSnapshot, HyperliquidError, HyperliquidRateLimiter> =>
  fetchTickerSnapshot(info, tickerSnapshotCacheKey(symbol));
