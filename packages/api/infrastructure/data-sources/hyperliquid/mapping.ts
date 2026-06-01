import { Deferred, Effect, Ref, Schedule } from "effect";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import type { TickerSnapshot, HyperliquidAggregatedAsset, PerpTradeAsset } from "./types";
import {
  extractSpotTokens,
  processMetaResults,
  parsePerpAssets,
  parseSpotAssets,
  sortAndDedupeAssets,
} from "./mapping.pure";

export type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
  readonly perpDexs?: () => Promise<Array<null | { name: string }>>;
  readonly spotMeta?: () => Promise<unknown>;
  readonly spotMetaAndAssetCtxs?: () => Promise<unknown>;
};

// Rate-limited, deduplicated API call
const deduplicatedApiCall = <T>(
  key: string,
  call: () => Promise<T>,
  errorMessage: string
): Effect.Effect<T, HyperliquidError, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry> =>
  Effect.gen(function* () {
    const rateLimiter = yield* HyperliquidRateLimiter;
    const dedup = yield* HyperliquidDeduplicationRegistry;

    const registry = yield* Ref.get(dedup.registryRef);
    const existing = registry.get(key);
    if (existing) {
      return yield* Deferred.await(existing) as Effect.Effect<any, HyperliquidError>;
    }

    const deferred = yield* Deferred.make<T, HyperliquidError>();
    yield* Ref.update(dedup.registryRef, (map) => new Map(map).set(key, deferred));

    const apiCall = rateLimiter.semaphore.withPermits(1)(
      Effect.tryPromise({
        try: call,
        catch: (cause) =>
          new HyperliquidError({
            message: errorMessage,
            kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
            cause,
          }),
      }).pipe(
        Effect.retry({
          schedule: Schedule.exponential("1 second").pipe(Schedule.take(16)),
          while: (err) => err.kind === "RATE_LIMITED",
        })
      )
    );

    const result = yield* apiCall.pipe(
      Effect.tap((value) => Deferred.completeWith(deferred, Effect.succeed(value))),
      Effect.catch((error) =>
        Deferred.completeWith(deferred, Effect.fail(error)).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      ),
      Effect.ensuring(
        Ref.update(dedup.registryRef, (map) => {
          const newMap = new Map(map);
          newMap.delete(key);
          return newMap;
        })
      )
    );

    return result;
  });

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
          ).pipe(Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>))),
      deduplicatedApiCall("allMids", () => info.allMids(), "Failed to fetch mids").pipe(
        Effect.catch(() => Effect.succeed({} as Record<string, string>))
      ),
    ],
    { concurrency: 3 }
  );

export const getTickerSnapshotEffect = (
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

// Fetch spot tokens from HL spotMeta
export function getSpotTokens(
  info: HyperliquidInfoClient
): Effect.Effect<
  string[],
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> {
  return deduplicatedApiCall(
    "spotMeta",
    async () => {
      if (typeof info.spotMeta !== "function") return [];
      const raw = await info.spotMeta();
      return extractSpotTokens(raw);
    },
    "Failed to fetch spot meta"
  ).pipe(Effect.catch(() => Effect.succeed([] as string[])));
}

// Fetch perp metadata for each DEX
const fetchAllDexMetas = (
  info: HyperliquidInfoClient,
  dexNames: string[]
): Effect.Effect<
  Array<unknown>,
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.forEach(
    dexNames,
    (dexName) =>
      deduplicatedApiCall(
        `metaAndAssetCtxs:${dexName || "main"}`,
        () =>
          info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined) as Promise<
            [unknown, unknown]
          >,
        `Failed to fetch meta for dex "${dexName || "main"}"`
      ).pipe(
        Effect.catch((err) => {
          if (dexName === "") {
            return Effect.fail(
              new HyperliquidError({
                message: `Main DEX meta fetch failed: ${err.message}`,
                kind: "UPSTREAM",
                cause: err,
              })
            );
          }
          return Effect.logWarning(`[Hyperliquid] Skipping dex "${dexName}": ${err.message}`).pipe(
            Effect.as(null)
          );
        })
      ),
    { concurrency: 3 }
  );

// Fetch optional spot data with graceful fallback
const fetchOptionalData = (
  info: HyperliquidInfoClient,
  preFetchedSpot: unknown | undefined
): Effect.Effect<
  { spotRaw: unknown },
  never,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.all({
    spotRaw:
      preFetchedSpot !== undefined
        ? Effect.succeed(preFetchedSpot)
        : deduplicatedApiCall(
            "spotMetaAndAssetCtxs",
            () => (info.spotMetaAndAssetCtxs?.() ?? Promise.resolve(null)) as Promise<unknown>,
            "Failed to fetch spot meta and asset ctxs"
          ).pipe(Effect.catch(() => Effect.succeed(null))),
  });

// Parallel market aggregator: fetch → parse → deduplicate
export function getAggregatedMarketsSnapshot(
  info: HyperliquidInfoClient,
  options?: {
    spotTokens?: string[];
    spotMetaAndAssetCtxs?: unknown;
  }
): Effect.Effect<
  readonly HyperliquidAggregatedAsset[],
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> {
  return Effect.gen(function* () {
    const { spotTokens: preFetchedTokens, spotMetaAndAssetCtxs: preFetchedSpot } = options ?? {};

    const resolvedTokens =
      preFetchedTokens !== undefined ? preFetchedTokens : yield* getSpotTokens(info);

    const allResult = yield* Effect.all(
      {
        dexNamesResult: deduplicatedApiCall(
          "perpDexs",
          () => info.perpDexs?.() ?? Promise.resolve([]),
          "Failed to fetch perp DEXs"
        ).pipe(Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>))),

        rawPerpCats: deduplicatedApiCall(
          "perpCategories",
          () =>
            (info.perpCategories?.() ?? Promise.resolve([])) as Promise<Array<[string, string]>>,
          "Failed to fetch categories"
        ).pipe(Effect.catch(() => Effect.succeed([] as Array<[string, string]>))),

        allMids: deduplicatedApiCall("allMids", () => info.allMids(), "Failed to fetch mids").pipe(
          Effect.catch(() => Effect.succeed({} as Record<string, string>))
        ),

        optionalData: fetchOptionalData(info, preFetchedSpot),
      },
      { concurrency: 3 }
    );

    const { dexNamesResult, rawPerpCats, allMids, optionalData } = allResult;
    const { spotRaw } = optionalData;

    const dexNamesRaw: ReadonlyArray<null | { readonly name: string }> = dexNamesResult ?? [];
    const dexNames = [
      "",
      ...dexNamesRaw.filter((d): d is { readonly name: string } => d !== null).map((d) => d.name),
    ];

    const categoryMap = new Map<string, string>();
    for (const [coin, cat] of rawPerpCats) {
      categoryMap.set(normalizeSymbol(coin), cat);
    }

    const rawMetas = yield* fetchAllDexMetas(info, dexNames);

    let globalIndex = 0;
    const perpAssets: PerpTradeAsset[] = [];

    for (let dexIdx = 0; dexIdx < dexNames.length; dexIdx++) {
      const [parsed, nextIndex] = parsePerpAssets(
        dexNames[dexIdx],
        dexIdx,
        rawMetas[dexIdx],
        allMids,
        categoryMap,
        resolvedTokens,
        globalIndex
      );
      perpAssets.push(...parsed);
      globalIndex = nextIndex;
    }

    const spotAssets = spotRaw ? parseSpotAssets(spotRaw, allMids, globalIndex) : [];

    return sortAndDedupeAssets(perpAssets, spotAssets);
  });
}
