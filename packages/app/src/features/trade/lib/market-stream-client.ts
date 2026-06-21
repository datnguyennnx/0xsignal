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
export const createMarketStreamWsUrl = (
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
  if (configuredApiUrl) {
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

export const buildMarketStreamSearchParams = (
  subscription: WsMarketSubscription,
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("channel", subscription.channel);

  if (subscription.channel === "l2Book") {
    if (subscription.symbol) {
      params.set("symbol", normalizeSymbol(subscription.symbol));
    }
    if (subscription.nSigFigs != null) {
      params.set("nSigFigs", String(subscription.nSigFigs));
    }
    params.set("maxDepth", "20");
  } else if (subscription.channel === "candle") {
    if (subscription.symbol) {
      params.set("symbol", normalizeSymbol(subscription.symbol));
    }
    if (subscription.interval) {
      params.set("interval", subscription.interval);
    }
  } else if (subscription.channel === "trades") {
    if (subscription.symbol) {
      params.set("symbol", normalizeSymbol(subscription.symbol));
    }
  }
  // allMids: channel only, no extra params

  return params;
};

export interface MarketStreamSubscription {
  unsubscribe(): void;
}

// ── Shared WebSocket connection pool ─────────────────────────────────
// Multiple subscribers to the same URL share one underlying WebSocket.
// The connection is closed when the last subscriber leaves.

interface SharedConnection {
  socket: WebSocket | null;
  refCount: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
  cancelled: boolean;
  /** Called on reconnect (open after close) */
  onReconnectCallbacks: Set<() => void>;
  /** Message handlers that survive socket reconnects */
  messageHandlers: Set<(data: string) => void>;
  /** Open/connection-change handlers that survive socket reconnects */
  openHandlers: Set<() => void>;
  /** Error handlers that survive socket reconnects */
  errorHandlers: Set<() => void>;
  /** Close handlers that survive socket reconnects */
  closeHandlers: Set<() => void>;
}

const connectionPool = new Map<string, SharedConnection>();

function attachSharedListeners(entry: SharedConnection, socket: WebSocket): void {
  socket.addEventListener("open", () => {
    const isReconnect = entry.reconnectAttempt > 0;
    entry.reconnectAttempt = 0;
    // Notify open handlers (connection change)
    entry.openHandlers.forEach((cb) => cb());
    // Notify reconnect callbacks if this is a reconnect
    if (isReconnect) {
      entry.onReconnectCallbacks.forEach((cb) => cb());
    }
  });

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    entry.messageHandlers.forEach((handler) => handler(event.data));
  });

  socket.addEventListener("close", () => {
    if (!entry.cancelled) scheduleReconnect(entry);
    entry.closeHandlers.forEach((cb) => cb());
  });

  socket.addEventListener("error", () => {
    // Error event is followed by close, reconnect is handled there
    entry.errorHandlers.forEach((cb) => cb());
  });
}

function scheduleReconnect(entry: SharedConnection): void {
  if (entry.cancelled || entry.reconnectTimer) return;
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, entry.reconnectAttempt),
    RECONNECT_MAX_DELAY_MS,
  );
  entry.reconnectAttempt++;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (entry.cancelled) return;
    const ws = new WebSocket(urlForEntry(entry)!);
    entry.socket = ws;
    attachSharedListeners(entry, ws);
  }, delay);
}

/** Retrieve the URL from the connection pool key for a given entry. */
function urlForEntry(entry: SharedConnection): string | null {
  for (const [url, e] of connectionPool) {
    if (e === entry) return url;
  }
  return null;
}

function acquireConnection(url: string): {
  addMessageHandler: (handler: (data: string) => void) => void;
  removeMessageHandler: (handler: (data: string) => void) => void;
  addOpenHandler: (handler: () => void) => void;
  removeOpenHandler: (handler: () => void) => void;
  addErrorHandler: (handler: () => void) => void;
  removeErrorHandler: (handler: () => void) => void;
  addCloseHandler: (handler: () => void) => void;
  removeCloseHandler: (handler: () => void) => void;
  release: () => void;
  onReconnect: (cb: () => void) => void;
  /** Whether the socket is currently open */
  isConnected: () => boolean;
} {
  const existingEntry = connectionPool.get(url);

  if (existingEntry) {
    existingEntry.refCount++;
    return createConnectionHandle(url, existingEntry);
  }

  // Create new connection
  const onReconnectCallbacks = new Set<() => void>();
  const messageHandlers = new Set<(data: string) => void>();
  const openHandlers = new Set<() => void>();
  const errorHandlers = new Set<() => void>();
  const closeHandlers = new Set<() => void>();

  const entryData: SharedConnection = {
    socket: null,
    refCount: 1,
    reconnectTimer: null,
    reconnectAttempt: 0,
    cancelled: false,
    onReconnectCallbacks,
    messageHandlers,
    openHandlers,
    errorHandlers,
    closeHandlers,
  };

  connectionPool.set(url, entryData);

  const ws = new WebSocket(url);
  entryData.socket = ws;
  attachSharedListeners(entryData, ws);

  return createConnectionHandle(url, entryData);
}

