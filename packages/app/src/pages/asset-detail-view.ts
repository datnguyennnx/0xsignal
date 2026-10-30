import type { AssetViewModel } from "@/features/asset-detail/components/asset-content";
import { normalizeSymbol } from "@/features/trade/lib/symbol";

/** Zeroed ticker: the header fills these from the markets list and the WS mid. */
function placeholderPrice(symbol: string): AssetViewModel["price"] {
  return {
    symbol,
    price: 0,
    change24h: 0,
    volume24h: 0,
    openInterest: 0,
    funding: 0,
    markPx: 0,
    midPx: 0,
    prevDayPx: 0,
    timestamp: new Date(0),
  };
}

/**
 * The route params identify the market, so the page can paint before the ticker
 * answers; the ticker only refines the header price when it lands.
 */
export function resolveAssetView(
  rawCoin: string,
  ticker?: AssetViewModel["price"],
): AssetViewModel | null {
  if (rawCoin === "") return null;
  return { symbol: rawCoin, price: ticker ?? placeholderPrice(rawCoin) };
}

/** The canonical URL to replace a non-canonical route coin with, or `null` when it already is. */
export function resolveCanonicalRoute(rawCoin: string): string | null {
  if (rawCoin === "") return null;
  const normalized = normalizeSymbol(rawCoin);
  return rawCoin === normalized ? null : normalized;
}
