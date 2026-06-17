export type AssetKind = "perp" | "builderPerp" | "spot";

export interface NormalizedAsset {
  kind: AssetKind;
  coin: string;
  /** For spot: the quote currency (e.g. "USDC"). For perps: undefined. */
  quote?: string;
  /** For builder perps: the DEX prefix (e.g. "xyz"). For main perps/spot/outcome: undefined. */
  dex?: string;
}

/**
 * Helper to strip stablecoin suffixes (USDT, USDC, USD etc).
 * Used only for perp and builderPerp kinds.
 */
const stripStables = (s: string) => s.replace(/[-_]?(USDT?|USDC?)$/, "");

/**
 * Parse symbol into { kind, coin }.
 * - "BTCUSDT" → perp "BTC"         (strip stablecoin suffix)
 * - "xyz:YEETI" → builderPerp      (lowercase dex prefix, uppercase asset)
 * - "PURR/USDC" → spot "PURR/USDC" (pass through untouched)
 * - "PURR-USDC" → spot "PURR-USDC" (hyphen+stablecoin → spot)
 */
export function parseSymbol(symbol: string): NormalizedAsset {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return { kind: "perp", coin: "" };
  }

  // Spot: "/" separator. Pass through untouched.
  if (trimmed.includes("/")) {
    return {
      kind: "spot",
      coin: trimmed,
      quote: trimmed.split("/")[1]?.toUpperCase() ?? "USDC",
    };
  }

  // Spot: "COIN-STABLE" (hyphen+known stablecoin)
  const hyphenMatch = trimmed.match(/^([A-Za-z0-9]+)-([A-Za-z]+)$/);
  if (hyphenMatch) {
    const stableSuffix = hyphenMatch[2].toUpperCase();
    if (["USDT", "USDC", "USD"].includes(stableSuffix)) {
      return {
        kind: "spot",
        coin: trimmed,
        quote: stableSuffix,
      };
    }
  }

  const upper = trimmed.toUpperCase();

  // Builder perps (HIP-3) with colon
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

  // Main perps
  // Keep hyphens, @, #, + but remove other noise characters,
  // strip stablecoin suffixes
  const cleaned = stripStables(upper.replace(/[^A-Z0-9-@#+]/g, ""));

  return { kind: "perp", coin: cleaned };
}

/** Canonical API identifier: strips stablecoin suffix (perps), preserves raw (spot). */
export const normalizeSymbol = (symbol: string): string => parseSymbol(symbol).coin;
