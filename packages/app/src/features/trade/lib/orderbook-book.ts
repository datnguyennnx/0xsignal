import type { L2BookLevel } from "@/core/utils/hyperliquid";

/**
 * Order-book identity. Aggregation precision is part of the key: a raw feed and
 * a precision-aggregated one are different books and must never collide.
 */
export function orderbookStoreKey(symbol: string, nSigFigs?: number | null): string {
  return `${symbol}:${nSigFigs ?? "raw"}`;
}

/**
 * l2Book pushes a full snapshot on every frame, so a side is replaced rather
 * than patched. A level absent from the new frame must not survive.
 */
export function replaceBookLevels(
  target: Map<string, L2BookLevel>,
  levels: readonly L2BookLevel[],
): void {
  target.clear();
  for (const level of levels) target.set(level.px, level);
}
