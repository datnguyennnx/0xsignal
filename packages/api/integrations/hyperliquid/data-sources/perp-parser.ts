import {
  asRecord,
  isUnknownArray,
  stringAt,
} from "../../../infrastructure/data-sources/parse-utils";
import { normalizeSymbol } from "./symbol";
import type { PerpTradeAsset } from "./types";

interface DexMetaResult {
  readonly meta: {
    readonly universe: ReadonlyArray<Record<string, unknown>>;
    readonly collateralToken?: number | undefined;
  };
  readonly assetCtxs: ReadonlyArray<Record<string, unknown>>;
}

const toRecords = (values: readonly unknown[]): Record<string, unknown>[] =>
  values.map((value) => asRecord(value) ?? {});

function extractDexMetaResult(raw: unknown): DexMetaResult | null {
  if (!isUnknownArray(raw) || raw.length < 2) return null;
  const meta = asRecord(raw[0]);
  if (meta === null || !isUnknownArray(meta.universe)) return null;
  const ctxs = raw[1];
  return {
    meta: {
      universe: toRecords(meta.universe),
      collateralToken: typeof meta.collateralToken === "number" ? meta.collateralToken : undefined,
    },
    assetCtxs: isUnknownArray(ctxs) ? toRecords(ctxs) : [],
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
  assetCtxs: ReadonlyArray<Record<string, unknown>>,
  allMids: Record<string, string>,
  categoryMap: ReadonlyMap<string, string>,
  quoteCurrency: string,
  globalIndex: number,
): PerpTradeAsset | null => {
  const rawName = typeof market.name === "string" ? market.name : "";
  if (rawName === "") return null;

  const coin = normalizeCoinName(rawName);
  const isDelisted = market.isDelisted === true;
  const szDecimals = typeof market.szDecimals === "number" ? market.szDecimals : 4;
  const maxLeverage = typeof market.maxLeverage === "number" ? market.maxLeverage : 10;

  const assetId = isMainDex ? globalIndex : 100000 + dexIdx * 10000 + i;
  const rawCoin = dexPrefix === null ? coin : `${dexPrefix}:${coin}`;

  const category =
    categoryMap.get(normalizeSymbol(rawCoin)) ??
    categoryMap.get(normalizeSymbol(rawName)) ??
    categoryMap.get(normalizeSymbol(coin)) ??
    "crypto";
  const displayCategory = getDisplayCategory(category);

  const ctx = assetCtxs[i] ?? {};
  const markPx =
    allMids[rawCoin] ?? allMids[rawName] ?? allMids[coin] ?? stringAt(ctx, "markPx") ?? "0";
  const prevDayPx = stringAt(ctx, "prevDayPx") ?? "0";
  const openInterest = stringAt(ctx, "openInterest") ?? "0";
  const funding = stringAt(ctx, "funding") ?? "0";
  const dayNtlVlm = stringAt(ctx, "dayNtlVlm") ?? "0";

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
