export type AssetKind = "perp" | "builderPerp";

export interface NormalizedAsset {
  kind: AssetKind;
  coin: string;
  dex?: string;
}

export function parseSymbol(symbol: string): NormalizedAsset {
  const trimmed = symbol.trim();

  const upper = trimmed.toUpperCase();

  // Helper to strip stablecoin suffixes
  const stripStables = (s: string) => s.replace(/[-_]?(USDT?|USDC?)$/, "");

  // Handle builder perps with colon (dex:COIN)
  if (trimmed.includes(":")) {
    const [dex, ...rest] = trimmed.split(":");
    const assetPart = stripStables(rest.join(":").toUpperCase());
    const normalizedCoin = `${dex.toLowerCase()}:${assetPart}`;
    return {
      kind: "builderPerp",
      coin: normalizedCoin,
      dex: dex.toLowerCase(),
    };
  }

  // Handle standard perps, prefixed perps, and outcome tokens
  // We want to keep hyphens, @, #, + but remove other noise
  let cleaned = stripStables(upper.replace(/[^A-Z0-9-@#+]/g, ""));

  return { kind: "perp", coin: cleaned };
}

export const normalizeSymbol = (symbol: string): string => parseSymbol(symbol).coin;
