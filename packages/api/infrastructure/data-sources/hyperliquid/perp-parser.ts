import { normalizeSymbol } from "./symbol";
import type { PerpTradeAsset } from "./types";

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

function getQuoteCurrency(collateralToken: number | undefined, spotTokens: string[]): string {
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

function getDisplayCategory(category: string): string {
  return CATEGORY_DISPLAY[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function normalizeCoinName(rawName: string): string {
  if (rawName.includes(":")) return rawName.split(":").slice(1).join(":");
  return rawName;
}

// Build a single PerpTradeAsset from a universe entry at index i.
const buildPerpAsset = (
  market: Record<string, unknown>,
  i: number,
  dexIdx: number,
  isMainDex: boolean,
  dexPrefix: string | null,
  assetCtxs: ReadonlyArray<Record<string, string | undefined>>,
  allMids: Record<string, string>,
  categoryMap: ReadonlyMap<string, string>,
  quoteCurrency: string,
  globalIndex: number,
): PerpTradeAsset | null => {
  const rawName = typeof market.name === "string" ? market.name : "";
  if (!rawName) return null;

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

  return {
    coin,
    rawCoin,
    displaySymbol: `${coin}-${quoteCurrency}`,
    dexPrefix,
    isHip3: dexPrefix !== null,
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
  };
};

export function parsePerpAssets(
  dexName: string,
  dexIdx: number,
  rawResult: unknown,
  allMids: Record<string, string>,
  categoryMap: ReadonlyMap<string, string>,
  resolvedTokens: string[],
  startIndex: number,
): [PerpTradeAsset[], number] {
  const dex = extractDexMetaResult(rawResult);
  if (!dex) return [[], startIndex];

  const { meta, assetCtxs } = dex;
  const universe = meta.universe;
  const isMainDex = dexName === "";
  const dexPrefix = isMainDex ? null : dexName;
  const quoteCurrency = getQuoteCurrency(meta.collateralToken, resolvedTokens);

  let globalIndex = startIndex;
  const assets: PerpTradeAsset[] = [];

  for (let i = 0; i < universe.length; i++) {
    const asset = buildPerpAsset(
      universe[i],
      i,
      dexIdx,
      isMainDex,
      dexPrefix,
      assetCtxs,
      allMids,
      categoryMap,
      quoteCurrency,
      globalIndex,
    );
    if (asset === null) continue;
    assets.push(asset);
    globalIndex++;
  }

  return [assets, globalIndex];
}
