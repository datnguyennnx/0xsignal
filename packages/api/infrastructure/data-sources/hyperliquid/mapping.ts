import { Deferred, Effect, Ref, Schedule } from "effect";
import { normalizeSymbol, parseSymbol } from "./symbol";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import type {
  MarketUniverseItem,
  MarketAssetCtxItem,
  TickerPayload,
  TickerSnapshot,
  AggregatedTradeAsset,
  PerpTradeAsset,
  SpotTradeAsset,
  OutcomeTradeAsset,
} from "./types";

export type HyperliquidInfoClient = {
  readonly metaAndAssetCtxs: (params?: { dex?: string }) => Promise<[unknown, unknown]>;
  readonly allMids: () => Promise<Record<string, string>>;
  readonly perpCategories?: () => Promise<unknown>;
  readonly perpDexs?: () => Promise<Array<null | { name: string }>>;
  readonly spotMeta?: () => Promise<unknown>;
  readonly spotMetaAndAssetCtxs?: () => Promise<unknown>;
  readonly outcomeMeta?: () => unknown;
};

// ─── Rate-limited + deduplicated API call helper ───────────────────────────
//
//  1. Dedup check: if an in-flight request for `key` exists, await it.
//  2. Semaphore permit acquisition (bounded concurrency — 6 permits).
//  3. Effect.retry with exponential backoff for RATE_LIMITED errors only.
//  4. Deferred completion on success / failure so concurrent waiters resolve.
//  5. Registry cleanup in finalizer so a retry attempt creates a fresh call.

