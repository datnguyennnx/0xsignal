import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import { create } from "zustand";
import type { WsMarketInterval, WsMarketSubscription } from "@0xsignal/shared";
import { getMarkets } from "@/services/api/market";
import {
  createMarketStreamClient,
  type MarketStreamClient,
  type MarketStreamMeta,
} from "./market-stream-client";
import { normalizeSymbol } from "./symbol";
import { convertToCandlePayload } from "../utils/market-stream-decoder";

/**
 * Public market data is streamed browser-direct to Hyperliquid. The backend hub
 * stays reachable as the fallback when a symbol cannot be resolved or the direct
 * socket is blocked. Subscriptions carry no Hyperliquid REST weight; the win is
 * backend CPU/socket load and one fewer network hop.
 */
const HL_MARKET_WS_URL = "wss://api.hyperliquid.xyz/ws";
const DEFAULT_INTERVAL: WsMarketInterval = "1h";

type MarketStreamSource = "direct" | "backend";
type MarketStreamConnectionState = "idle" | "connecting" | "connected" | "fallback";
export interface MarketStreamStatus {
  readonly source: MarketStreamSource;
  readonly state: MarketStreamConnectionState;
  readonly reason: string | null;
}

/** Observable transport state, so a fallback switch is visible instead of silent. */
export const useMarketStreamStatus = create<MarketStreamStatus>(() => ({
  source: "direct",
  state: "idle",
  reason: null,
}));

const updateStatus = (status: MarketStreamStatus): void => {
  useMarketStreamStatus.setState(status);
};

export interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

interface DirectHandle {
  unsubscribe(): Promise<void>;
}

interface DirectL2BookParams {
  readonly coin: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
}

interface DirectCandleParams {
  readonly coin: string;
  readonly interval: WsMarketInterval;
}

