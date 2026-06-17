import type { SpotTradeAsset } from "./types";

export function parseSpotAssets(
  raw: unknown,
  allMids: Record<string, string>,
  existingCount: number,
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
