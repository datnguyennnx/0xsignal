import { useState, useCallback, useMemo } from "react";
import { useHyperliquidWs } from "./use-hyperliquid-ws";

/**
 * Subscribe to real-time mid prices for ALL coins via the `allMids` WS channel.
 * Returns a `Record<coin, number>` that updates on every WebSocket message.
 *
 * @param enabled - whether the subscription is active (default true)
 * @returns a map of coin names to their current mid price
 */
export function useAllMids(enabled = true): Record<string, number> {
  const [mids, setMids] = useState<Record<string, number>>({});

  const handleMessage = useCallback((data: unknown) => {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const parsed: Record<string, number> = {};
      for (const [coin, price] of Object.entries(data)) {
        if (typeof price === "string") {
          parsed[coin] = Number(price) || 0;
        }
      }
      setMids(parsed);
    }
  }, []);

  // Stable subscription reference — prevents infinite unsubscribe/resubscribe cycles
  const subscription = useMemo(
    () => (enabled ? ({ type: "allMids" as const } as const) : null),
    [enabled],
  );

  useHyperliquidWs({
    subscription,
    onMessage: handleMessage,
    enabled,
  });

  return mids;
}
