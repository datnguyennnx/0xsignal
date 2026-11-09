import { parseSymbol } from "@0xsignal/shared";

export type CoinWithoutIndex = { kind: "perp"; coin: string } | { kind: "needs-index" };

/**
 * Perps (main and builder/HIP-3) stream under their raw coin, so the markets
 * index is not needed to resolve them. Spot streams under a `@N` universe name
 * and unknown symbols may be spot, so both must wait for the index.
 */
export function resolveCoinWithoutIndex(symbol: string): CoinWithoutIndex {
  const parsed = parseSymbol(symbol);
  if (parsed.coin.trim() === "") return { kind: "needs-index" };
  if (parsed.kind === "spot") return { kind: "needs-index" };
  return { kind: "perp", coin: parsed.coin };
}
