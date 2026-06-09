import { Effect } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import { deduplicatedApiCall } from "./dedup-call";
import { processMetaResults } from "./market-aggregation";
import type { TickerSnapshot } from "./types";
import type { HyperliquidInfoClient } from "./types";

/**
 * Narrow an InfoClient (from @nktkas/hyperliquid) to HyperliquidInfoClient.
 *
 * The InfoClient type from the library has a larger interface, but the subset of
 * methods used by the mapping layer matches HyperliquidInfoClient structurally.
 * A cast is required here because TypeScript cannot verify the compatibility
 * between the external library's type definition and our local interface.
 */
export const toHyperliquidInfoClient = (info: InfoClient): HyperliquidInfoClient =>
  info as HyperliquidInfoClient;

export { getAggregatedMarketsSnapshot, getSpotTokens } from "./aggregated-markets";

const fetchBaseSnapshot = (
  info: HyperliquidInfoClient,
  skipPerpDexs = false
): Effect.Effect<
  [Array<null | { name: string }>, Record<string, string>],
  never,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.all(
    [
      skipPerpDexs
        ? Effect.succeed([] as Array<null | { name: string }>)
        : deduplicatedApiCall(
            "perpDexs",
            () => info.perpDexs?.() ?? Promise.resolve([]),
            "Failed to fetch perp DEXs"
          ).pipe(
            Effect.tapError((e) =>
              Effect.logWarning(
                `[mapping] perpDexs fetch failed, falling back to empty: ${String(e)}`
              )
            ),
            Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>))
          ),
      deduplicatedApiCall("allMids", () => info.allMids(), "Failed to fetch mids").pipe(
        Effect.tapError((e) =>
          Effect.logWarning(`[mapping] allMids fetch failed, falling back to empty: ${String(e)}`)
        ),
        Effect.catch(() => Effect.succeed({} as Record<string, string>))
      ),
    ],
    { concurrency: 3 }
  );

export const getTickerSnapshot = (
  info: HyperliquidInfoClient,
  symbol?: string
): Effect.Effect<
  TickerSnapshot,
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
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
      : ["", ...(perpDexs?.filter((d: any) => d !== null).map((d: any) => d.name) || [])];

    const metaResults = yield* Effect.all(
      dexNames.map((dexName) =>
        deduplicatedApiCall(
          `metaAndAssetCtxs:${dexName || "main"}`,
          () =>
            info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined) as Promise<
              [unknown, unknown]
            >,
          `Failed to fetch meta for ${dexName || "main"}`
        ).pipe(Effect.catch(() => Effect.succeed([null, null] as [unknown, unknown])))
      ),
      { concurrency: 3 }
    );

    const { flattenedUniverse, flattenedAssetCtxs } = processMetaResults(
      metaResults as [unknown, unknown][]
    );

    return {
      universe: flattenedUniverse,
      assetCtxs: flattenedAssetCtxs,
      allMids,
    };
  });
