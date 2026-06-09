import { Effect } from "effect";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import { deduplicatedApiCall } from "./dedup-call";
import {
  extractSpotTokens,
  parsePerpAssets,
  parseSpotAssets,
  sortAndDedupeAssets,
} from "./mapping.pure";
import type { HyperliquidAggregatedAsset, PerpTradeAsset } from "./types";
export type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
  readonly perpDexs?: () => Promise<Array<null | { name: string }>>;
  readonly spotMeta?: () => Promise<unknown>;
  readonly spotMetaAndAssetCtxs?: () => Promise<unknown>;
};

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

// Extract DEX names from raw perpDexs result, prepending the main (empty) DEX.
const fetchDexNames = (
  dexNamesResult: ReadonlyArray<null | { readonly name: string }> | undefined
): string[] => {
  const raw: ReadonlyArray<null | { readonly name: string }> = dexNamesResult ?? [];
  return ["", ...raw.filter((d): d is { readonly name: string } => d !== null).map((d) => d.name)];
};

// Build a category map from raw perpCategories pairs.
const buildCategoryMap = (rawPerpCats: Array<[string, string]>): Map<string, string> => {
  const map = new Map<string, string>();
  for (const [coin, cat] of rawPerpCats) {
    map.set(normalizeSymbol(coin), cat);
  }
  return map;
};

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

    const dexNames = fetchDexNames(dexNamesResult);
    const categoryMap = buildCategoryMap(rawPerpCats);

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
