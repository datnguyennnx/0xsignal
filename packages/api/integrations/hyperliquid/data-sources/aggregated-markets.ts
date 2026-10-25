import { Effect, Schedule } from "effect";
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

function getSpotTokens(info: HyperliquidInfoClient): Effect.Effect<string[], HyperliquidError> {
  return Effect.tryPromise({
    try: async () => {
      if (typeof info.spotMeta !== "function") return [];
      const raw = await info.spotMeta();
      return extractSpotTokens(raw);
    },
    catch: (cause) => toHyperliquidError("Failed to fetch spot meta", cause),
  }).pipe(Effect.catch(() => Effect.succeed([] as string[])));
}

const fetchAllDexMetas = (
  info: HyperliquidInfoClient,
  dexNames: string[],
): Effect.Effect<Array<unknown>, HyperliquidError> =>
  Effect.forEach(
    dexNames,
    (dexName) =>
      Effect.tryPromise({
        try: () => info.metaAndAssetCtxs(dexName ? { dex: dexName } : undefined),
        catch: (cause) =>
          toHyperliquidError(`Failed to fetch meta for dex "${dexName || "main"}"`, cause),
      }).pipe(
        Effect.catch((err) => {
          if (dexName === "") {
            return Effect.fail(
              new HyperliquidError({
                message: `Main DEX meta fetch failed: ${err.message}`,
                kind: "UPSTREAM",
                cause: err,
              }),
            );
          }
          return Effect.logWarning(`[Hyperliquid] Skipping dex "${dexName}": ${err.message}`).pipe(
            Effect.as(null),
          );
        }),
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
): Effect.Effect<{ spotRaw: unknown }> =>
  Effect.all({
    spotRaw:
      preFetchedSpot === undefined
        ? Effect.tryPromise({
            try: () => info.spotMetaAndAssetCtxs?.() ?? Promise.resolve(null),
            catch: (cause) => toHyperliquidError("Failed to fetch spot meta and asset ctxs", cause),
          }).pipe(Effect.catch(() => Effect.succeed(null)))
        : Effect.succeed(preFetchedSpot),
  });

export function getAggregatedMarketsSnapshot(
  info: HyperliquidInfoClient,
  options?: {
    spotTokens?: string[];
    spotMetaAndAssetCtxs?: unknown;
  },
): Effect.Effect<readonly HyperliquidAggregatedAsset[], HyperliquidError> {
  return Effect.gen(function* () {
    const { spotTokens: preFetchedTokens, spotMetaAndAssetCtxs: preFetchedSpot } = options ?? {};

    const resolvedTokens = preFetchedTokens ?? (yield* getSpotTokens(info));

    const allResult = yield* Effect.all(
      {
        dexNamesResult: Effect.tryPromise({
          try: () => info.perpDexs?.() ?? Promise.resolve([]),
          catch: (cause) => toHyperliquidError("Failed to fetch perp DEXs", cause),
        }).pipe(Effect.catch(() => Effect.succeed([] as Array<null | { name: string }>))),

        rawPerpCats: Effect.tryPromise({
          try: () =>
            info.perpCategories === undefined
              ? Promise.resolve<Array<[string, string]>>([])
              : info.perpCategories(),
          catch: (cause) => toHyperliquidError("Failed to fetch categories", cause),
        }).pipe(Effect.catch(() => Effect.succeed<Array<[string, string]>>([]))),

        allMids: Effect.tryPromise({
          try: () => withDedup("allMids", () => info.allMids()),
          catch: (cause) => toHyperliquidError("Failed to fetch mids", cause),
        }).pipe(
          Effect.retry({
            times: 2,
            schedule: Schedule.exponential("1 seconds"),
            while: (err: HyperliquidError) => err.kind === "RATE_LIMITED",
          }),
          Effect.catch(() => Effect.succeed<Record<string, string>>({})),
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
