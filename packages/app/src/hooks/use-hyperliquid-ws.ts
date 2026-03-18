/**
 * @fileoverview Hyperliquid WebSocket Hook
 *
 * Manages WebSocket connection to Hyperliquid for real-time data using @nktkas/hyperliquid SDK.
 *
 * @performance
 * - Uses refs to avoid stale closures
 * - Proper cleanup on unmount
 * - Connection state tracking
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid";

export const normalizeSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  return upper.endsWith("USDT") ? upper.slice(0, -4) : upper;
};

export interface HyperliquidSubscription {
  type: string;
  coin?: string;
  interval?: string;
  nSigFigs?: number | null;
}

export interface UseHyperliquidWsOptions {
  subscription: HyperliquidSubscription | null;
  onMessage: (data: unknown, channel: string) => void;
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

type Interval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

interface WsSubscription {
  unsubscribe(): void;
}

export function useHyperliquidWs({
  subscription,
  onMessage,
  enabled = true,
  onConnectionChange,
  onError,
}: UseHyperliquidWsOptions) {
  const [isConnected, setIsConnected] = useState(false);

  const clientRef = useRef<SubscriptionClient | null>(null);
  const subRef = useRef<WsSubscription | null>(null);
  const isMountedRef = useRef(true);

  // Use refs for callbacks to avoid stale closures
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup subscription
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
    };
  }, []);

  // Subscribe/unsubscribe when subscription changes
  useEffect(() => {
    // Cleanup previous subscription
    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    if (!enabled || !subscription) {
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
      return;
    }

    const { type: channel, coin, nSigFigs, interval } = subscription;

    if (!coin) return;

    const transport = new WebSocketTransport();
    const client = new SubscriptionClient({ transport });
    clientRef.current = client;

    const subscribe = async () => {
      try {
        if (channel === "l2Book") {
          subRef.current = await client.l2Book(
            { coin, nSigFigs: nSigFigs ?? null },
            (data: unknown) => onMessageRef.current(data, channel)
          );
        } else if (channel === "candle" && interval) {
          subRef.current = await client.candle(
            { coin, interval: interval as Interval },
            (data: unknown) => onMessageRef.current(data, channel)
          );
        } else if (channel === "trades") {
          subRef.current = await client.trades({ coin }, (data: unknown) =>
            onMessageRef.current(data, channel)
          );
        } else if (channel === "allMids") {
          subRef.current = await client.allMids((data: unknown) =>
            onMessageRef.current(data, channel)
          );
        }

        if (isMountedRef.current) {
          setIsConnected(true);
          onConnectionChangeRef.current?.(true);
        }
      } catch (err) {
        if (isMountedRef.current) {
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    subscribe();

    return () => {
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    };
  }, [
    enabled,
    subscription?.type,
    subscription?.coin,
    subscription?.interval,
    subscription?.nSigFigs,
  ]);

  const resubscribe = useCallback(
    async (newSubscription: HyperliquidSubscription) => {
      if (!clientRef.current || !isConnected) return;

      if (subRef.current) {
        subRef.current.unsubscribe();
      }

      const { type: channel, coin, nSigFigs, interval } = newSubscription;

      if (!coin) return;

      try {
        if (channel === "l2Book") {
          subRef.current = await clientRef.current.l2Book(
            { coin, nSigFigs: nSigFigs ?? null },
            (data: unknown) => onMessageRef.current(data, channel)
          );
        } else if (channel === "candle" && interval) {
          subRef.current = await clientRef.current.candle(
            { coin, interval: interval as Interval },
            (data: unknown) => onMessageRef.current(data, channel)
          );
        }
      } catch (err) {
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [isConnected]
  );

  return {
    resubscribe,
    isConnected,
    subscription: subscription ? { ...subscription } : null,
  };
}
