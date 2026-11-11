import { assetInfoFromSpotMeta, type AssetInfo } from "@0xsignal/sdk-hyperliquid/exchange";
import type { SpotMetaInfoResponse } from "@0xsignal/sdk-hyperliquid/info";
import { asRecord, isUnknownArray, stringAt } from "../../../shared/parsing";
import type { SpotPairRef, SpotTradeAsset } from "./types";

/** Maps each spot base token to the query name of the pair that owns it. */
export function extractSpotPairRefs(raw: unknown): SpotPairRef[] {
  const resp = asRecord(raw);
  if (resp === null || !isUnknownArray(resp.universe) || !isUnknownArray(resp.tokens)) return [];

  const tokens = resp.tokens.map((token) => asRecord(token) ?? {});
  const refs: SpotPairRef[] = [];

  for (const entry of resp.universe) {
    const record = asRecord(entry) ?? {};
    const queryName = record.name;
    const tokenIndices = record.tokens;
    if (typeof queryName !== "string") continue;
    if (!isUnknownArray(tokenIndices)) continue;

    const baseIndex = tokenIndices[0];
    if (typeof baseIndex !== "number" || baseIndex < 0 || baseIndex >= tokens.length) continue;

    const token = stringAt(tokens[baseIndex], "name");
    if (token === undefined || token === "") continue;
    refs.push({ token, queryName });
  }

  return refs;
}

const normalizeEvmContract = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return record === null ? undefined : stringAt(record, "address");
};

const isSpotMetaInfoResponse = (value: unknown): value is SpotMetaInfoResponse => {
  const record = asRecord(value);
  return record !== null && isUnknownArray(record.universe) && isUnknownArray(record.tokens);
};

export function parseSpotAssets(raw: unknown, allMids: Record<string, string>): SpotTradeAsset[] {
  if (!isUnknownArray(raw) || raw.length < 2) return [];

  const meta = raw[0];
  if (!isSpotMetaInfoResponse(meta)) return [];

  const ctxs = isUnknownArray(raw[1]) ? raw[1].map((ctx) => asRecord(ctx) ?? {}) : [];
  const assets: SpotTradeAsset[] = [];

  for (let i = 0; i < meta.universe.length; i++) {
    const entry = meta.universe[i];
    const entryName = entry.name;

    const [baseTokenIdx, quoteTokenIdx] = entry.tokens;
    const baseToken = meta.tokens.find((token) => token.index === baseTokenIdx);
    const quoteToken = meta.tokens.find((token) => token.index === quoteTokenIdx);

    if (baseToken === undefined) continue;
    const coin = baseToken.name;
    if (coin === "") continue;

    const quoteCurrency = quoteToken?.name ?? "USDC";
    const hasReadableName = entryName !== "" && !entryName.startsWith("@");
    const displaySymbol = hasReadableName ? entryName : `${coin}/${quoteCurrency}`;
    const ctx = ctxs[i] ?? {};

    let assetInfo: AssetInfo;
    try {
      assetInfo = assetInfoFromSpotMeta(meta, entryName);
    } catch {
      continue;
    }

    const markPx = allMids[entryName] ?? stringAt(ctx, "markPx") ?? "0";
    const prevDayPx = stringAt(ctx, "prevDayPx") ?? "0";
    const dayNtlVlm = stringAt(ctx, "dayNtlVlm") ?? "0";
    const dayBaseVlm = stringAt(ctx, "dayBaseVlm") ?? "0";
    const circulatingSupply = stringAt(ctx, "circulatingSupply");
    const totalSupply = stringAt(ctx, "totalSupply");
    const evmContract = normalizeEvmContract(baseToken.evmContract);

    assets.push({
      coin,
      rawCoin: `${coin}/${quoteCurrency}`,
      displaySymbol,
      dexPrefix: null,
      isHip3: false,
      quoteCurrency,
      name: entryName,
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
      szDecimals: assetInfo.szDecimals,
      openInterest: "0",
      funding: "0",
      assetId: assetInfo.assetId,
      isDelisted: false,
      dex: "HYPERLIQUID",
      marketType: "spot",
    });
  }

  return assets;
}
