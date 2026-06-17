import { useEffect, useRef, useState, useCallback } from "react";
import type { MarketStreamMeta, MarketSubscription } from "../lib/market-stream-client";
import { useMarketDataStore } from "@/stores/use-market-data-store";

export interface UseHyperliquidWsOptions {
  subscription: MarketSubscription | null;
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  /** Fires when the WebSocket successfully reconnects after a disconnect. */
  onReconnect?: () => void;
}

interface WsSubscription {
  unsubscribe(): void;
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

    const subscribe = async () => {
      try {
        const activeSub = await client.subscribe(
          { channel, symbol, interval, nSigFigs },
          {
            onMessage: (data, subscribedChannel, meta) => {
              if (ignore || !isMountedRef.current || generationRef.current !== generation) {
                return;
              }
              onMessageRef.current(data, subscribedChannel, meta);
            },
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
          // Effectively cancelled before start, cleanup immediately
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
            onMessage: (data, subscribedChannel, meta) => {
              if (!isMountedRef.current || generationRef.current !== generation) {
                return;
              }
              onMessageRef.current(data, subscribedChannel, meta);
            },
            onConnectionChange: (connected) => {
              if (!isMountedRef.current || generationRef.current !== generation) {
                return;
              }
              setIsConnected(connected);
              onConnectionChangeRef.current?.(connected);
            },
            onError: (err) => {
              if (!isMountedRef.current || generationRef.current !== generation) {
                return;
              }
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
        if (!isMountedRef.current || generationRef.current !== generation) {
          return;
        }
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [isConnected, client],
  );

  return {
    resubscribe,
    isConnected,
    subscription,
  };
}
