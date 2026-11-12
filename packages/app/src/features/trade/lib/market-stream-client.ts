import { mapToHLInterval } from "@/core/utils/hyperliquid";
import { API_BASE } from "@/lib/api-base";
import { isPageHidden, onPageResume, onPageVisibilityChange } from "@/lib/page-visibility";
import { normalizeSymbol } from "./symbol";
import { SubscriptionKey } from "./stream-identity";
import type { WsMarketSubscription } from "@0xsignal/shared";
import {
  decodeMarketWsMessage,
  convertToCandlePayload,
  unwrapTickerPayload,
  type MarketStreamMeta,
} from "../utils/market-stream-decoder";

// Re-export shared type for backward-compatible import path
export type { WsMarketSubscription as MarketSubscription } from "@0xsignal/shared";

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
const resolveWsApiBase = (): string => API_BASE;

const WS_API_BASE = resolveWsApiBase();
const MARKET_STREAM_WS_URL = createMarketStreamWsUrl(WS_API_BASE, globalThis.location);

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

/**
 * A socket that produced no inbound frame for this long is presumed dead even
 * when it still reports `readyState === OPEN` (OS sleep, network change). The
 * threshold is 2× the 30s SDK keepalive plus margin.
 */
const STALE_CONNECTION_MS = 65_000;

interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

// ── Subscription identity ────────────────────────────────────────────
// One socket carries every subscription for an endpoint, so frames are
// routed by the identity echoed on the wire, never by socket instance.

type WireMarketSubscription = WsMarketSubscription & { readonly dex?: string };

const toWireSubscription = (subscription: WireMarketSubscription): WireMarketSubscription => {
  const symbol = normalizeSymbol(subscription.symbol ?? "");
  if (subscription.channel === "allMids") {
    const dex = subscription.dex;
    return dex === undefined || dex === "" ? { channel: "allMids" } : { channel: "allMids", dex };
  }
  if (subscription.channel === "l2Book") {
    return {
      channel: "l2Book",
      symbol,
      ...(subscription.nSigFigs != null && { nSigFigs: subscription.nSigFigs }),
    };
  }
  return { channel: "candle", symbol, interval: subscription.interval ?? "1m" };
};

interface MarketStreamSubscription {
  unsubscribe(): void;
}

// ── Shared WebSocket connection pool ─────────────────────────────────
// One socket per server endpoint carries every subscription. Individual
// subscriptions are released by key; the socket closes when none remain.

interface SubscriptionRegistration {
  readonly callbacks: MarketStreamCallbacks;
  /** Newest frame coalesced while the tab is hidden; delivered once on visible. */
  pendingDelivery: (() => void) | null;
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
  /** `Date.now()` of the newest inbound frame; staleness probe on resume. */
  lastInboundAt: number;
  /** Removes every listener from `socket`; replaced whenever the socket is. */
  detachListeners: (() => void) | null;
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

  if (decoded.channel === "allMids") {
    callbacks.onMessage(unwrapTickerPayload(decoded.payload), "allMids");
    return;
  }

  const candles = convertToCandlePayload(decoded.payload);
  if (candles.length > 0) {
    callbacks.onMessage(candles, "candle", decoded.meta);
  }
};

/**
 * A hidden tab keeps decoding, but each registration retains only its newest
 * frame. Retention is bounded by the number of live registrations, and the
 * frame is delivered exactly once when the tab becomes visible.
 */
const deliverOrCoalesce = (
  decoded: DecodedMarketMessage,
  registration: SubscriptionRegistration,
): void => {
  if (isPageHidden()) {
    registration.pendingDelivery = () => {
      deliverMarketMessage(decoded, registration.callbacks);
    };
    return;
  }
  deliverMarketMessage(decoded, registration.callbacks);
};

const flushRetainedFrames = (): void => {
  for (const entry of connectionPool.values()) {
    for (const shared of entry.subscriptions.values()) {
      for (const registration of shared.registrations) {
        const pending = registration.pendingDelivery;
        registration.pendingDelivery = null;
        pending?.();
      }
    }
  }
};

let visibilityWatcherAttached = false;

/** Attach the module-lifetime visibility listener on first socket use. */
const ensureVisibilityWatcher = (): void => {
  if (visibilityWatcherAttached) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  visibilityWatcherAttached = true;
  onPageVisibilityChange((hidden) => {
    if (!hidden) flushRetainedFrames();
  });
};

