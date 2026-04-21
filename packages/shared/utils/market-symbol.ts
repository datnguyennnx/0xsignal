export type AssetKind = "perp" | "builderPerp" | "spot";

export interface NormalizedAsset {
  kind: AssetKind;
  coin: string;
  dex?: string;
}

export function parseSymbol(symbol: string): NormalizedAsset {
  const trimmed = symbol.trim();
  if (trimmed.startsWith("@")) {
    return { kind: "spot", coin: trimmed };
  }

  const upper = trimmed.toUpperCase();
  const clean = upper.replace(/[^A-Z0-9:]/g, "");

  if (clean.includes(":")) {
    const [dex, ...rest] = clean.split(":");
    let coinPart = rest.join(":");
    coinPart = coinPart.replace(/USDT?$/, "").replace(/USDC?$/, "");
    return {
      kind: "builderPerp",
      coin: `${dex.toLowerCase()}:${coinPart}`,
      dex: dex.toLowerCase(),
    };
  }

  let cleaned = clean;
  cleaned = cleaned.replace(/USDT?$/, "").replace(/USDC?$/, "");
  return { kind: "perp", coin: cleaned };
}

export const normalizeSymbol = (symbol: string): string => parseSymbol(symbol).coin;