/** Narrow seam over the Hyperliquid client so tests never open a socket. */
export interface DirectMarketSink {
  allMids(
    listener: (event: unknown) => void,
    onError: (error: Error) => void,
  ): Promise<DirectHandle>;
  l2Book(
    params: DirectL2BookParams,
    listener: (event: unknown) => void,
    onError: (error: Error) => void,
  ): Promise<DirectHandle>;
  candle(
    params: DirectCandleParams,
    listener: (event: unknown) => void,
    onError: (error: Error) => void,
  ): Promise<DirectHandle>;
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

function createHyperliquidSink(): DirectMarketSink {
  const transport = new WebSocketTransport({ url: HL_MARKET_WS_URL });
  const client = new SubscriptionClient({ transport });

  return {
    allMids: (listener, onError) =>
      client.allMids(
        (event) => {
          listener(event);
        },
        {
          onError: (error) => {
            onError(error);
          },
        },
      ),
    l2Book: (params, listener, onError) => {
      const payload =
        params.nSigFigs === undefined
          ? { coin: params.coin }
          : { coin: params.coin, nSigFigs: params.nSigFigs };
      return client.l2Book(
        payload,
        (event) => {
          listener(event);
        },
        {
          onError: (error) => {
            onError(error);
          },
        },
      );
    },
    candle: (params, listener, onError) =>
      client.candle(
        params,
        (event) => {
          listener(event);
        },
        {
          onError: (error) => {
            onError(error);
          },
        },
      ),
  };
}

// ── Coin resolution ──────────────────────────────────────────────────
// The hub resolves bare/dex coins and spot "@N" identifiers; the browser has to
// send an already-resolved coin. `/api/markets` carries both identifiers, so one
// fetch primes every channel.

let coinIndex: Map<string, string> | null = null;
let coinIndexRequest: Promise<Map<string, string>> | null = null;

function loadCoinIndex(): Promise<Map<string, string>> {
  if (coinIndex !== null) return Promise.resolve(coinIndex);
  coinIndexRequest ??= getMarkets()
    .then((markets) => {
      const index = new Map<string, string>();
      for (const market of markets) {
        if (market.isDelisted) continue;
        // Spot pairs stream under their "@N" universe name; perps (including
        // builder dexes) stream under the prefixed raw coin.
        const wsCoin = market.marketType === "spot" ? market.name : market.rawCoin;
        index.set(market.rawCoin.toLowerCase(), wsCoin);
      }
      coinIndex = index;
      return index;
    })
    .catch((error: unknown) => {
      coinIndexRequest = null;
      throw error;
    });
  return coinIndexRequest;
}

async function resolveHlCoin(symbol: string): Promise<string | null> {
  const normalized = normalizeSymbol(symbol);
  if (normalized === "") return null;
  try {
    const index = await loadCoinIndex();
    return index.get(normalized.toLowerCase()) ?? index.get(symbol.trim().toLowerCase()) ?? null;
  } catch {
    return null;
  }
}
// ── Frame conversion ─────────────────────────────────────────────────
// Both transports must deliver the same store shape, so the direct socket
// borrows the hub's decoder contract (snapshot object, mids map, candle array).

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLevelPair = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && Array.isArray(value[1]);

interface MarketFrame {
  readonly data: unknown;
  readonly meta: MarketStreamMeta | undefined;
}

export function toMarketFrame(
  subscription: WsMarketSubscription,
  frameSymbol: string,
  event: unknown,
): MarketFrame | null {
  if (subscription.channel === "allMids") {
    if (!isRecord(event) || !isRecord(event.mids)) return null;
    return { data: event.mids, meta: undefined };
  }

  if (subscription.channel === "l2Book") {
    if (!isRecord(event) || !isLevelPair(event.levels)) return null;
    const meta: MarketStreamMeta = {
      coin: frameSymbol,
      ...(subscription.nSigFigs != null && { nSigFigs: subscription.nSigFigs }),
    };
    // l2Book is a full snapshot on every frame — never a delta.
    return { data: { type: "snapshot", levels: event.levels }, meta };
  }

  if (subscription.channel === "candle") {
    const candles = convertToCandlePayload(event);
    if (candles.length === 0) return null;
    return {
      data: candles,
      meta: {
        coin: frameSymbol,
        ...(subscription.interval !== undefined && { interval: subscription.interval }),
      },
    };
  }

  return null;
}

// ── Direct client (refcounted) ───────────────────────────────────────

interface DirectEntry {
  readonly subscription: WsMarketSubscription;
  readonly frameSymbol: string;
  readonly registrations: Set<MarketStreamCallbacks>;
  handle: DirectHandle | null;
  closed: boolean;
}

interface DirectHooks {
  readonly onOpen?: () => void;
  readonly onFailure?: (error: Error) => void;
}

interface DirectSubscriptionHandle {
  unsubscribe(): void;
}

export interface DirectMarketStream {
  subscribe(
    subscription: WsMarketSubscription,
    frameSymbol: string,
    callbacks: MarketStreamCallbacks,
  ): Promise<DirectSubscriptionHandle>;
  readonly size: () => number;
}

const directKey = (subscription: WsMarketSubscription): string => {
  if (subscription.channel === "allMids") return "allMids";
  if (subscription.channel === "l2Book") {
    return `l2Book:${subscription.symbol ?? ""}:${subscription.nSigFigs ?? "raw"}`;
  }
  if (subscription.channel === "candle") {
    return `candle:${subscription.symbol ?? ""}:${subscription.interval ?? ""}`;
  }
  return `${subscription.channel}:${subscription.symbol ?? ""}`;
};

export function createDirectMarketStream(
  sink: DirectMarketSink,
  hooks: DirectHooks = {},
): DirectMarketStream {
  const entries = new Map<string, DirectEntry>();

  const broadcast = (entry: DirectEntry, event: unknown): void => {
    const frame = toMarketFrame(entry.subscription, entry.frameSymbol, event);
    if (frame === null) return;
    for (const callbacks of entry.registrations) {
      if (frame.meta === undefined) callbacks.onMessage(frame.data, entry.subscription.channel);
      else callbacks.onMessage(frame.data, entry.subscription.channel, frame.meta);
    }
  };

  const fail = (key: string, entry: DirectEntry, error: Error): void => {
    if (!entries.delete(key)) return;
    entry.closed = true;
    entry.handle = null;
    for (const callbacks of entry.registrations) {
      callbacks.onConnectionChange?.(false);
      callbacks.onError?.(error);
    }
    hooks.onFailure?.(error);
  };

  const startUpstream = (key: string, entry: DirectEntry): Promise<DirectHandle> => {
    const subscription = entry.subscription;
    const listener = (event: unknown) => {
      broadcast(entry, event);
    };
    const onError = (error: Error) => {
      fail(key, entry, error);
    };

    if (subscription.channel === "allMids") return sink.allMids(listener, onError);
    const coin = subscription.symbol ?? "";

    if (subscription.channel === "l2Book") {
      const nSigFigs = subscription.nSigFigs;
      return nSigFigs === null || nSigFigs === undefined
        ? sink.l2Book({ coin }, listener, onError)
        : sink.l2Book({ coin, nSigFigs }, listener, onError);
    }

    return sink.candle(
      { coin, interval: subscription.interval ?? DEFAULT_INTERVAL },
      listener,
      onError,
    );
  };

  const release = (key: string, entry: DirectEntry, callbacks: MarketStreamCallbacks): void => {
    if (!entry.registrations.delete(callbacks)) return;
    callbacks.onConnectionChange?.(false);
    if (entry.registrations.size > 0) return;

    entries.delete(key);
    entry.closed = true;
    const handle = entry.handle;
    entry.handle = null;
    if (handle !== null) void handle.unsubscribe();
  };

  return {
    subscribe: async (subscription, frameSymbol, callbacks) => {
      const key = directKey(subscription);
      const existing = entries.get(key);
      if (existing !== undefined) {
        existing.registrations.add(callbacks);
        if (existing.handle !== null) callbacks.onConnectionChange?.(true);
        return {
          unsubscribe: () => {
            release(key, existing, callbacks);
          },
        };
      }

      const entry: DirectEntry = {
        subscription,
        frameSymbol,
        registrations: new Set([callbacks]),
        handle: null,
        closed: false,
      };
      entries.set(key, entry);

      try {
        const handle = await startUpstream(key, entry);
        if (entry.closed) {
          await handle.unsubscribe();
          return { unsubscribe: () => {} };
        }
        entry.handle = handle;
        for (const registration of entry.registrations) {
          registration.onConnectionChange?.(true);
        }
        hooks.onOpen?.();
        return {
          unsubscribe: () => {
            release(key, entry, callbacks);
          },
        };
      } catch (error) {
        const failure = toError(error);
        if (entries.delete(key)) {
          entry.closed = true;
          for (const registration of entry.registrations) {
            registration.onConnectionChange?.(false);
            registration.onError?.(failure);
          }
        }
        hooks.onFailure?.(failure);
        throw failure;
      }
    },
    size: () => entries.size,
  };
}

// ── Hybrid client (direct first, hub fallback) ───────────────────────

export interface BrowserMarketStreamOptions {
  readonly sink?: DirectMarketSink;
  readonly backend?: MarketStreamClient;
  readonly resolveCoin?: (symbol: string) => Promise<string | null>;
}

export interface BrowserMarketStreamClient extends MarketStreamClient {
  readonly getStatus: () => MarketStreamStatus;
}

export function createBrowserMarketStreamClient(
  options: BrowserMarketStreamOptions = {},
): BrowserMarketStreamClient {
  const resolveCoin = options.resolveCoin ?? resolveHlCoin;
  const backend = options.backend ?? createMarketStreamClient();

  let sink: DirectMarketSink | null = options.sink ?? null;
  let direct: DirectMarketStream | null = null;
  let directDisabled = false;

  const getDirect = (): DirectMarketStream => {
    if (direct !== null) return direct;
    sink ??= createHyperliquidSink();
    direct = createDirectMarketStream(sink, {
      onOpen: () => {
        updateStatus({ source: "direct", state: "connected", reason: null });
      },
      onFailure: (error) => {
        directDisabled = true;
        updateStatus({ source: "backend", state: "fallback", reason: error.message });
      },
    });
    return direct;
  };

  const toBackend = (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
    reason: string,
  ): Promise<{ unsubscribe(): void }> => {
    updateStatus({ source: "backend", state: "fallback", reason });
    return backend.subscribe(subscription, callbacks);
  };

  const subscribe = async (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
  ): Promise<{ unsubscribe(): void }> => {
    if (subscription.channel === "trades") {
      return backend.subscribe(subscription, callbacks);
    }
    if (directDisabled) {
      return backend.subscribe(subscription, callbacks);
    }

    const frameSymbol = normalizeSymbol(subscription.symbol ?? "");
    let resolved = subscription;

    if (subscription.channel !== "allMids") {
      const coin = frameSymbol === "" ? null : await resolveCoin(frameSymbol);
      if (coin === null) {
        return toBackend(subscription, callbacks, `unresolved:${frameSymbol}`);
      }
      resolved = { ...subscription, symbol: coin };
    }

    const current = useMarketStreamStatus.getState();
    updateStatus({
      source: "direct",
      state: current.state === "connected" ? "connected" : "connecting",
      reason: null,
    });

    try {
      return await getDirect().subscribe(resolved, frameSymbol, callbacks);
    } catch (error) {
      directDisabled = true;
      return toBackend(subscription, callbacks, toError(error).message);
    }
  };

  return {
    subscribe,
    getStatus: () => useMarketStreamStatus.getState(),
  };
}
