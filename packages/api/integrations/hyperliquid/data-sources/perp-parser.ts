import { assetInfoFromMeta } from "@0xsignal/sdk-hyperliquid/exchange";
import type { MetaInfoResponse } from "@0xsignal/sdk-hyperliquid/info";
import { asRecord, isUnknownArray, numberAt, stringAt } from "../../../shared/parsing";
import { normalizeSymbol } from "./symbol";
import type { PerpTradeAsset } from "./types";

interface DexMetaResult {
  readonly meta: MetaInfoResponse;
  readonly assetCtxs: ReadonlyArray<Record<string, unknown>>;
  readonly collateralToken: number | undefined;
}

const toRecords = (values: readonly unknown[]): Record<string, unknown>[] =>
  values.map((value) => asRecord(value) ?? {});

const isMetaInfoResponse = (value: unknown): value is MetaInfoResponse => {
  const record = asRecord(value);
  return record !== null && isUnknownArray(record.universe);
};

function extractDexMetaResult(raw: unknown): DexMetaResult | null {
  if (!isUnknownArray(raw) || raw.length < 2) return null;
  const meta = raw[0];
  if (!isMetaInfoResponse(meta)) return null;
  const ctxs = raw[1];
  return {
    meta,
    assetCtxs: isUnknownArray(ctxs) ? toRecords(ctxs) : [],
    collateralToken: numberAt(asRecord(meta) ?? {}, "collateralToken"),
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

const buildPerpAsset = (
  meta: MetaInfoResponse,
  market: MetaInfoResponse["universe"][number],
  i: number,
  dexIdx: number,
  dexPrefix: string | null,
  assetCtxs: ReadonlyArray<Record<string, unknown>>,
  categoryMap: ReadonlyMap<string, string>,
  quoteCurrency: string,
): PerpTradeAsset | null => {
  const rawName = market.name;
  if (rawName === "") return null;

  const coin = normalizeCoinName(rawName);
  const isDelisted = market.isDelisted === true;
  const assetInfo =
    dexPrefix === null
      ? assetInfoFromMeta(meta, rawName)
      : assetInfoFromMeta(meta, rawName, { dex: dexPrefix, dexIndex: dexIdx });
  const rawCoin = dexPrefix === null ? coin : `${dexPrefix}:${coin}`;

  const category =
    categoryMap.get(normalizeSymbol(rawCoin)) ??
    categoryMap.get(normalizeSymbol(rawName)) ??
    categoryMap.get(normalizeSymbol(coin)) ??
    "";
  const displayCategory = getDisplayCategory(category);

  const ctx = assetCtxs[i] ?? {};
  const markPx = stringAt(ctx, "markPx") ?? "0";
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
    maxLeverage: market.maxLeverage,
    szDecimals: assetInfo.szDecimals,
    assetId: assetInfo.assetId,
    isDelisted,
    dex: "HYPERLIQUID",
    marketType: "perp",
  };
};

export function parsePerpAssets(
  dexName: string,
  dexIdx: number,
  rawResult: unknown,
  _allMids: Record<string, string>,
  categoryMap: ReadonlyMap<string, string>,
  resolvedTokens: string[],
): PerpTradeAsset[] {
  const dex = extractDexMetaResult(rawResult);
  if (!dex) return [];

  const { meta, assetCtxs, collateralToken } = dex;
  const universe = meta.universe;
  const dexPrefix = dexName === "" ? null : dexName;
  const quoteCurrency = getQuoteCurrency(collateralToken, resolvedTokens);

  const assets: PerpTradeAsset[] = [];

  for (let i = 0; i < universe.length; i++) {
    const asset = buildPerpAsset(
      meta,
      universe[i],
      i,
      dexIdx,
      dexPrefix,
      assetCtxs,
      categoryMap,
      quoteCurrency,
    );
    if (asset === null) continue;
    assets.push(asset);
  }

  return assets;
}
