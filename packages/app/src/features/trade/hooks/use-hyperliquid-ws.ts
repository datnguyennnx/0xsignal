import { useEffect, useRef, useState } from "react";
import type {
  MarketStreamClient,
  MarketStreamMeta,
  MarketSubscription,
} from "../lib/market-stream-client";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import { orderbookStoreKey } from "../lib/orderbook-book";
import { isL2BookSnapshotPayload, isL2BookDeltaPayload } from "../utils/market-stream-decoder";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Shared auto-routing logic: routes market stream messages to the Zustand store.
 */
function routeMarketMessageToStore(
  data: unknown,
  ch: string,
  meta?: MarketStreamMeta,
  symbol?: string,
  requestedNSigFigs?: number | null,
): void {
  if (ch === "l2Book") {
    const key = orderbookStoreKey(
      symbol !== undefined && symbol !== "" ? symbol : (meta?.coin ?? "unknown"),
      meta?.nSigFigs ?? requestedNSigFigs ?? null,
    );
    if (isL2BookSnapshotPayload(data)) {
      useMarketDataStore
        .getState()
        .applyOrderbookSnapshot(key, [[...data.levels[0]], [...data.levels[1]]]);
    } else if (isL2BookDeltaPayload(data)) {
      if (data.delta.replace) {
        useMarketDataStore.getState().requestOrderbookReplace(key);
      } else {
        useMarketDataStore
          .getState()
          .applyOrderbookDelta(key, data.delta.changedBids, data.delta.changedAsks);
      }
    }
  } else if (ch === "allMids" && isRecord(data)) {
    const parsed: Record<string, number> = {};
    for (const [coin, price] of Object.entries(data)) {
      if (typeof price === "string") {
        parsed[coin] = Number(price) || 0;
      }
    }
    useMarketDataStore.getState().setAllMids(parsed);
  }
  // candle: caller must provide onMessage for now
}

type MarketStreamCallbacks = Parameters<MarketStreamClient["subscribe"]>[1];

function openSubscription(
  client: MarketStreamClient,
  subscription: MarketSubscription,
  callbacks: MarketStreamCallbacks,
): Promise<WsSubscription> {
  const { channel, symbol, nSigFigs, interval } = subscription;
  return client.subscribe({ channel, symbol, interval, nSigFigs }, callbacks);
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
    let activeSub: WsSubscription | null = null;
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    if (!enabled || subscription === null || !client) {
      return () => {};
    }

    const { channel, symbol, nSigFigs } = subscription;
    if ((symbol === undefined || symbol === "") && channel !== "allMids") return () => {};

    // Build a combined message handler that routes to store if no custom handler
    const handleMessage = (data: unknown, ch: string, meta?: MarketStreamMeta) => {
      if (ignore || !isMountedRef.current || generationRef.current !== generation) return;

      if (onMessageRef.current) {
        // Custom handler — caller manages data flow
        onMessageRef.current(data, ch, meta);
        return;
      }

      // Auto-route to store based on channel
      routeMarketMessageToStore(data, ch, meta, symbol, nSigFigs);
    };

    const sub = openSubscription(client, subscription, {
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
    });

    void (async () => {
      try {
        const created = await sub;
        if (ignore || !isMountedRef.current || generationRef.current !== generation) {
          created.unsubscribe();
          return;
        }
        activeSub = created;
        subRef.current = created;
      } catch (err) {
        if (!ignore && isMountedRef.current && generationRef.current === generation) {
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      ignore = true;
      generationRef.current = generationRef.current + 1;
      if (activeSub !== null) {
        activeSub.unsubscribe();
        if (subRef.current === activeSub) subRef.current = null;
        activeSub = null;
      }
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    };
  }, [enabled, subscription, client]);

  return { isConnected, subscription };
}