const dispatchMarketMessage = (entry: SharedConnection, parsed: unknown): void => {
  ensureVisibilityWatcher();

  for (const shared of entry.subscriptions.values()) {
    const decoded = decodeMarketWsMessage(parsed, shared.subscription.channel);
    if (decoded.kind !== "market") continue;
    if (!matchesSubscription(shared.subscription, decoded.meta)) continue;
    for (const registration of shared.registrations) {
      deliverOrCoalesce(decoded, registration);
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

function attachSharedListeners(entry: SharedConnection, socket: WebSocket): () => void {
  const handleOpen = (): void => {
    if (entry.cancelled || entry.socket !== socket) return;
    entry.reconnectAttempt = 0;

    // Re-register every active subscription before notifying reconnect handlers.
    for (const shared of entry.subscriptions.values()) {
      sendSubscriptionFrame(socket, "subscribe", shared.subscription);
    }

    forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(true));
  };

  const handleMessage = (event: MessageEvent<string>): void => {
    if (entry.cancelled || entry.socket !== socket) return;
    // Every inbound frame proves the socket is alive; resume probes compare
    // this stamp instead of trusting a `readyState` that can lie after sleep.
    entry.lastInboundAt = Date.now();
    dispatchMessage(entry, event.data);
  };

  const handleClose = (): void => {
    if (entry.socket !== socket) return;
    entry.socket = null;
    entry.detachListeners = null;
    if (!entry.cancelled) scheduleReconnect(entry);
    forEachRegistration(entry, (callbacks) => callbacks.onConnectionChange?.(false));
  };

  const handleError = (): void => {
    if (entry.cancelled || entry.socket !== socket) return;
    forEachRegistration(entry, (callbacks) => {
      callbacks.onConnectionChange?.(false);
      callbacks.onError?.(new Error("Market WebSocket connection failed"));
    });
  };

  socket.addEventListener("open", handleOpen);
  socket.addEventListener("message", handleMessage);
  socket.addEventListener("close", handleClose);
  socket.addEventListener("error", handleError);

  return () => {
    socket.removeEventListener("open", handleOpen);
    socket.removeEventListener("message", handleMessage);
    socket.removeEventListener("close", handleClose);
    socket.removeEventListener("error", handleError);
  };
}

/** Single connect routine shared by the backoff timer and resume recovery. */
function openConnection(entry: SharedConnection): void {
  const socket = new WebSocket(entry.url);
  entry.socket = socket;
  entry.detachListeners = attachSharedListeners(entry, socket);
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
    openConnection(entry);
  }, delay);
}

/**
 * Drop a socket that stopped producing frames without ever firing `close`
 * (OS sleep, network change) and reopen it immediately. The subscription map
 * is untouched, so refcounts and registrations survive; the `open` handler
 * replays every subscribe frame.
 */
const replaceStaleConnection = (entry: SharedConnection): void => {
  const stale = entry.socket;
  const detach = entry.detachListeners;

  // Clear bookkeeping first: a synthetic `close` from the old socket must not
  // schedule a competing reconnect.
  entry.socket = null;
  entry.detachListeners = null;
  if (entry.reconnectTimer !== null) {
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
  }

  detach?.();
  stale?.close();

  // A freshly opened socket restarts the liveness budget.
  entry.reconnectAttempt = 0;
  entry.lastInboundAt = Date.now();
  openConnection(entry);
};

/** Hard-reconnect every pooled socket whose newest inbound frame is too old. */
const reconnectStaleConnections = (maxAgeMs: number = STALE_CONNECTION_MS): void => {
  const now = Date.now();
  for (const entry of connectionPool.values()) {
    // Entries with no subscriptions are closing; leave them alone.
    if (entry.cancelled || entry.subscriptions.size === 0) continue;
    if (now - entry.lastInboundAt <= maxAgeMs) continue;
    replaceStaleConnection(entry);
  }
};

let resumeReconnectAttached = false;

/**
 * `createMarketStreamClient` is a tab-lifetime singleton, so the resume probe
 * is registered once and never detached. `onPageResume` already spans both
 * `visibilitychange` and `pageshow`.
 */
const ensureResumeReconnect = (): void => {
  if (resumeReconnectAttached) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  resumeReconnectAttached = true;
  onPageResume(() => {
    reconnectStaleConnections();
  });
};

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
      lastInboundAt: Date.now(),
      detachListeners: null,
    };
    connectionPool.set(MARKET_STREAM_WS_URL, entry);
  }

  const connection = entry;
  const key = SubscriptionKey.market(subscription);
  let shared = connection.subscriptions.get(key);
  const isNewSubscription = shared === undefined;
  if (shared === undefined) {
    shared = { subscription, refCount: 0, registrations: new Set() };
    connection.subscriptions.set(key, shared);
  }

  shared.refCount++;
  const registration: SubscriptionRegistration = { callbacks, pendingDelivery: null };
  shared.registrations.add(registration);
  ensureVisibilityWatcher();

  const socket = connection.socket;
  if (socket === null) {
    if (connection.reconnectTimer === null) openConnection(connection);
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

  registration.pendingDelivery = null;
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
  /**
   * Hard-reconnect pooled sockets with no inbound frame within `maxAgeMs`.
   * Optional so delegating wrappers that only implement `subscribe` remain
   * assignable; every client from `createMarketStreamClient` provides it.
   */
  reconnectIfStale?: (maxAgeMs?: number) => void;
}

/** The concrete tab-lifetime client always exposes the liveness probe. */
export type ResilientMarketStreamClient = MarketStreamClient & {
  reconnectIfStale: (maxAgeMs?: number) => void;
};

export function createMarketStreamClient(): ResilientMarketStreamClient {
  ensureResumeReconnect();

  return {
    subscribe: (subscription, callbacks) => {
      // Only default interval for candle channel — l2Book and allMids must not
      // carry an interval param (the backend rejects l2Book with interval).
      const normalizedSubscription =
        subscription.channel === "candle"
          ? { ...subscription, interval: mapToHLInterval(subscription.interval ?? "1m") }
          : subscription;
      return Promise.resolve(createWebSocketSubscription(normalizedSubscription, callbacks));
    },
    reconnectIfStale: (maxAgeMs) => {
      reconnectStaleConnections(maxAgeMs);
    },
  };
}

export type { MarketStreamMeta };
