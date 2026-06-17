import { mapToHLInterval } from "@/core/utils/hyperliquid";
import { resolveApiBase } from "@/lib/api-base";
import { normalizeSymbol } from "./symbol";
import type { WsMarketSubscription, WsMarketInterval } from "@0xsignal/shared";
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

const API_BASE = resolveApiBase(configuredApiUrl, import.meta.env.DEV);
const MARKET_STREAM_WS_URL = createMarketStreamWsUrl(API_BASE, globalThis.location);

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

export const buildMarketStreamSearchParams = (
  subscription: WsMarketSubscription,
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("channel", subscription.channel);

  if (subscription.symbol) {
    params.set("symbol", normalizeSymbol(subscription.symbol));
  }
  if (subscription.interval) {
    params.set("interval", subscription.interval);
  }
  if (subscription.nSigFigs !== undefined) {
    const sigFigs = String(subscription.nSigFigs);
    params.set("nSigFigs", sigFigs);
    params.set("depth", sigFigs);
  }

  return params;
};

export interface MarketStreamSubscription {
  unsubscribe(): void;
}

export interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  /** Fires when the WebSocket successfully reconnects after a disconnect. */
  onReconnect?: () => void;
}

export interface MarketStreamClient {
  subscribe: (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
  ) => Promise<MarketStreamSubscription>;
}

const createWebSocketSubscription = (
  subscription: WsMarketSubscription,
  callbacks: MarketStreamCallbacks,
): MarketStreamSubscription => {
  let cancelled = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;

  const params = buildMarketStreamSearchParams(subscription);
  const streamUrl = `${MARKET_STREAM_WS_URL}?${params.toString()}`;

  const scheduleReconnect = () => {
    if (cancelled || reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt),
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectAttempt += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (cancelled) return;
    socket = new WebSocket(streamUrl);

    socket.addEventListener("open", () => {
      const isReconnect = reconnectAttempt > 0;
      reconnectAttempt = 0;
      callbacks.onConnectionChange?.(true);
      if (isReconnect) {
        callbacks.onReconnect?.();
      }
    });

    socket.addEventListener("message", (event: MessageEvent<string>) => {
      const decoded = decodeMarketWsMessage(event.data, subscription.channel);

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
    });

    socket.addEventListener("error", () => {
      callbacks.onConnectionChange?.(false);
      callbacks.onError?.(new Error("Market WebSocket connection failed"));
    });

    socket.addEventListener("close", () => {
      callbacks.onConnectionChange?.(false);
      scheduleReconnect();
    });
  };

  connect();

  return {
    unsubscribe() {
      cancelled = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }

      socket = null;
      callbacks.onConnectionChange?.(false);
    },
  };
};

export function createMarketStreamClient(): MarketStreamClient {
  return {
    subscribe: async (subscription, callbacks) => {
      const interval = subscription.interval ?? "1m";
      const normalizedInterval: WsMarketInterval = mapToHLInterval(interval);
      return createWebSocketSubscription(
        {
          ...subscription,
          interval: normalizedInterval,
        },
        callbacks,
      );
    },
  };
}

export type { MarketStreamMeta };
