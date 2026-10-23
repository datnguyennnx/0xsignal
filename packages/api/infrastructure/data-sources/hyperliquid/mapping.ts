import { Duration, Effect, Schedule } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError, toHyperliquidError } from "./errors";
import { processMetaResults } from "./market-aggregation";
import type { TickerSnapshot, HyperliquidInfoClient } from "./types";
import { withDedup } from "./request-dedup";

/**
 * Narrow an InfoClient (from @nktkas/hyperliquid) to HyperliquidInfoClient.
 */
export const toHyperliquidInfoClient = (info: InfoClient): HyperliquidInfoClient => info;

export { getAggregatedMarketsSnapshot } from "./aggregated-markets";

const MIDS_RETRY_MAX = 3;
const MIDS_RETRY_BASE = Duration.seconds(1);

/**
 * Fetch allMids with in-flight dedup + exponential backoff on 429.
 */
const fetchAllMidsWithRetry = (
  info: HyperliquidInfoClient,
): Effect.Effect<Record<string, string>> =>
  Effect.tryPromise({
    try: () => withDedup("allMids", () => info.allMids()),
    catch: (cause) => toHyperliquidError("Failed to fetch mids", cause),
  }).pipe(
    Effect.retry({
      times: MIDS_RETRY_MAX - 1,
      schedule: Schedule.exponential(MIDS_RETRY_BASE),
      while: (err: HyperliquidError) => err.kind === "RATE_LIMITED",
    }),
    Effect.tapError((e) =>
      Effect.logWarning(`[mapping] allMids fetch failed after retries: ${String(e)}`),
    ),
    Effect.catch(() => Effect.succeed<Record<string, string>>({})),
  );

const withPerpDexsDedup = (info: HyperliquidInfoClient): Promise<Array<null | { name: string }>> =>
  withDedup("perpDexs", () => info.perpDexs?.() ?? Promise.resolve([]));

const fetchBaseSnapshot = (
  info: HyperliquidInfoClient,
  skipPerpDexs = false,
): Effect.Effect<[Array<null | { name: string }>, Record<string, string>]> =>
  Effect.all(
    [
      skipPerpDexs
        ? Effect.succeed([] as Array<null | { name: string }>)
        : Effect.tryPromise({
            try: () => withPerpDexsDedup(info),
            catch: (cause) => toHyperliquidError("Failed to fetch perp DEXs", cause),
          }).pipe(
            Effect.tapError((e) =>
              Effect.logWarning(
                `[mapping] perpDexs fetch failed, falling back to empty: ${String(e)}`,
              ),
            ),
            Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>)),
          ),
      fetchAllMidsWithRetry(info),
    ],
    { concurrency: 3 },
  );

const fetchMetaAndAssetCtxs = (
  info: HyperliquidInfoClient,
  dexName: string,
): Effect.Effect<[unknown, unknown]> =>
  Effect.tryPromise({
    try: () =>
      withDedup(`metaAndAssetCtxs:${dexName}`, () =>
        info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined),
      ),
    catch: (cause) => toHyperliquidError(`Failed to fetch meta for ${dexName || "main"}`, cause),
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
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
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
): Effect.Effect<TickerSnapshot, HyperliquidError> => fetchTickerSnapshot(info, key);

export const getTickerSnapshot = (
  info: HyperliquidInfoClient,
  symbol?: string,
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  fetchTickerSnapshot(info, tickerSnapshotCacheKey(symbol));
