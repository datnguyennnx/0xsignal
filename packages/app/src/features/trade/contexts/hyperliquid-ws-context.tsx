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
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid";

interface HyperliquidWsContextValue {
  client: SubscriptionClient | null;
}

const HyperliquidWsContext = createContext<HyperliquidWsContextValue | null>(null);

function createClient(): SubscriptionClient | null {
  try {
    const transport = new WebSocketTransport();
    return new SubscriptionClient({ transport });
  } catch (err) {
    console.error("Failed to initialize Hyperliquid WebSocket:", err);
    return null;
  }
}

export function HyperliquidWsProvider({ children }: { children: React.ReactNode }) {
  // Use state with lazy initializer - client is created once and never changes
  const [client] = useState<SubscriptionClient | null>(createClient);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        // Access internal transport safely from the SDK client
        const internal = client as any;
        if (internal.transport && typeof internal.transport.close === "function") {
          internal.transport.close();
        }
      }
    };
  }, [client]);

  // Memoize value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({ client }), [client]);

  return <HyperliquidWsContext.Provider value={value}>{children}</HyperliquidWsContext.Provider>;
}

export function useHyperliquidWsClient(): SubscriptionClient | null {
  const context = useContext(HyperliquidWsContext);
  if (!context) {
    throw new Error("useHyperliquidWsClient must be used within a HyperliquidWsProvider");
  }
  return context.client;
}
