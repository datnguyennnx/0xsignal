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
import {
  applyBookFrame,
  bookFrameLeg,
  createBookMergeState,
  openBoth,
  type BookLeg,
  type BookMergeState,
} from "./l2-book-merge";

// Browser-direct market data; the backend hub is the fallback.
const HL_MARKET_WS_URL = "wss://api.hyperliquid.xyz/ws";
const DEFAULT_INTERVAL: WsMarketInterval = "1h";

type MarketStreamSource = "direct" | "backend";
type MarketStreamConnectionState = "idle" | "connecting" | "connected" | "fallback" | "offline";
export interface MarketStreamStatus {
  readonly source: MarketStreamSource;
  readonly state: MarketStreamConnectionState;
  readonly reason: string | null;
}

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
  readonly fast?: boolean;
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
      const payload = {
        coin: params.coin,
        ...(params.nSigFigs !== undefined && { nSigFigs: params.nSigFigs }),
        ...(params.fast === true && { fast: true }),
      };
      const wantedLeg = params.fast === true ? "fast" : "slow";
      return client.l2Book(
        payload,
        (event) => {
          // One channel name, every listener: drop the other leg's frames.
          if (bookFrameLeg(event) !== wantedLeg) return;
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

// The hub resolves bare/dex/spot coins; the browser must send a resolved coin.

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
// Both transports share the hub's decoder contract (snapshot, mids, candles).

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

interface DirectEntry {
  readonly subscription: WsMarketSubscription;
  readonly frameSymbol: string;
  readonly registrations: Set<MarketStreamCallbacks>;
  readonly fallbacks: Map<MarketStreamCallbacks, { unsubscribe(): void }>;
  handles: DirectHandle[];
  book: BookMergeState | null;
  lastBookEvent: unknown;
  closed: boolean;
  directFailed: boolean;
}

interface DirectHooks {
  readonly onOpen?: () => void;
  readonly onFailure?: (error: Error) => void;
  /** Re-homes a live registration onto the hub when the direct socket drops. */
  readonly fallback?: (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
  ) => Promise<{ unsubscribe(): void }>;
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

  const handleBookFrame = (entry: DirectEntry, event: unknown): void => {
    if (entry.book === null || entry.lastBookEvent === event) return;
    entry.lastBookEvent = event;
    const merged = applyBookFrame(entry.book, bookFrameLeg(event), event);
    if (merged !== null) broadcast(entry, { levels: merged.levels, time: merged.time });
  };

  const fail = (key: string, entry: DirectEntry, error: Error): void => {
    if (entry.directFailed) return;
    entry.directFailed = true;
    const handles = entry.handles;
    entry.handles = [];
    for (const handle of handles) void handle.unsubscribe();
    for (const callbacks of entry.registrations) {
      callbacks.onConnectionChange?.(false);
    }
    hooks.onFailure?.(error);

    if (hooks.fallback === undefined) {
      entries.delete(key);
      entry.closed = true;
      for (const callbacks of entry.registrations) callbacks.onError?.(error);
      return;
    }

    for (const callbacks of entry.registrations) {
      void hooks
        .fallback(entry.subscription, callbacks)
        .then((subscription) => {
          if (entry.registrations.has(callbacks) && !entry.closed) {
            entry.fallbacks.set(callbacks, subscription);
            return true;
          }
          subscription.unsubscribe();
          return false;
        })
        .catch((fallbackError: unknown) => {
          callbacks.onError?.(toError(fallbackError));
          return false;
        });
    }
  };

  const startUpstream = (key: string, entry: DirectEntry): Promise<DirectHandle[]> => {
    const subscription = entry.subscription;
    const listener = (event: unknown) => {
      broadcast(entry, event);
    };
    const onError = (error: Error) => {
      fail(key, entry, error);
    };

    if (subscription.channel === "allMids") {
      return sink.allMids(listener, onError).then((handle) => [handle]);
    }
    const coin = subscription.symbol ?? "";

    if (subscription.channel === "l2Book") {
      entry.book = createBookMergeState();
      const { nSigFigs } = subscription;
      const params: DirectL2BookParams = nSigFigs == null ? { coin } : { coin, nSigFigs };
      const open = (leg: BookLeg) =>
        sink.l2Book(
          leg === "fast" ? { ...params, fast: true } : params,
          (event) => {
            handleBookFrame(entry, event);
          },
          onError,
        );
      return openBoth([open("slow"), open("fast")]);
    }

    return sink
      .candle({ coin, interval: subscription.interval ?? DEFAULT_INTERVAL }, listener, onError)
      .then((handle) => [handle]);
  };

  const release = (key: string, entry: DirectEntry, callbacks: MarketStreamCallbacks): void => {
    if (!entry.registrations.delete(callbacks)) return;
    callbacks.onConnectionChange?.(false);

    const fallback = entry.fallbacks.get(callbacks);
    entry.fallbacks.delete(callbacks);
    fallback?.unsubscribe();

    if (entry.registrations.size > 0) return;

    entries.delete(key);
    entry.closed = true;
    const handles = entry.handles;
    entry.handles = [];
    for (const handle of handles) void handle.unsubscribe();
    for (const subscription of entry.fallbacks.values()) subscription.unsubscribe();
    entry.fallbacks.clear();
  };

  return {
    subscribe: async (subscription, frameSymbol, callbacks) => {
      const key = directKey(subscription);
      const existing = entries.get(key);
      if (existing !== undefined) {
        existing.registrations.add(callbacks);
        if (existing.handles.length > 0) callbacks.onConnectionChange?.(true);
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
        fallbacks: new Map(),
        handles: [],
        book: null,
        lastBookEvent: null,
        closed: false,
        directFailed: false,
      };
      entries.set(key, entry);

      try {
        const handles = await startUpstream(key, entry);
        if (entry.closed) {
          await Promise.all(handles.map((handle) => handle.unsubscribe()));
          return { unsubscribe: () => {} };
        }
        if (entry.directFailed) {
          // A leg errored while opening; the entry is already on the hub.
          for (const handle of handles) void handle.unsubscribe();
        } else {
          entry.handles = handles;
        }
        for (const registration of entry.registrations) {
          registration.onConnectionChange?.(!entry.directFailed);
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

  const wrapBackendCallbacks = (callbacks: MarketStreamCallbacks): MarketStreamCallbacks => ({
    onMessage: callbacks.onMessage,
    onConnectionChange: (connected) => {
      updateStatus({
        source: "backend",
        state: connected ? "connected" : "connecting",
        reason: useMarketStreamStatus.getState().reason,
      });
      callbacks.onConnectionChange?.(connected);
    },
    onError: (error) => {
      updateStatus({ source: "backend", state: "offline", reason: error.message });
      callbacks.onError?.(error);
    },
    ...(callbacks.onReconnect !== undefined && { onReconnect: callbacks.onReconnect }),
  });

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
      fallback: (subscription, callbacks) =>
        backend.subscribe(subscription, wrapBackendCallbacks(callbacks)),
    });
    return direct;
  };

  const toBackend = (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
    reason: string,
  ): Promise<{ unsubscribe(): void }> => {
    updateStatus({ source: "backend", state: "fallback", reason });
    return backend.subscribe(subscription, wrapBackendCallbacks(callbacks));
  };

  const subscribe = async (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
  ): Promise<{ unsubscribe(): void }> => {
    if (directDisabled) {
      return toBackend(
        subscription,
        callbacks,
        useMarketStreamStatus.getState().reason ?? "direct-unavailable",
      );
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
