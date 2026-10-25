import { Effect } from "effect";
import { normalizeSymbol } from "./symbol";
import { HyperliquidError, toHyperliquidError } from "./errors";
import {
  extractSpotTokens,
  parsePerpAssets,
  parseSpotAssets,
  sortAndDedupeAssets,
} from "./market-aggregation";
import type { HyperliquidAggregatedAsset, PerpTradeAsset, HyperliquidInfoClient } from "./types";
import { withDedup } from "./request-dedup";
import { acquireInfo, acquireUnlistedInfo, type HyperliquidRateLimiter } from "../rate-limit";

/** A refusal must surface: an exhausted budget is not a missing symbol or empty list. */
const isRateLimited = (error: HyperliquidError): boolean => error.kind === "RATE_LIMITED";

/** Degrade only failures that are safe to hide; a rate-limit refusal always propagates. */
const degradeUnlessRateLimited = <A, F, R>(
  effect: Effect.Effect<A, HyperliquidError, R>,
  fallback: F,
  shouldDegrade: (error: HyperliquidError) => boolean = () => true,
): Effect.Effect<A | F, HyperliquidError, R> =>
  effect.pipe(
    Effect.catch((error) =>
      shouldDegrade(error) && !isRateLimited(error) ? Effect.succeed(fallback) : Effect.fail(error),
    ),
  );

function getSpotTokens(
  info: HyperliquidInfoClient,
): Effect.Effect<string[], HyperliquidError, HyperliquidRateLimiter> {
  return degradeUnlessRateLimited(
    Effect.gen(function* () {
      yield* acquireInfo("spotMeta");
      return yield* Effect.tryPromise({
        try: async () => {
          if (typeof info.spotMeta !== "function") return [];
          const raw = await info.spotMeta();
          return extractSpotTokens(raw);
        },
        catch: (cause) => toHyperliquidError("Failed to fetch spot meta", cause),
      });
    }),
    [],
  );
}

const fetchAllDexMetas = (
  info: HyperliquidInfoClient,
  dexNames: string[],
): Effect.Effect<Array<unknown>, HyperliquidError, HyperliquidRateLimiter> =>
  Effect.forEach(
    dexNames,
    (dexName) =>
      degradeUnlessRateLimited(
        Effect.gen(function* () {
          yield* acquireInfo("metaAndAssetCtxs");
          return yield* Effect.tryPromise({
            try: () =>
              withDedup(`metaAndAssetCtxs:${dexName}`, () =>
                info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined),
              ),
            catch: (cause) =>
              toHyperliquidError(`Failed to fetch meta for dex "${dexName || "main"}"`, cause),
          });
        }).pipe(
          Effect.tapError((error) =>
            dexName !== "" && !isRateLimited(error)
              ? Effect.logWarning(`[Hyperliquid] Skipping dex "${dexName}": ${error.message}`)
              : Effect.void,
          ),
        ),
        null,
        // Only a builder dex may be skipped: other dexes still render, but a main-dex
        // failure must surface instead of reading as an empty market list.
        () => dexName !== "",
      ),
    { concurrency: 3 },
  );

const fetchDexNames = (
  dexNamesResult: ReadonlyArray<null | { readonly name: string }> | undefined,
): string[] => {
  const raw: ReadonlyArray<null | { readonly name: string }> = dexNamesResult ?? [];
  return ["", ...raw.filter((d): d is { readonly name: string } => d !== null).map((d) => d.name)];
};

const buildCategoryMap = (rawPerpCats: Array<[string, string]>): Map<string, string> => {
  const map = new Map<string, string>();
  for (const [coin, cat] of rawPerpCats) {
    map.set(normalizeSymbol(coin), cat);
  }
  return map;
};

const fetchOptionalData = (
  info: HyperliquidInfoClient,
  preFetchedSpot: unknown,
): Effect.Effect<{ spotRaw: unknown }, HyperliquidError, HyperliquidRateLimiter> =>
  Effect.all({
    spotRaw:
      preFetchedSpot === undefined
        ? degradeUnlessRateLimited(
            Effect.gen(function* () {
              yield* acquireInfo("spotMetaAndAssetCtxs");
              return yield* Effect.tryPromise({
                try: () => info.spotMetaAndAssetCtxs?.() ?? Promise.resolve(null),
                catch: (cause) =>
                  toHyperliquidError("Failed to fetch spot meta and asset ctxs", cause),
              });
            }),
            null,
          )
        : Effect.succeed(preFetchedSpot),
  });

export function getAggregatedMarketsSnapshot(
  info: HyperliquidInfoClient,
  options?: {
    spotTokens?: string[];
    spotMetaAndAssetCtxs?: unknown;
  },
): Effect.Effect<readonly HyperliquidAggregatedAsset[], HyperliquidError, HyperliquidRateLimiter> {
  return Effect.gen(function* () {
    const { spotTokens: preFetchedTokens, spotMetaAndAssetCtxs: preFetchedSpot } = options ?? {};

    const resolvedTokens = preFetchedTokens ?? (yield* getSpotTokens(info));

    const allResult = yield* Effect.all(
      {
        dexNamesResult: degradeUnlessRateLimited(
          Effect.gen(function* () {
            yield* acquireUnlistedInfo;
            return yield* Effect.tryPromise({
              try: () => info.perpDexs?.() ?? Promise.resolve([]),
              catch: (cause) => toHyperliquidError("Failed to fetch perp DEXs", cause),
            });
          }),
          [],
        ),

        rawPerpCats: degradeUnlessRateLimited(
          Effect.gen(function* () {
            yield* acquireUnlistedInfo;
            return yield* Effect.tryPromise({
              try: () =>
                info.perpCategories === undefined
                  ? Promise.resolve<Array<[string, string]>>([])
                  : info.perpCategories(),
              catch: (cause) => toHyperliquidError("Failed to fetch categories", cause),
            });
          }),
          [],
        ),

        allMids: degradeUnlessRateLimited(
          Effect.gen(function* () {
            yield* acquireInfo("allMids");
            return yield* Effect.tryPromise({
              try: () => withDedup("allMids", () => info.allMids()),
              catch: (cause) => toHyperliquidError("Failed to fetch mids", cause),
            });
          }).pipe(
            Effect.tapError((error: HyperliquidError) =>
              Effect.logWarning(`[markets] allMids fetch failed: ${error.message}`),
            ),
          ),
          {},
        ),

        optionalData: fetchOptionalData(info, preFetchedSpot),
      },
      { concurrency: 3 },
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
        globalIndex,
      );
      perpAssets.push(...parsed);
      globalIndex = nextIndex;
    }

    const spotAssets =
      spotRaw === null || spotRaw === undefined
        ? []
        : parseSpotAssets(spotRaw, allMids, globalIndex);

    return sortAndDedupeAssets(perpAssets, spotAssets);
  });
}