const deduplicatedApiCall = <T>(
  key: string,
  call: () => Promise<T>,
  errorMessage: string
): Effect.Effect<T, HyperliquidError, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry> =>
  Effect.gen(function* () {
    const rateLimiter = yield* HyperliquidRateLimiter;
    const dedup = yield* HyperliquidDeduplicationRegistry;

    // ── Check for in-flight request ─────────────────────────────────
    const registry = yield* Ref.get(dedup.registryRef);
    const existing = registry.get(key);
    if (existing) {
      return yield* Deferred.await(existing);
    }

    // ── Create Deferred (success = T, error = HyperliquidError) ─────
    const deferred = yield* Deferred.make<T, HyperliquidError>();
    yield* Ref.update(dedup.registryRef, (map) => new Map(map).set(key, deferred));

    // ── Rate-limited + retried API call ─────────────────────────────
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
          schedule: Schedule.exponential("1 second").pipe(Schedule.upTo("16 seconds")),
          while: (err) => err.kind === "RATE_LIMITED",
        })
      )
    );

    // Complete the Deferred on success, clean up registry in finalizer
    const result = yield* apiCall.pipe(
      Effect.tap((value) => Deferred.completeWith(deferred, Effect.succeed(value))),
      Effect.catchAll((error) =>
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

// ─── Base fetchers ────────────────────────────────────────────────────────

/** Extract token names from spotMeta response `tokens` array. */
export function extractSpotTokens(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const resp = raw as { tokens?: Array<{ name?: unknown; index?: unknown }> };
  if (!Array.isArray(resp.tokens)) return [];
  return resp.tokens.map((t) => (typeof t.name === "string" ? t.name : ""));
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fetchBaseSnapshot = (
  info: HyperliquidInfoClient
): Effect.Effect<
  [Array<null | { name: string }>, Record<string, string>],
  never,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.all(
    [
      deduplicatedApiCall(
        "perpDexs",
        () => info.perpDexs?.() ?? Promise.resolve([]),
        "Failed to fetch perp DEXs"
      ).pipe(Effect.catchAll(() => Effect.succeed([] as Array<null | { name: string }>))),
      deduplicatedApiCall("allMids", () => info.allMids(), "Failed to fetch mids").pipe(
        Effect.catchAll(() => Effect.succeed({} as Record<string, string>))
      ),
    ],
    { concurrency: 3 }
  );

const processMetaResults = (metaResults: [unknown, unknown][]) => {
  const flattenedUniverse: MarketUniverseItem[] = [];
  const flattenedAssetCtxs: MarketAssetCtxItem[] = [];

  metaResults.forEach((res, idx) => {
    if (!res || !Array.isArray(res)) return;
    const [meta, assetCtxs] = res;
    if (meta && typeof meta === "object" && "universe" in meta && Array.isArray(meta.universe)) {
      const universe = meta.universe as MarketUniverseItem[];
      flattenedUniverse.push(
        ...universe.map((item) => ({
          ...item,
          dexIndex: idx,
        }))
      );
    }
    if (Array.isArray(assetCtxs)) {
      flattenedAssetCtxs.push(...(assetCtxs as MarketAssetCtxItem[]));
    }
  });

  return { flattenedUniverse, flattenedAssetCtxs };
};

export const getTickerSnapshotEffect = (
  info: HyperliquidInfoClient
): Effect.Effect<
  TickerSnapshot,
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> =>
  Effect.gen(function* () {
    const [perpDexs, allMids] = yield* fetchBaseSnapshot(info);

    const dexNames = [
      "",
      ...(perpDexs?.filter((d: any) => d !== null).map((d: any) => d.name) || []),
    ];

    const metaResults = yield* Effect.all(
      dexNames.map((dex) =>
        deduplicatedApiCall(
          `metaAndAssetCtxs:${dex || "main"}`,
          () => info.metaAndAssetCtxs(dex ? { dex } : undefined) as Promise<[unknown, unknown]>,
          `Failed to fetch meta for ${dex || "main"}`
        ).pipe(Effect.catchAll(() => Effect.succeed([null, null] as [unknown, unknown])))
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

export const mapTickerFromSnapshot = (snapshot: TickerSnapshot, symbol: string): TickerPayload => {
  // Spot symbols not in perp universe. Use allMids price or zero.
  if (parseSymbol(symbol).kind === "spot") {
    const spotMid = snapshot.allMids[symbol];
    const midPx = toNumberOrNull(spotMid) ?? 0;
    return {
      symbol,
      mid: midPx,
      markPx: midPx,
      midPx: midPx,
      prevDayPx: 0,
      dayNtlVlm: 0,
      openInterest: 0,
      funding: 0,
    };
  }

  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    // Safe: mapTickerFromSnapshot is only called inside Effect.tryPromise callbacks
    throw new HyperliquidError({
      message: "Symbol is required",
      kind: "BAD_REQUEST",
    });
  }

  // Build lookup candidates:
  //   - DEX-prefixed "xyz:YEETI" → try "xyz:YEETI" and bare "YEETI"
  //   - Bare "BTC" → try "BTC" only
  const lookupSymbols = [symbol, normalizedSymbol];
  if (normalizedSymbol.includes(":")) {
    const bare = normalizedSymbol.split(":").slice(1).join(":");
    lookupSymbols.push(bare);
  }

  // Check Perps
  const marketIndex = snapshot.universe.findIndex(
    (item) =>
      lookupSymbols.includes(item.name) || lookupSymbols.includes(normalizeSymbol(item.name))
  );
  let ctx: MarketAssetCtxItem | undefined;

  if (marketIndex >= 0) {
    ctx = snapshot.assetCtxs[marketIndex];
  }

  const hasAllMidsSymbol = lookupSymbols.some((s) => typeof snapshot.allMids[s] === "string");

  if (!ctx && !hasAllMidsSymbol) {
    // Safe: mapTickerFromSnapshot is only called inside Effect.tryPromise callbacks
    throw new HyperliquidError({
      message: `Symbol not found: ${symbol}`,
      kind: "NOT_FOUND",
    });
  }

  const fallbackMid = lookupSymbols.reduce<string | undefined>(
    (found, s) => found ?? snapshot.allMids[s],
    undefined
  );
  const mid =
    toNumberOrNull(ctx?.midPx) ?? toNumberOrNull(ctx?.markPx) ?? toNumberOrNull(fallbackMid);

  return {
    symbol: normalizedSymbol,
    mid,
    markPx: toNumberOrNull(ctx?.markPx) ?? mid,
    midPx: toNumberOrNull(ctx?.midPx) ?? mid,
    prevDayPx: toNumberOrNull(ctx?.prevDayPx),
    dayNtlVlm: toNumberOrNull(ctx?.dayNtlVlm),
    openInterest: toNumberOrNull(ctx?.openInterest) ?? 0,
    funding: toNumberOrNull(ctx?.funding) ?? 0,
  };
};

export const isPerpSymbol = (snapshot: TickerSnapshot, symbol: string): boolean => {
  // Spot symbols are NEVER perps
  if (parseSymbol(symbol).kind === "spot") return false;

  const normalized = normalizeSymbol(symbol);
  const unprefixed = normalized.includes(":")
    ? normalized.split(":").slice(1).join(":")
    : undefined;

  return snapshot.universe.some(
    (u) =>
      u.name === symbol ||
      u.name === normalized ||
      normalizeSymbol(u.name) === normalized ||
      (unprefixed !== undefined &&
        (u.name === unprefixed || normalizeSymbol(u.name) === unprefixed))
  );
};

export const resolveInternalSymbol = (snapshot: TickerSnapshot, symbol: string): string => {
  // Spot symbols ("PURR/USDC") pass through — they are exact SDK identifiers.
  // normalizeSymbol now preserves them, but this early return avoids unnecessary
  // perp universe lookups for spot pairs.
  if (parseSymbol(symbol).kind === "spot") return symbol;

  const normalized = normalizeSymbol(symbol);

  // For builder perp prefixed names (e.g., "xyz:YEETI"), also try stripping the prefix
  // since the combined universe has bare names (e.g., "YEETI") from per-DEX metaAndAssetCtxs.
  const unprefixed = normalized.includes(":")
    ? normalized.split(":").slice(1).join(":")
    : undefined;

  // Check if it's already an internal perp name or builder perp
  const perp = snapshot.universe.find(
    (u) =>
      u.name === symbol ||
      u.name === normalized ||
      normalizeSymbol(u.name) === normalized ||
      (unprefixed !== undefined &&
        (u.name === unprefixed || normalizeSymbol(u.name) === unprefixed))
  );
  if (perp) return perp.name;

  return normalized;
};

// Symbol Helpers

/**
 * Strip HIP-3 prefix: "xyz:TSLA" → "TSLA", main dex "BTC" → "BTC"
 */
export function normalizeCoinName(rawName: string): string {
  if (rawName.includes(":")) {
    return rawName.split(":").slice(1).join(":");
  }
  return rawName;
}

/**
 * Resolve quote currency from spot meta tokens using collateralToken index.
 * Falls back to "USDC" if the index is invalid or spotTokens is empty.
 */
export function getQuoteCurrency(
  collateralToken: number | undefined,
  spotTokens: string[]
): string {
  if (
    typeof collateralToken === "number" &&
    collateralToken >= 0 &&
    collateralToken < spotTokens.length
  ) {
    const token = spotTokens[collateralToken];
    if (token && token.length > 0) return token;
  }
  return "USDC";
}

/**
 * Fetch spot tokens from Hyperliquid spotMeta API.
 * Gracefully returns [] if spotMeta is not available or fails.
 */
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
  ).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
}

const CATEGORY_DISPLAY: Record<string, string> = {
  crypto: "Crypto",
  stocks: "Stocks",
  forex: "Forex",
  commodities: "Commodities",
  indices: "Indices",
  preipo: "Pre-launch",
};

export function getDisplayCategory(category: string): string {
  return CATEGORY_DISPLAY[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Pure Parsers

// Per-DEX metaAndAssetCtxs result — avoids `as any` casts
interface DexMetaResult {
  readonly meta: {
    readonly universe: ReadonlyArray<Record<string, unknown>>;
    readonly collateralToken?: number;
  };
  readonly assetCtxs: ReadonlyArray<Record<string, string | undefined>>;
}

function extractDexMetaResult(raw: unknown): DexMetaResult | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [meta, assetCtxs] = raw;
  if (
    !meta ||
    typeof meta !== "object" ||
    meta === null ||
    !("universe" in meta) ||
    !Array.isArray((meta as Record<string, unknown>).universe)
  ) {
    return null;
  }
  return {
    meta: meta as DexMetaResult["meta"],
    assetCtxs: Array.isArray(assetCtxs) ? (assetCtxs as DexMetaResult["assetCtxs"]) : [],
  };
}

/**
 * Parse perp market data from a single DEX's metaAndAssetCtxs response.
 *
 * @param dexName — Empty string for main DEX, e.g. "xyz" for builder DEX.
 * @param dexIdx — Index in the dexNames array (for assetId generation).
 * @param rawResult — The raw [meta, assetCtxs] tuple.
 * @param allMids — All mids map from Hyperliquid (includes perp and spot entries).
 * @param categoryMap — Normalized coin → category mapping.
 * @param resolvedTokens — Spot token names for quote currency resolution.
 * @param startIndex — Starting global index for assetId generation.
 * @returns Tuple of [assets, nextGlobalIndex].
 */
export function parsePerpAssets(
  dexName: string,
  dexIdx: number,
  rawResult: unknown,
  allMids: Record<string, string>,
  categoryMap: ReadonlyMap<string, string>,
  resolvedTokens: string[],
  startIndex: number
): [PerpTradeAsset[], number] {
  const dex = extractDexMetaResult(rawResult);
  if (!dex) return [[], startIndex];

  const { meta, assetCtxs } = dex;
  const universe = meta.universe;
  const isMainDex = dexName === "";
  const dexPrefix = isMainDex ? null : dexName;
  const isHip3 = dexPrefix !== null;
  const quoteCurrency = getQuoteCurrency(meta.collateralToken, resolvedTokens);

  let globalIndex = startIndex;
  const assets: PerpTradeAsset[] = [];

  for (let i = 0; i < universe.length; i++) {
    const market = universe[i];
    const rawName = typeof market.name === "string" ? market.name : "";
    if (!rawName) continue;

    const coin = normalizeCoinName(rawName);
    const isDelisted = market.isDelisted === true;
    const szDecimals = typeof market.szDecimals === "number" ? market.szDecimals : 4;
    const maxLeverage = typeof market.maxLeverage === "number" ? market.maxLeverage : 10;

    // assetId: main dex = globalIndex, HIP-3 = 100000 + dexIndex * 10000 + i
    const assetId = isMainDex ? globalIndex : 100000 + dexIdx * 10000 + i;

    // Deterministic rawCoin: "BTC" for main, "xyz:YEETI" for builder
    const rawCoin = dexPrefix ? `${dexPrefix}:${coin}` : coin;

    // Category lookup with normalized fallbacks
    const category =
      categoryMap.get(normalizeSymbol(rawCoin)) ??
      categoryMap.get(normalizeSymbol(rawName)) ??
      categoryMap.get(normalizeSymbol(coin)) ??
      "crypto";
    const displayCategory = getDisplayCategory(category);

    // Pricing from assetCtxs with allMids fallback
    const ctx = assetCtxs[i] ?? {};
    const markPx = allMids[rawCoin] ?? allMids[rawName] ?? allMids[coin] ?? ctx.markPx ?? "0";
    const prevDayPx = ctx.prevDayPx ?? "0";
    const openInterest = ctx.openInterest ?? "0";
    const funding = ctx.funding ?? "0";
    const dayNtlVlm = ctx.dayNtlVlm ?? "0";

    assets.push({
      coin,
      rawCoin,
      displaySymbol: `${coin}-${quoteCurrency}`,
      dexPrefix,
      isHip3,
      quoteCurrency,
      name: rawName,
      markPx,
      prevDayPx,
      openInterest,
      funding,
      dayNtlVlm,
      category,
      displayCategory,
      maxLeverage,
      szDecimals,
      assetId,
      isDelisted,
      dex: "HYPERLIQUID",
      marketType: "perp",
    });

    globalIndex++;
  }

  return [assets, globalIndex];
}

/**
 * Parse spotMetaAndAssetCtxs response into SpotTradeAsset[].
 *
 * Filtering rules:
 *   - isCanonical === false → SKIP (unnamed aliases, legacy placeholders like "@1")
 *   - name.startsWith("@") → SKIP (Hyperliquid internal aliases)
 *   - All others (isCanonical === true, isCanonical === undefined, name is a real pair) → KEEP
 *
 * Returns [] if the response is invalid or spot data is unavailable.
 */
export function parseSpotAssets(
  raw: unknown,
  allMids: Record<string, string>,
  existingCount: number
): SpotTradeAsset[] {
  if (!Array.isArray(raw) || raw.length < 2) return [];

  const [meta, assetCtxs] = raw as [unknown, unknown];
  if (!meta || typeof meta !== "object") return [];

  const resp = meta as {
    universe?: ReadonlyArray<{
      tokens?: number[];
      name?: string;
      index?: number;
      isCanonical?: boolean;
    }>;
    tokens?: ReadonlyArray<{
      name?: string;
      szDecimals?: number;
      weiDecimals?: number;
      index?: number;
    }>;
  };

  if (!Array.isArray(resp.universe) || !Array.isArray(resp.tokens)) return [];

  const ctxs: ReadonlyArray<Record<string, unknown>> = Array.isArray(assetCtxs)
    ? (assetCtxs as Array<Record<string, unknown>>)
    : [];
  const assets: SpotTradeAsset[] = [];

  for (let i = 0; i < resp.universe.length; i++) {
    const entry = resp.universe[i];
    if (!entry || typeof entry.name !== "string") continue;

    // ── Filtering ────────────────────────────────────────────────────
    // isCanonical=false → unnamed alias or legacy pair → SKIP
    if (entry.isCanonical === false) continue;
    // name starting with "@" → Hyperliquid internal alias → SKIP
    if (entry.name.startsWith("@")) continue;

    // ── Token resolution ────────────────────────────────────────────
    const tokenIndices = entry.tokens ?? [];
    const baseTokenIdx: number | undefined = tokenIndices[0];
    const quoteTokenIdx: number | undefined = tokenIndices[1];

    const baseToken =
      typeof baseTokenIdx === "number" && baseTokenIdx >= 0 && baseTokenIdx < resp.tokens.length
        ? resp.tokens[baseTokenIdx]
        : null;
    const quoteToken =
      typeof quoteTokenIdx === "number" && quoteTokenIdx >= 0 && quoteTokenIdx < resp.tokens.length
        ? resp.tokens[quoteTokenIdx]
        : null;

    // Base token name is required — skip if missing
    const coin = baseToken?.name ?? null;
    if (!coin || coin.length === 0) continue;

    const quoteCurrency = quoteToken?.name ?? "USDC";
    const displaySymbol = `${coin}-${quoteCurrency}`;
    const ctx = ctxs[i] ?? {};

    // ── Pricing ─────────────────────────────────────────────────────
    // allMids[entry.name] = e.g. "PURR/USDC" — the canonical spot pair name
    const markPx = allMids[entry.name] ?? (typeof ctx.markPx === "string" ? ctx.markPx : "0");
    const prevDayPx = typeof ctx.prevDayPx === "string" ? ctx.prevDayPx : "0";
    const dayNtlVlm = typeof ctx.dayNtlVlm === "string" ? ctx.dayNtlVlm : "0";
    const dayBaseVlm = typeof ctx.dayBaseVlm === "string" ? ctx.dayBaseVlm : "0";
    const circulatingSupply =
      typeof ctx.circulatingSupply === "string" ? ctx.circulatingSupply : undefined;
    const totalSupply = typeof ctx.totalSupply === "string" ? ctx.totalSupply : undefined;
    const szDecimals = baseToken?.szDecimals ?? 4;

    assets.push({
      coin,
      rawCoin: `${coin}/${quoteCurrency}`,
      displaySymbol,
      dexPrefix: null,
      isHip3: false,
      quoteCurrency,
      name: entry.name,
      markPx,
      prevDayPx,
      dayNtlVlm,
      dayBaseVlm,
      circulatingSupply,
      totalSupply,
      category: "spot",
      displayCategory: "Spot",
      maxLeverage: 1,
      szDecimals,
      openInterest: "0",
      funding: "0",
      assetId: 200_000 + existingCount + i,
      isDelisted: false,
      dex: "HYPERLIQUID",
      marketType: "spot",
    });
  }

  return assets;
}

/**
 * Parse outcomeMeta response into OutcomeTradeAsset[].
 * Returns [] if the response is invalid.
 * Note: Real pricing for outcome markets requires additional investigation.
 */
export function parseOutcomeAssets(raw: unknown, existingCount: number): OutcomeTradeAsset[] {
  if (!raw || typeof raw !== "object") return [];

  const resp = raw as {
    outcomes?: ReadonlyArray<{ outcome?: number; name?: string; description?: string }>;
    questions?: ReadonlyArray<{ question?: number; name?: string; description?: string }>;
  };

  if (!Array.isArray(resp.outcomes) || !Array.isArray(resp.questions)) return [];

  const assets: OutcomeTradeAsset[] = [];

  for (const q of resp.questions) {
    const questionName = q.name ?? `question-${q.question}`;
    if (!questionName) continue;

    assets.push({
      coin: questionName,
      rawCoin: questionName,
      displaySymbol: questionName,
      dexPrefix: null,
      isHip3: false,
      quoteCurrency: "USDC",
      name: q.description ?? questionName,
      category: "outcome",
      displayCategory: "Outcome",
      assetId: 300_000 + existingCount + assets.length,
      isDelisted: false,
      dex: "HYPERLIQUID",
      marketType: "outcome",
      // Outcome markets have no real pricing yet
      markPx: "0",
      prevDayPx: "0",
      dayNtlVlm: "0",
      maxLeverage: 1,
      szDecimals: 0,
      openInterest: "0",
      funding: "0",
    });
  }

  return assets;
}

// Deduplication & Sorting

const MARKET_TYPE_ORDER: Record<string, number> = { perp: 0, spot: 1, outcome: 2 };

/**
 * Sort and deduplicate aggregated assets.
 * Order: perps first, then spot, then outcome. Delisted last.
 * Within same marketType: sorted by dayNtlVlm descending.
 * Dedup: within same rawCoin+marketType, prefer main dex (dexPrefix === null),
 * then higher volume.
 */
export function sortAndDedupeAssets(
  perpAssets: PerpTradeAsset[],
  spotAssets: SpotTradeAsset[],
  outcomeAssets: OutcomeTradeAsset[]
): AggregatedTradeAsset[] {
  const combined: AggregatedTradeAsset[] = [...perpAssets, ...spotAssets, ...outcomeAssets];

  // Sort
  const sorted = [...combined].sort((a, b) => {
    if (a.isDelisted !== b.isDelisted) return a.isDelisted ? 1 : -1;
    const typeDiff =
      (MARKET_TYPE_ORDER[a.marketType] ?? 99) - (MARKET_TYPE_ORDER[b.marketType] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return Number(b.dayNtlVlm) - Number(a.dayNtlVlm);
  });

  // Dedup by rawCoin + marketType
  const seen = new Map<string, AggregatedTradeAsset>();
  for (const asset of sorted) {
    const key = `${asset.rawCoin}-${asset.marketType}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, asset);
    } else {
      // Prefer main dex, then higher volume
      if (existing.dexPrefix !== null && asset.dexPrefix === null) {
        seen.set(key, asset);
      } else if (
        existing.dexPrefix !== null &&
        asset.dexPrefix !== null &&
        Number(asset.dayNtlVlm) > Number(existing.dayNtlVlm)
      ) {
        seen.set(key, asset);
      }
    }
  }

  return Array.from(seen.values());
}

// Pipeline Orchestrator

/**
 * Fetch perp metaAndAssetCtxs for each DEX with bounded concurrency.
 *
 * - Main DEX (dexName === ""): failure is FATAL — we cannot operate without it.
 *   Returns `Effect.fail` to halt the entire pipeline.
 * - Builder DEXes (dexName !== ""): failure is SKIPPED — individual DEX outages
 *   should not block the rest of the market list.
 *
 * Concurrency is bounded to 3 to avoid Hyperliquid API rate-limiting when
 * there are many builder DEXs (10+ simultaneous requests cause timeouts).
 */
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
        Effect.catchAll((err) => {
          // Main DEX failure is fatal — all perp data comes from it
          if (dexName === "") {
            return Effect.fail(
              new HyperliquidError({
                message: `Main DEX meta fetch failed: ${err.message}`,
                kind: "UPSTREAM",
                cause: err,
              })
            );
          }
          // Builder DEX failures are non-fatal — skip and warn
          return Effect.logWarning(`[Hyperliquid] Skipping dex "${dexName}": ${err.message}`).pipe(
            Effect.as(null)
          );
        })
      ),
    { concurrency: 3 }
  );

/**
 * Fetch optional data sources (spot, outcome) with graceful fallback.
 */
const fetchOptionalData = (
  info: HyperliquidInfoClient,
  preFetchedSpot: unknown | undefined,
  preFetchedOutcome: unknown | undefined
): Effect.Effect<
  { spotRaw: unknown; outcomeRaw: unknown },
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
          ).pipe(Effect.catchAll(() => Effect.succeed(null))),
    outcomeRaw:
      preFetchedOutcome !== undefined
        ? Effect.succeed(preFetchedOutcome)
        : deduplicatedApiCall(
            "outcomeMeta",
            () => (info.outcomeMeta?.() ?? Promise.resolve(null)) as Promise<unknown>,
            "Failed to fetch outcome meta"
          ).pipe(Effect.catchAll(() => Effect.succeed(null))),
  });

/**
 * Parallel aggregator that orchestrates fetching → parsing → deduplication.
 *
 * Fetches perp DEXs, categories, spot, and outcome data in parallel where possible,
 * then parses each market type separately, and finally sorts + deduplicates.
 *
 * @param info — HyperliquidInfoClient for upstream HTTP calls.
 * @param options — Pre-fetched cached data to avoid redundant HTTP calls.
 */
export function getAggregatedMarketsSnapshot(
  info: HyperliquidInfoClient,
  options?: {
    spotTokens?: string[];
    spotMetaAndAssetCtxs?: unknown;
    outcomeMeta?: unknown;
  }
): Effect.Effect<
  readonly AggregatedTradeAsset[],
  HyperliquidError,
  HyperliquidRateLimiter | HyperliquidDeduplicationRegistry
> {
  return Effect.gen(function* () {
    const {
      spotTokens: preFetchedTokens,
      spotMetaAndAssetCtxs: preFetchedSpot,
      outcomeMeta: preFetchedOutcome,
    } = options ?? {};

    // Resolve base dependencies
    const resolvedTokens =
      preFetchedTokens !== undefined ? preFetchedTokens : yield* getSpotTokens(info);

    // Fetch perp base data + optional data in parallel
    const allResult = yield* Effect.all(
      {
        dexNamesResult: deduplicatedApiCall(
          "perpDexs",
          () => info.perpDexs?.() ?? Promise.resolve([]),
          "Failed to fetch perp DEXs"
        ).pipe(Effect.catchAll(() => Effect.succeed([] as Array<null | { name: string }>))),

        rawPerpCats: deduplicatedApiCall(
          "perpCategories",
          () =>
            (info.perpCategories?.() ?? Promise.resolve([])) as Promise<Array<[string, string]>>,
          "Failed to fetch categories"
        ).pipe(Effect.catchAll(() => Effect.succeed([] as Array<[string, string]>))),

        allMids: deduplicatedApiCall("allMids", () => info.allMids(), "Failed to fetch mids").pipe(
          Effect.catchAll(() => Effect.succeed({} as Record<string, string>))
        ),

        optionalData: fetchOptionalData(info, preFetchedSpot, preFetchedOutcome),
      },
      { concurrency: 3 }
    );

    const { dexNamesResult, rawPerpCats, allMids, optionalData } = allResult;
    const { spotRaw, outcomeRaw } = optionalData;

    // Build DEX list
    const dexNamesRaw: ReadonlyArray<null | { readonly name: string }> = dexNamesResult ?? [];
    const dexNames = [
      "",
      ...dexNamesRaw.filter((d): d is { readonly name: string } => d !== null).map((d) => d.name),
    ];

    // Build category map
    const categoryMap = new Map<string, string>();
    for (const [coin, cat] of rawPerpCats) {
      categoryMap.set(normalizeSymbol(coin), cat);
    }

    // Fetch per-DEX meta in parallel
    const rawMetas = yield* fetchAllDexMetas(info, dexNames);

    // Parse perps
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

    // Parse spot & outcome
    const spotAssets = spotRaw ? parseSpotAssets(spotRaw, allMids, globalIndex) : [];

    const outcomeAssets = outcomeRaw
      ? parseOutcomeAssets(outcomeRaw, globalIndex + spotAssets.length)
      : [];

    // Sort & deduplicate
    return sortAndDedupeAssets(perpAssets, spotAssets, outcomeAssets);
  });
}
