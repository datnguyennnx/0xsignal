import { asRecord, isUnknownArray, numberAt, stringAt } from "../../../shared/parsing";
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

export function parseSpotAssets(
  raw: unknown,
  allMids: Record<string, string>,
  existingCount: number,
): SpotTradeAsset[] {
  if (!isUnknownArray(raw) || raw.length < 2) return [];

  const meta = asRecord(raw[0]);
  if (meta === null || !isUnknownArray(meta.universe) || !isUnknownArray(meta.tokens)) return [];

  const universe = meta.universe.map((entry) => asRecord(entry) ?? {});
  const tokens = meta.tokens.map((token) => asRecord(token) ?? {});
  const ctxs = isUnknownArray(raw[1]) ? raw[1].map((ctx) => asRecord(ctx) ?? {}) : [];
  const assets: SpotTradeAsset[] = [];

  for (let i = 0; i < universe.length; i++) {
    const entry = universe[i];
    const entryName = entry.name;
    if (typeof entryName !== "string") continue;

    const tokenIndices = isUnknownArray(entry.tokens) ? entry.tokens : [];
    const baseTokenIdx = tokenIndices[0];
    const quoteTokenIdx = tokenIndices[1];

    const baseToken =
      typeof baseTokenIdx === "number" && baseTokenIdx >= 0 && baseTokenIdx < tokens.length
        ? tokens[baseTokenIdx]
        : undefined;
    const quoteToken =
      typeof quoteTokenIdx === "number" && quoteTokenIdx >= 0 && quoteTokenIdx < tokens.length
        ? tokens[quoteTokenIdx]
        : undefined;

    const coin = baseToken === undefined ? null : (stringAt(baseToken, "name") ?? null);
    if (coin === null || coin === "") continue;

    const quoteCurrency =
      quoteToken === undefined ? "USDC" : (stringAt(quoteToken, "name") ?? "USDC");
    const displaySymbol = `${coin}-${quoteCurrency}`;
    const ctx = ctxs[i] ?? {};

    const markPx = allMids[entryName] ?? stringAt(ctx, "markPx") ?? "0";
    const prevDayPx = stringAt(ctx, "prevDayPx") ?? "0";
    const dayNtlVlm = stringAt(ctx, "dayNtlVlm") ?? "0";
    const dayBaseVlm = stringAt(ctx, "dayBaseVlm") ?? "0";
    // Skip pairs with zero trading volume — they are dead listings with no trades
    if (Number(dayNtlVlm) === 0) continue;
    const circulatingSupply = stringAt(ctx, "circulatingSupply");
    const totalSupply = stringAt(ctx, "totalSupply");
    const szDecimals =
      (baseToken === undefined ? undefined : numberAt(baseToken, "szDecimals")) ?? 4;
    const tokenId = baseToken === undefined ? undefined : stringAt(baseToken, "tokenId");
    const evmContract = tokenId === "" ? undefined : tokenId;

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
