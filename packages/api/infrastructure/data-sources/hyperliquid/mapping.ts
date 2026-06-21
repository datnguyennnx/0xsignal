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
export const toHyperliquidInfoClient = (info: InfoClient): HyperliquidInfoClient =>
  info as unknown as HyperliquidInfoClient;

export { getAggregatedMarketsSnapshot, getSpotTokens } from "./aggregated-markets";

const MIDS_RETRY_MAX = 3;
const MIDS_RETRY_BASE = Duration.seconds(1);

/**
 * Fetch allMids with in-flight dedup + exponential backoff on 429.
 */
const fetchAllMidsWithRetry = (
  info: HyperliquidInfoClient,
): Effect.Effect<Record<string, string>, never> =>
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
    Effect.catch(() => Effect.succeed({} as Record<string, string>)),
  );

const fetchBaseSnapshot = (
  info: HyperliquidInfoClient,
  skipPerpDexs = false,
): Effect.Effect<[Array<null | { name: string }>, Record<string, string>], never> =>
  Effect.all(
    [
      skipPerpDexs
        ? Effect.succeed([] as Array<null | { name: string }>)
        : Effect.tryPromise({
            try: () => info.perpDexs?.() ?? Promise.resolve([]),
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

export const getTickerSnapshot = (
  info: HyperliquidInfoClient,
  symbol?: string,
): Effect.Effect<TickerSnapshot, HyperliquidError> =>
  Effect.gen(function* () {
    const skipPerpDexs = symbol !== undefined;
    const [perpDexs, allMids] = yield* fetchBaseSnapshot(info, skipPerpDexs);

    let dex = "";
    if (symbol) {
      const normalized = normalizeSymbol(symbol);
      if (normalized.includes(":")) {
        dex = normalized.split(":")[0].toLowerCase();
      }
    }

    const dexNames = symbol
      ? [dex]
      : [
          "",
          ...(perpDexs?.filter((d): d is { name: string } => d !== null).map((d) => d.name) || []),
        ];

    const metaResults = yield* Effect.all(
      dexNames.map((dexName) =>
        Effect.tryPromise({
          try: () =>
            info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined) as Promise<
              [unknown, unknown]
            >,
          catch: (cause) =>
            toHyperliquidError(`Failed to fetch meta for ${dexName || "main"}`, cause),
        }).pipe(Effect.catch(() => Effect.succeed([null, null] as [unknown, unknown]))),
      ),
      { concurrency: 3 },
    );

    const { flattenedUniverse, flattenedAssetCtxs } = processMetaResults(
      metaResults as [unknown, unknown][],
    );

    return {
      universe: flattenedUniverse,
      assetCtxs: flattenedAssetCtxs,
      allMids,
    };
  });
