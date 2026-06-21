import { useMemo } from "react";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { useAllMidsData } from "@/stores/use-market-data-store";

/**
 * Subscribe to real-time mid prices for ALL coins via the `allMids` WS channel.
 * Returns a `Record<coin, number>` that updates on every WebSocket message.
 * Data is written to the central market data store; this hook reads from it.
 *
 * @param enabled - whether the subscription is active (default true)
 * @returns a map of coin names to their current mid price
 */
export function useAllMids(enabled = true): Record<string, number> {
  // Read mids from the central store (written by useHyperliquidWs auto-routing)
  const mids = useAllMidsData();

  // Stable subscription reference — prevents infinite unsubscribe/resubscribe cycles
  const subscription = useMemo(
    () => (enabled ? ({ channel: "allMids" as const } as const) : null),
    [enabled],
  );

  // No custom onMessage needed — useHyperliquidWs auto-routes allMids to store
  useHyperliquidWs({
    subscription,
    enabled,
    onError: (error) => {
      console.error("allMids WS error:", error);
    },
  });

  return mids;
}
