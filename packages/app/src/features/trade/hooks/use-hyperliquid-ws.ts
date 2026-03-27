/**
 * @overview Hyperliquid WebSocket Hook
 *
 * It consumes the shared WebSocket context and manages the lifecycle of individual channel subscriptions.
 * It uses the global persistent connection, ensuring that changing parameters (interval, sigfigs)
 * doesn't drop the socket.
 *
 * @mechanism
 * - Consumes SubscriptionClient from HyperliquidWsContext
 * - Manages reactive unsubscription on effect cleanup or parameter update
 * - Uses refs to persist callbacks and prevent stale closures
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useHyperliquidWsClient } from "../contexts/hyperliquid-ws-context";

export type AssetKind = "perp" | "builderPerp" | "spot";

export interface NormalizedAsset {
  kind: AssetKind;
  coin: string;
  dex?: string;
  spotIndex?: number;
}

export function parseSymbol(symbol: string): NormalizedAsset {
  if (symbol.startsWith("@")) {
    return { kind: "spot", coin: symbol };
  }
  const upper = symbol.toUpperCase();
  const clean = upper.replace(/[^A-Z0-9:]/g, "");
  if (clean.includes(":")) {
    const [dex, ...rest] = clean.split(":");
    let coinPart = rest.join(":");
    coinPart = coinPart.replace(/USDT?$/, "").replace(/USDC?$/, "");
    return {
      kind: "builderPerp",
      coin: `${dex.toLowerCase()}:${coinPart}`,
      dex: dex.toLowerCase(),
    };
  }
  let cleaned = clean;
  cleaned = cleaned.replace(/USDT?$/, "").replace(/USDC?$/, "");
  return { kind: "perp", coin: cleaned };
}

export const normalizeSymbol = (symbol: string): string => {
  return parseSymbol(symbol).coin;
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
  const client = useHyperliquidWsClient();
  const [isConnected, setIsConnected] = useState(false);
  const subRef = useRef<WsSubscription | null>(null);
  const isMountedRef = useRef(true);

  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
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

    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    if (!enabled || !subscription || !client) {
      return;
    }

    const { type: channel, coin, nSigFigs, interval } = subscription;
    if (!coin && channel !== "allMids") return;

    const subscribe = async () => {
      try {
        let activeSub: WsSubscription | null = null;
        if (channel === "l2Book" && coin) {
          activeSub = await client.l2Book({ coin, nSigFigs: nSigFigs ?? null }, (data) =>
            onMessageRef.current(data, channel)
          );
        } else if (channel === "candle" && interval && coin) {
          activeSub = await client.candle({ coin, interval: interval as Interval }, (data) =>
            onMessageRef.current(data, channel)
          );
        } else if (channel === "trades" && coin) {
          activeSub = await client.trades({ coin }, (data) => onMessageRef.current(data, channel));
        } else if (channel === "allMids") {
          activeSub = await client.allMids((data) => onMessageRef.current(data, channel));
        }

        if (!ignore && isMountedRef.current && activeSub) {
          subRef.current = activeSub;
          setIsConnected(true);
          onConnectionChangeRef.current?.(true);
        } else if (activeSub) {
          // Effectively cancelled before start, cleanup immediately
          activeSub.unsubscribe();
        }
      } catch (err) {
        if (!ignore && isMountedRef.current) {
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    subscribe();

    return () => {
      ignore = true;
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    };
  }, [enabled, subscription, client]);

  const resubscribe = useCallback(
    async (newSubscription: HyperliquidSubscription) => {
      if (!client || !isConnected) return;
      if (subRef.current) subRef.current.unsubscribe();

      const { type: channel, coin, nSigFigs, interval } = newSubscription;
      if (!coin) return;

      try {
        let activeSub: WsSubscription | null = null;
        if (channel === "l2Book") {
          activeSub = await client.l2Book({ coin, nSigFigs: nSigFigs ?? null }, (data) =>
            onMessageRef.current(data, channel)
          );
        } else if (channel === "candle" && interval) {
          activeSub = await client.candle({ coin, interval: interval as Interval }, (data) =>
            onMessageRef.current(data, channel)
          );
        }
        if (activeSub) subRef.current = activeSub;
      } catch (err) {
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [isConnected, client]
  );

  return {
    resubscribe,
    isConnected,
    subscription: subscription ? { ...subscription } : null,
  };
}
