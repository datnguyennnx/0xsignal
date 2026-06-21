import { useEffect, useRef, useState, useCallback } from "react";
import type { MarketStreamMeta, MarketSubscription } from "../lib/market-stream-client";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import type { L2BookLevel } from "@/core/utils/hyperliquid";
import type { L2BookSnapshotPayload, L2BookDeltaPayload } from "../utils/market-stream-decoder";

export interface UseHyperliquidWsOptions {
  subscription: MarketSubscription | null;
  /**
   * Optional message handler. If provided, the hook will NOT auto-route
   * messages to the store — the caller is responsible for handling them.
   * If omitted, messages are routed to the store based on channel.
   */
  onMessage?: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

interface WsSubscription {
  unsubscribe(): void;
}

/**
 * Shared auto-routing logic: routes market stream messages to the Zustand store.
 * Used by both the initial subscription and the resubscribe path.
 */
function routeMarketMessageToStore(
  data: unknown,
  ch: string,
  meta?: MarketStreamMeta,
  symbol?: string,
): void {
  if (ch === "l2Book") {
    const payload = data as Record<string, unknown>;
    if (payload.type === "snapshot") {
      const snap = payload as unknown as L2BookSnapshotPayload;
      const symbolKey = meta?.coin ?? symbol ?? "unknown";
      if (snap.levels && snap.levels.length === 2) {
        useMarketDataStore
          .getState()
          .applyOrderbookSnapshot(symbolKey, [
            snap.levels[0] as unknown as L2BookLevel[],
            snap.levels[1] as unknown as L2BookLevel[],
          ]);
      }
    } else if (payload.type === "delta") {
      const delta = payload as unknown as L2BookDeltaPayload;
      const symbolKey = meta?.coin ?? symbol ?? "unknown";
      if (delta.delta.replace) {
        useMarketDataStore.getState().requestOrderbookReplace(symbolKey);
      } else {
        useMarketDataStore
          .getState()
          .applyOrderbookDelta(
            symbolKey,
            delta.delta.changedBids as unknown as readonly L2BookLevel[],
            delta.delta.changedAsks as unknown as readonly L2BookLevel[],
          );
      }
    }
  } else if (ch === "allMids") {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const parsed: Record<string, number> = {};
      for (const [coin, price] of Object.entries(data as Record<string, unknown>)) {
        if (typeof price === "string") {
          parsed[coin] = Number(price) || 0;
        }
      }
      useMarketDataStore.getState().setAllMids(parsed);
    }
  }
  // candle and trades: caller must provide onMessage for now
}

export function useHyperliquidWs({
  subscription,
  onMessage,
  enabled = true,
  onConnectionChange,
  onError,
  onReconnect,
}: UseHyperliquidWsOptions) {
  const client = useMarketDataStore((s) => s.marketStreamClient);
  const [isConnected, setIsConnected] = useState(false);
  const subRef = useRef<WsSubscription | null>(null);
  const isMountedRef = useRef(true);
  const generationRef = useRef(0);

  // Stable refs for callbacks
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
    onReconnectRef.current = onReconnect;
  });

  // Mount/unmount lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
    };
  }, []);

  // Subscription effect
  useEffect(() => {
    let ignore = false;
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    if (!enabled || !subscription || !client) {
      return;
    }

    const { channel, symbol, nSigFigs, interval } = subscription;
    if (!symbol && channel !== "allMids") return;

    // Build a combined message handler that routes to store if no custom handler
    const handleMessage = (data: unknown, ch: string, meta?: MarketStreamMeta) => {
      if (ignore || !isMountedRef.current || generationRef.current !== generation) return;

      if (onMessageRef.current) {
        // Custom handler — caller manages data flow
        onMessageRef.current(data, ch, meta);
        return;
      }

      // Auto-route to store based on channel
      routeMarketMessageToStore(data, ch, meta, symbol);
    };

    const subscribe = async () => {
      try {
        const activeSub = await client.subscribe(
          { channel, symbol, interval, nSigFigs },
          {
            onMessage: handleMessage,
            onConnectionChange: (connected) => {
              if (!ignore && isMountedRef.current && generationRef.current === generation) {
                setIsConnected(connected);
                onConnectionChangeRef.current?.(connected);
              }
            },
            onError: (err) => {
              if (!ignore && isMountedRef.current && generationRef.current === generation) {
                setIsConnected(false);
                onConnectionChangeRef.current?.(false);
                onErrorRef.current?.(err);
              }
            },
            onReconnect: () => {
              if (!ignore && isMountedRef.current && generationRef.current === generation) {
                onReconnectRef.current?.();
              }
            },
          },
        );

        if (!ignore && isMountedRef.current && generationRef.current === generation) {
          subRef.current = activeSub;
        } else {
          activeSub.unsubscribe();
        }
      } catch (err) {
        if (!ignore && isMountedRef.current && generationRef.current === generation) {
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    subscribe();

    return () => {
      ignore = true;
      generationRef.current = generationRef.current + 1;
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    };
  }, [enabled, subscription, client]);

  const resubscribe = useCallback(
    async (newSubscription: MarketSubscription) => {
      if (!client || !isConnected) return;

      const generation = generationRef.current + 1;
      generationRef.current = generation;

      if (subRef.current) subRef.current.unsubscribe();
      subRef.current = null;

      const { channel, symbol, nSigFigs, interval } = newSubscription;
      if (!symbol && channel !== "allMids") return;

      try {
        const activeSub = await client.subscribe(
          { channel, symbol, interval, nSigFigs },
          {
            onMessage: (data, ch, meta) => {
              if (!isMountedRef.current || generationRef.current !== generation) return;
              if (onMessageRef.current) {
                onMessageRef.current(data, ch, meta);
                return;
              }
              // Auto-route to store (same as initial subscription)
              routeMarketMessageToStore(data, ch, meta, symbol);
            },
            onConnectionChange: (connected) => {
              if (!isMountedRef.current || generationRef.current !== generation) return;
              setIsConnected(connected);
              onConnectionChangeRef.current?.(connected);
            },
            onError: (err) => {
              if (!isMountedRef.current || generationRef.current !== generation) return;
              setIsConnected(false);
              onConnectionChangeRef.current?.(false);
              onErrorRef.current?.(err);
            },
            onReconnect: () => {
              if (isMountedRef.current && generationRef.current === generation) {
                onReconnectRef.current?.();
              }
            },
          },
        );

        if (!isMountedRef.current || generationRef.current !== generation) {
          activeSub.unsubscribe();
          return;
        }

        subRef.current = activeSub;
      } catch (err) {
        if (!isMountedRef.current || generationRef.current !== generation) return;
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [isConnected, client],
  );

  return { resubscribe, isConnected, subscription };
}