function createConnectionHandle(
  url: string,
  entry: SharedConnection,
): ReturnType<typeof acquireConnection> {
  return {
    addMessageHandler: (handler: (data: string) => void) => {
      entry.messageHandlers.add(handler);
    },
    removeMessageHandler: (handler: (data: string) => void) => {
      entry.messageHandlers.delete(handler);
    },
    addOpenHandler: (handler: () => void) => {
      entry.openHandlers.add(handler);
    },
    removeOpenHandler: (handler: () => void) => {
      entry.openHandlers.delete(handler);
    },
    addErrorHandler: (handler: () => void) => {
      entry.errorHandlers.add(handler);
    },
    removeErrorHandler: (handler: () => void) => {
      entry.errorHandlers.delete(handler);
    },
    addCloseHandler: (handler: () => void) => {
      entry.closeHandlers.add(handler);
    },
    removeCloseHandler: (handler: () => void) => {
      entry.closeHandlers.delete(handler);
    },
    release: () => releaseConnection(url),
    onReconnect: (cb: () => void) => entry.onReconnectCallbacks.add(cb),
    isConnected: () => entry.socket?.readyState === WebSocket.OPEN,
  };
}

function releaseConnection(url: string): void {
  const entry = connectionPool.get(url);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.cancelled = true;
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
    if (entry.socket && entry.socket.readyState <= WebSocket.OPEN) {
      entry.socket.close();
    }
    connectionPool.delete(url);
  }
}

// ── MarketStreamCallbacks ────────────────────────────────────────────

export interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  /** Fires when the WebSocket successfully reconnects after a disconnect. */
  onReconnect?: () => void;
}

// ── Subscription factory ─────────────────────────────────────────────

const createWebSocketSubscription = (
  subscription: WsMarketSubscription,
  callbacks: MarketStreamCallbacks,
): MarketStreamSubscription => {
  let cancelled = false;

  const params = buildMarketStreamSearchParams(subscription);
  const streamUrl = `${MARKET_STREAM_WS_URL}?${params.toString()}`;

  const conn = acquireConnection(streamUrl);

  // Register reconnect handler — fires when socket reconnects after close
  conn.onReconnect(() => {
    if (!cancelled) {
      callbacks.onReconnect?.();
    }
  });

  // Handlers are registered with the connection pool, not directly on a socket.
  // This ensures they survive reconnects — the pool re-attaches them on each new socket.
  const handleOpen = () => {
    if (!cancelled) {
      callbacks.onConnectionChange?.(true);
    }
  };

  const handleMessage = (rawData: string) => {
    if (cancelled) return;
    const decoded = decodeMarketWsMessage(rawData, subscription.channel);

    if (decoded.kind === "ignore") return;

    if (decoded.kind === "control") {
      if (decoded.type === "ready") {
        callbacks.onConnectionChange?.(true);
        return;
      }
      if (decoded.type === "error") {
        callbacks.onConnectionChange?.(false);
        callbacks.onError?.(new Error(decoded.message ?? "Market stream reported an error"));
      } else if (decoded.type === "reconnecting") {
        callbacks.onConnectionChange?.(false);
      }
      return;
    }

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

    if (decoded.channel === "candle") {
      const candles = convertToCandlePayload(decoded.payload);
      if (candles.length > 0) {
        callbacks.onMessage(candles, "candle", decoded.meta);
      }
    }
  };

  const handleError = () => {
    if (!cancelled) {
      callbacks.onConnectionChange?.(false);
      callbacks.onError?.(new Error("Market WebSocket connection failed"));
    }
  };

  const handleClose = () => {
    if (!cancelled) {
      callbacks.onConnectionChange?.(false);
    }
  };

  // Register handlers with the pool — survives reconnects
  conn.addMessageHandler(handleMessage);
  conn.addOpenHandler(handleOpen);
  conn.addErrorHandler(handleError);
  conn.addCloseHandler(handleClose);

  // If socket is already open, fire immediately (handlers registered above)
  if (conn.isConnected()) {
    callbacks.onConnectionChange?.(true);
  }

  return {
    unsubscribe() {
      if (cancelled) return;
      cancelled = true;
      conn.removeMessageHandler(handleMessage);
      conn.removeOpenHandler(handleOpen);
      conn.removeErrorHandler(handleError);
      conn.removeCloseHandler(handleClose);
      conn.release();
      callbacks.onConnectionChange?.(false);
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
    subscribe: async (subscription, callbacks) => {
      // Only default interval for candle channel — l2Book, trades, and allMids
      // must not carry an interval param (the backend rejects l2Book with interval).
      const normalizedSubscription =
        subscription.channel === "candle"
          ? { ...subscription, interval: mapToHLInterval(subscription.interval ?? "1m") }
          : subscription;
      return createWebSocketSubscription(normalizedSubscription, callbacks);
    },
  };
}

export type { MarketStreamMeta };
