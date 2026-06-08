import { normalizeSymbol, parseSymbol } from "./symbol";
import { HyperliquidError } from "./errors";
import type { MarketAssetCtxItem, TickerPayload, TickerSnapshot } from "./types";

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
