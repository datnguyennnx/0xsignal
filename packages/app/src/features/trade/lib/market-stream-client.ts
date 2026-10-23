import { mapToHLInterval } from "@/core/utils/hyperliquid";
import { resolveApiBase } from "@/lib/api-base";
import { normalizeSymbol } from "./symbol";
import type { WsMarketSubscription } from "@0xsignal/shared";
import {
  decodeMarketWsMessage,
  convertToCandlePayload,
  unwrapTradePayload,
  unwrapTickerPayload,
  type MarketStreamMeta,
} from "../utils/market-stream-decoder";

// Re-export shared type for backward-compatible import path
export type { WsMarketSubscription as MarketSubscription } from "@0xsignal/shared";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

/**
 * Build the WebSocket URL for the market stream.
 *
 * - When `VITE_API_URL` is explicitly configured (even in dev mode), connect
 *   directly to the API server — no Vite proxy.
 * - Otherwise, construct a relative URL through the Vite dev-server proxy.
 */
const createMarketStreamWsUrl = (
  apiBase: string,
  locationLike: Pick<Location, "protocol" | "host"> | undefined,
): string => {
  if (apiBase.startsWith("/")) {
    const protocol = locationLike?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${locationLike?.host ?? "localhost"}${apiBase}/ws/market`;
  }

  const wsUrl = new URL(apiBase);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.pathname = `${wsUrl.pathname.replace(/\/+$/, "")}/ws/market`;
  wsUrl.search = "";
  wsUrl.hash = "";

  return wsUrl.toString();
};

/**
 * Resolve the API base for WebSocket connections.
 *
 * If `VITE_API_URL` is configured, use it directly (connects straight to the
 * API server, bypassing Vite's dev proxy). Otherwise, fall back to the
 * relative path for Vite proxy routing.
 */
const resolveWsApiBase = (): string => {
  if (configuredApiUrl !== undefined && configuredApiUrl !== "") {
    // Ensure trailing /api is present
    const normalized = configuredApiUrl.replace(/\/+$/, "");
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
  }
  return resolveApiBase(configuredApiUrl, import.meta.env.DEV);
};

const WS_API_BASE = resolveWsApiBase();
const MARKET_STREAM_WS_URL = createMarketStreamWsUrl(WS_API_BASE, globalThis.location);

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  /** Fires when the WebSocket successfully reconnects after a disconnect. */
  onReconnect?: () => void;
}

// ── Subscription identity ────────────────────────────────────────────
// One socket carries every subscription for an endpoint, so frames are
// routed by the identity echoed on the wire, never by socket instance.

const toWireSubscription = (subscription: WsMarketSubscription): WsMarketSubscription => {
  const symbol = normalizeSymbol(subscription.symbol ?? "");
  if (subscription.channel === "allMids") return { channel: "allMids" };
  if (subscription.channel === "trades") return { channel: "trades", symbol };
  if (subscription.channel === "l2Book") {
    return {
      channel: "l2Book",
      symbol,
      ...(subscription.nSigFigs != null && { nSigFigs: subscription.nSigFigs }),
    };
  }
  return { channel: "candle", symbol, interval: subscription.interval ?? "1m" };
};

/** Mirrors the server bucket key so duplicate identities share one refcount. */
const buildSubscriptionKey = (subscription: WsMarketSubscription): string => {
  if (subscription.channel === "allMids") return "allMids";
  if (subscription.channel === "trades") return `trades:${subscription.symbol ?? ""}`;
  if (subscription.channel === "l2Book") {
    return `l2Book:${subscription.symbol ?? ""}:${subscription.nSigFigs ?? "raw"}`;
  }
  return `candle:${subscription.symbol ?? ""}:${subscription.interval ?? ""}`;
};

interface MarketStreamSubscription {
  unsubscribe(): void;
}

// ── Shared WebSocket connection pool ─────────────────────────────────
// One socket per server endpoint carries every subscription. Individual
// subscriptions are released by key; the socket closes when none remain.

interface SubscriptionRegistration {
  readonly callbacks: MarketStreamCallbacks;
}

interface SharedSubscription {
  readonly subscription: WsMarketSubscription;
  refCount: number;
  readonly registrations: Set<SubscriptionRegistration>;
}

interface SharedConnection {
  readonly url: string;
  socket: WebSocket | null;
  readonly subscriptions: Map<string, SharedSubscription>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
  cancelled: boolean;
}

const connectionPool = new Map<string, SharedConnection>();

const forEachRegistration = (
  entry: SharedConnection,
  callback: (callbacks: MarketStreamCallbacks) => void,
): void => {
  for (const shared of entry.subscriptions.values()) {
    for (const registration of shared.registrations) {
      callback(registration.callbacks);
    }
  }
};

const sendSubscriptionFrame = (
  socket: WebSocket,
  type: "subscribe" | "unsubscribe",
  subscription: WsMarketSubscription,
): void => {
  socket.send(JSON.stringify({ type, subscription }));
};

type DecodedMarketMessage = Extract<ReturnType<typeof decodeMarketWsMessage>, { kind: "market" }>;

const matchesSubscription = (
  subscription: WsMarketSubscription,
  meta: MarketStreamMeta | undefined,
): boolean => {
  if (meta === undefined) return true;
  if (meta.coin !== undefined && meta.coin !== subscription.symbol) return false;
  if (meta.interval !== undefined && meta.interval !== subscription.interval) return false;
  if (meta.nSigFigs !== undefined) {
    return (subscription.nSigFigs ?? null) === meta.nSigFigs;
  }
  return true;
};

const deliverMarketMessage = (
  decoded: DecodedMarketMessage,
  callbacks: MarketStreamCallbacks,
): void => {
  if (decoded.channel === "l2Book") {
    callbacks.onMessage(decoded.payload, "l2Book", decoded.meta);
    return;
  }

  if (decoded.channel === "trades") {
    callbacks.onMessage(unwrapTradePayload(decoded.payload), "trades");
    return;
  }

  if (decoded.channel === "allMids") {
    callbacks.onMessage(unwrapTickerPayload(decoded.payload), "allMids");
    return;
  }

  const candles = convertToCandlePayload(decoded.payload);
  if (candles.length > 0) {
    callbacks.onMessage(candles, "candle", decoded.meta);
  }
};

const dispatchMarketMessage = (entry: SharedConnection, parsed: unknown): void => {
  for (const shared of entry.subscriptions.values()) {
    const decoded = decodeMarketWsMessage(parsed, shared.subscription.channel);
    if (decoded.kind !== "market") continue;
    if (!matchesSubscription(shared.subscription, decoded.meta)) continue;
    for (const registration of shared.registrations) {
      deliverMarketMessage(decoded, registration.callbacks);
    }
  }
};

const dispatchMessage = (entry: SharedConnection, raw: string): void => {
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  const control = decodeMarketWsMessage(parsed, "allMids");
  if (control.kind === "control") {
    if (control.type === "ready") {
      forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(true));
    } else if (control.type === "error") {
      const message = control.message ?? "Market stream reported an error";
      forEachRegistration(entry, (callbacks) => {
        callbacks.onConnectionChange?.(false);
        callbacks.onError?.(new Error(message));
      });
    } else if (control.type === "reconnecting") {
      forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(false));
    }
    return;
  }

  dispatchMarketMessage(entry, parsed);
};

function attachSharedListeners(entry: SharedConnection, socket: WebSocket): void {
  socket.addEventListener("open", () => {
    if (entry.cancelled || entry.socket !== socket) return;
    const isReconnect = entry.reconnectAttempt > 0;
    entry.reconnectAttempt = 0;

    // Re-register every active subscription before notifying reconnect handlers.
    for (const shared of entry.subscriptions.values()) {
      sendSubscriptionFrame(socket, "subscribe", shared.subscription);
    }

    forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(true));

    if (isReconnect) {
      forEachRegistration(entry, (callbacks) => callbacks.onReconnect?.());
    }
  });

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    if (entry.cancelled || entry.socket !== socket) return;
    dispatchMessage(entry, event.data);
  });

  socket.addEventListener("close", () => {
    if (entry.socket !== socket) return;
    entry.socket = null;
    if (!entry.cancelled) scheduleReconnect(entry);
    forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(false));
  });

  socket.addEventListener("error", () => {
    if (entry.cancelled || entry.socket !== socket) return;
    forEachRegistration(entry, (callbacks) => {
      callbacks.onConnectionChange?.(false);
      callbacks.onError?.(new Error("Market WebSocket connection failed"));
    });
  });
}

function scheduleReconnect(entry: SharedConnection): void {
  if (entry.cancelled || entry.reconnectTimer !== null) return;
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, entry.reconnectAttempt),
    RECONNECT_MAX_DELAY_MS,
  );
  entry.reconnectAttempt++;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (entry.cancelled) return;
    const socket = new WebSocket(entry.url);
    entry.socket = socket;
    attachSharedListeners(entry, socket);
  }, delay);
}

function acquireConnection(
  subscription: WsMarketSubscription,
  callbacks: MarketStreamCallbacks,
): { release: () => void } {
  let entry = connectionPool.get(MARKET_STREAM_WS_URL);
  if (entry === undefined) {
    entry = {
      url: MARKET_STREAM_WS_URL,
      socket: null,
      subscriptions: new Map(),
      reconnectTimer: null,
      reconnectAttempt: 0,
      cancelled: false,
    };
    connectionPool.set(MARKET_STREAM_WS_URL, entry);
  }

  const connection = entry;
  const key = buildSubscriptionKey(subscription);
  let shared = connection.subscriptions.get(key);
  const isNewSubscription = shared === undefined;
  if (shared === undefined) {
    shared = { subscription, refCount: 0, registrations: new Set() };
    connection.subscriptions.set(key, shared);
  }

  shared.refCount++;
  const registration: SubscriptionRegistration = { callbacks };
  shared.registrations.add(registration);

  const socket = connection.socket;
  if (socket === null) {
    if (connection.reconnectTimer === null) {
      const ws = new WebSocket(connection.url);
      connection.socket = ws;
      attachSharedListeners(connection, ws);
    }
  } else if (socket.readyState === WebSocket.OPEN) {
    if (isNewSubscription) {
      sendSubscriptionFrame(socket, "subscribe", subscription);
    }
    callbacks.onConnectionChange?.(true);
  }

  return {
    release: () => {
      releaseSubscription(connection, key, registration);
    },
  };
}

function releaseSubscription(
  entry: SharedConnection,
  key: string,
  registration: SubscriptionRegistration,
): void {
  const shared = entry.subscriptions.get(key);
  if (shared === undefined || !shared.registrations.delete(registration)) return;

  shared.refCount--;
  if (shared.refCount <= 0) {
    entry.subscriptions.delete(key);

    const socket = entry.socket;
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      sendSubscriptionFrame(socket, "unsubscribe", shared.subscription);
    }

    if (entry.subscriptions.size === 0) {
      entry.cancelled = true;
      if (entry.reconnectTimer !== null) {
        clearTimeout(entry.reconnectTimer);
        entry.reconnectTimer = null;
      }
      entry.socket = null;
      if (socket !== null && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
      connectionPool.delete(entry.url);
    }
  }

  registration.callbacks.onConnectionChange?.(false);
}

// ── Subscription factory ─────────────────────────────────────────────

const createWebSocketSubscription = (
  subscription: WsMarketSubscription,
  callbacks: MarketStreamCallbacks,
): MarketStreamSubscription => {
  const conn = acquireConnection(toWireSubscription(subscription), callbacks);
  let released = false;

  return {
    unsubscribe() {
      if (released) return;
      released = true;
      conn.release();
    },
  };
};

export interface MarketStreamClient {
  subscribe: (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
  ) => Promise<MarketStreamSubscription>;
}

export function createMarketStreamClient(): MarketStreamClient {
  return {
    subscribe: (subscription, callbacks) => {
      // Only default interval for candle channel — l2Book, trades, and allMids
      // must not carry an interval param (the backend rejects l2Book with interval).
      const normalizedSubscription =
        subscription.channel === "candle"
          ? { ...subscription, interval: mapToHLInterval(subscription.interval ?? "1m") }
          : subscription;
      return Promise.resolve(createWebSocketSubscription(normalizedSubscription, callbacks));
    },
  };
}

export type { MarketStreamMeta };
