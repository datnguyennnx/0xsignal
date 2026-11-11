import { useEffect, useRef, useState } from "react";
import type {
  MarketStreamClient,
  MarketStreamMeta,
  MarketSubscription,
} from "../lib/market-stream-client";
import {
  cancelMidsFlush,
  useMarketDataStore,
  type OrderbookSnapshotMeta,
} from "@/stores/use-market-data-store";
import { orderbookStoreKey } from "../lib/orderbook-book";
import { normalizeSymbol } from "../lib/symbol";
import { isL2BookSnapshotPayload } from "../utils/market-stream-decoder";
import { isTradeBatch, toTradeTicks } from "../lib/trade-tick";
import type { WsTrade } from "@0xsignal/sdk-hyperliquid/subscription";

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
}

interface WsSubscription {
  unsubscribe(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * One parse per frame object, shared by every `allMids` registration. The stream
 * client broadcasts the same payload object to all subscribers, so a WeakMap
 * makes the second..Nth subscriber reuse the first subscriber's map (AU7-02).
 */
const parsedMids = new WeakMap<object, Record<string, number>>();

function parseMidsPayload(data: Record<string, unknown>): Record<string, number> {
  const cached = parsedMids.get(data);
  if (cached !== undefined) return cached;
  const parsed: Record<string, number> = {};
  for (const [coin, price] of Object.entries(data)) {
    if (typeof price === "string") parsed[coin] = Number(price) || 0;
  }
  parsedMids.set(data, parsed);
  return parsed;
}

const readDegradedLegs = (value: unknown): readonly ("fast" | "slow")[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const candidates: unknown[] = value;
  const legs: ("fast" | "slow")[] = [];
  for (const leg of candidates) {
    if (leg !== "fast" && leg !== "slow") return undefined;
    legs.push(leg);
  }
  return legs;
};

export function bookWriteMeta(payload: unknown): OrderbookSnapshotMeta {
  if (!isRecord(payload)) return {};
  const meta: { time?: number; degraded?: readonly ("fast" | "slow")[] } = {};
  if (typeof payload.time === "number" && Number.isFinite(payload.time)) meta.time = payload.time;
  const degraded = readDegradedLegs(payload.degraded);
  if (degraded !== undefined) meta.degraded = degraded;
  return meta;
}

const tradeCoin = (
  batch: readonly WsTrade[],
  meta: MarketStreamMeta | undefined,
  symbol: string | undefined,
): string | null => {
  if (symbol !== undefined) {
    const normalized = normalizeSymbol(symbol);
    if (normalized !== "") return normalized;
  }
  if (meta?.coin !== undefined && meta.coin !== "") return meta.coin;
  const [first] = batch;
  if (first !== undefined && typeof first.coin === "string" && first.coin !== "") return first.coin;
  return null;
};

/**
 * Shared auto-routing logic: routes market stream messages to the Zustand store.
 */
export function routeMarketMessageToStore(
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
        .applyOrderbookSnapshot(
          key,
          [[...data.levels[0]], [...data.levels[1]]],
          bookWriteMeta(data),
        );
    }
  } else if (ch === "allMids" && isRecord(data)) {
    useMarketDataStore.getState().setAllMids(parseMidsPayload(data));
  } else if (ch === "trades" && isTradeBatch(data)) {
    const coin = tradeCoin(data, meta, symbol);
    if (coin !== null) {
      useMarketDataStore.getState().pushTrades(coin, toTradeTicks(data));
    }
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

/**
 * `allMids` subscriptions are shared: `use-all-mids.ts` and `positions-tab.tsx`
 * both register through this hook, and the store coalesces every mids frame
 * into one module-level pending snapshot. So the queued frame belongs to the
 * whole app, not to one hook instance — it may only be dropped when the last
 * live `allMids` registration goes away (M3).
 */
let liveAllMidsConsumers = 0;

/**
 * Claim one live `allMids` registration and return its cleanup. Releasing the
 * last claim cancels the pending mids frame; the returned cleanup is
 * idempotent, so it is safe to run again and safe after unmount.
 */
export function acquireAllMidsConsumer(cancelFlush: () => void = cancelMidsFlush): () => void {
  liveAllMidsConsumers += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    liveAllMidsConsumers = Math.max(0, liveAllMidsConsumers - 1);
    if (liveAllMidsConsumers === 0) cancelFlush();
  };
}

export function useHyperliquidWs({
  subscription,
  onMessage,
  enabled = true,
  onConnectionChange,
  onError,
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

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
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
    });

    // Every allMids registration shares one pending frame in the store, so this
    // hook only releases its claim — the store flush dies with the last claim.
    const releaseMids = channel === "allMids" ? acquireAllMidsConsumer() : null;

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
      releaseMids?.();
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
