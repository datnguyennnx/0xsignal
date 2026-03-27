/**
 * @overview Hyperliquid WebSocket Context Provider
 *
 * It provides a shared WebSocket connection for all market data subscriptions.
 * It manages a single `SubscriptionClient` to prevent connection churn when
 * navigating between views or changing parameters (interval, sigfigs).
 *
 * @mechanism
 * - Initializes one `WebSocketTransport` on mount
 * - Exposes the `SubscriptionClient` to all consuming hooks
 * - Handles the global lifecycle of the connection
 */
import { createContext, useContext, useEffect, useMemo } from "react";
import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid";

interface HyperliquidWsContextValue {
  client: SubscriptionClient | null;
}

const HyperliquidWsContext = createContext<HyperliquidWsContextValue | null>(null);

export function HyperliquidWsProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    try {
      const transport = new WebSocketTransport();
      const client = new SubscriptionClient({ transport });
      return { client };
    } catch (err) {
      console.error("Failed to initialize Hyperliquid WebSocket:", err);
      return { client: null };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (value.client) {
        // Access internal transport safely from the SDK client
        const internal = value.client as any;
        if (internal.transport && typeof internal.transport.close === "function") {
          internal.transport.close();
        }
      }
    };
  }, [value.client]);

  return <HyperliquidWsContext.Provider value={value}>{children}</HyperliquidWsContext.Provider>;
}

export function useHyperliquidWsClient(): SubscriptionClient | null {
  const context = useContext(HyperliquidWsContext);
  if (!context) {
    throw new Error("useHyperliquidWsClient must be used within a HyperliquidWsProvider");
  }
  return context.client;
}
