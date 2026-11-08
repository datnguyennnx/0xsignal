import { useMemo } from "react";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { useMidPrice as useMidPriceValue } from "@/stores/use-market-data-store";

export function reportAllMidsError(error: Error): void {
  console.error("allMids WS error:", error);
}

/** Stable subscription reference — prevents unsubscribe/resubscribe cycles. */
function useAllMidsSubscription(enabled: boolean) {
  return useMemo(() => (enabled ? ({ channel: "allMids" as const } as const) : null), [enabled]);
}

/**
 * Subscribe to a single coin's mid. The selector returns a scalar, so a frame
 * that moves another coin does not re-render this consumer (AU7-01).
 *
 * @param coin - coin symbol as keyed in the `allMids` payload
 * @param enabled - whether the subscription is active (default true)
 */
export function useMidPrice(coin: string, enabled = true): number | undefined {
  const active = enabled && coin !== "";
  const price = useMidPriceValue(active ? coin : "");
  const subscription = useAllMidsSubscription(active);

  useHyperliquidWs({
    subscription,
    enabled: active,
    onError: reportAllMidsError,
  });

  return price;
}
