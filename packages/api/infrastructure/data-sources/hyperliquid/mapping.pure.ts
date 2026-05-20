import { normalizeSymbol, parseSymbol } from "./symbol";
import { HyperliquidError } from "./errors";
import type {
  MarketUniverseItem,
  MarketAssetCtxItem,
  TickerPayload,
  TickerSnapshot,
  AggregatedTradeAsset,
  PerpTradeAsset,
  SpotTradeAsset,
} from "./types";

/** Extract token names from spotMeta response `tokens` array. */
export function extractSpotTokens(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const resp = raw as { tokens?: Array<{ name?: unknown; index?: unknown }> };
  if (!Array.isArray(resp.tokens)) return [];
  return resp.tokens.map((t) => (typeof t.name === "string" ? t.name : ""));
}

export const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const processMetaResults = (metaResults: [unknown, unknown][]) => {
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

export const mapTickerFromSnapshot = (snapshot: TickerSnapshot, symbol: string): TickerPayload => {
  // Spot symbols not in perp universe. Return mid price from allMids,
  // set prevDayPx/dayNtlVlm to null (unknown) rather than 0 (misleading).
  if (parseSymbol(symbol).kind === "spot") {
    const spotMid = snapshot.allMids[symbol];
    const midPx = toNumberOrNull(spotMid) ?? 0;
    return {
      symbol,
      mid: midPx,
      markPx: midPx,
      midPx: midPx,
      prevDayPx: null,
      dayNtlVlm: null,
      openInterest: 0,
      funding: 0,
    };
  }

  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
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
export interface DexMetaResult {
  readonly meta: {
    readonly universe: ReadonlyArray<Record<string, unknown>>;
    readonly collateralToken?: number;
  };
  readonly assetCtxs: ReadonlyArray<Record<string, string | undefined>>;
}

export function extractDexMetaResult(raw: unknown): DexMetaResult | null {
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

    const assetId = isMainDex ? globalIndex : 100000 + dexIdx * 10000 + i;
    const rawCoin = dexPrefix ? `${dexPrefix}:${coin}` : coin;

    const category =
      categoryMap.get(normalizeSymbol(rawCoin)) ??
      categoryMap.get(normalizeSymbol(rawName)) ??
      categoryMap.get(normalizeSymbol(coin)) ??
      "crypto";
    const displayCategory = getDisplayCategory(category);

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
      tokenId?: string;
      evmContract?: { address?: string; evm_extra_wei_decimals?: number } | null;
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

    const coin = baseToken?.name ?? null;
    if (!coin || coin.length === 0) continue;

    const quoteCurrency = quoteToken?.name ?? "USDC";
    const displaySymbol = `${coin}-${quoteCurrency}`;
    const ctx = ctxs[i] ?? {};

    const markPx = allMids[entry.name] ?? (typeof ctx.markPx === "string" ? ctx.markPx : "0");
    const prevDayPx = typeof ctx.prevDayPx === "string" ? ctx.prevDayPx : "0";
    const dayNtlVlm = typeof ctx.dayNtlVlm === "string" ? ctx.dayNtlVlm : "0";
    const dayBaseVlm = typeof ctx.dayBaseVlm === "string" ? ctx.dayBaseVlm : "0";
    // Skip pairs with zero trading volume — they are dead listings with no trades
    if (Number(dayNtlVlm) === 0) continue;
    const circulatingSupply =
      typeof ctx.circulatingSupply === "string" ? ctx.circulatingSupply : undefined;
    const totalSupply = typeof ctx.totalSupply === "string" ? ctx.totalSupply : undefined;
    const szDecimals = baseToken?.szDecimals ?? 4;
    const evmContract = baseToken?.tokenId ? baseToken.tokenId : undefined;

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
      evmContract,
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

const MARKET_TYPE_ORDER: Record<string, number> = { perp: 0, spot: 1 };

/**
 * Sort and deduplicate aggregated assets.
 */
export function sortAndDedupeAssets(
  perpAssets: PerpTradeAsset[],
  spotAssets: SpotTradeAsset[]
): AggregatedTradeAsset[] {
  const combined: AggregatedTradeAsset[] = [...perpAssets, ...spotAssets];

  const sorted = [...combined].sort((a, b) => {
    if (a.isDelisted !== b.isDelisted) return a.isDelisted ? 1 : -1;
    const typeDiff =
      (MARKET_TYPE_ORDER[a.marketType] ?? 99) - (MARKET_TYPE_ORDER[b.marketType] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    return Number(b.dayNtlVlm) - Number(a.dayNtlVlm);
  });

  const seen = new Map<string, AggregatedTradeAsset>();
  for (const asset of sorted) {
    const key = `${asset.rawCoin}-${asset.marketType}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, asset);
    } else {
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
