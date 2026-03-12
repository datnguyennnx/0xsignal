import { useEffect, useRef, useCallback } from "react";

export const WS_URL = "wss://api.hyperliquid.xyz/ws";
export const API_INFO_URL = "https://api-ui.hyperliquid.xyz/info";

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;
const STRICT_MODE_CLEANUP_DELAY = 50;

export interface HyperliquidSubscription {
  type: string;
  [key: string]: unknown;
}

export interface UseHyperliquidWsOptions {
  subscription: HyperliquidSubscription | null;
  onMessage: (data: unknown, channel: string) => void;
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

interface WsState {
  ws: WebSocket | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  isMounted: boolean;
  subscription: HyperliquidSubscription | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return upper.endsWith("USDT") ? upper.slice(0, -4) : upper;
}

export function useHyperliquidWs({
  subscription,
  onMessage,
  enabled = true,
  onConnectionChange,
  onError,
}: UseHyperliquidWsOptions) {
  const stateRef = useRef<WsState>({
    ws: null,
    heartbeatTimer: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    isMounted: true,
    subscription: null,
    cleanupTimer: null,
  });

  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
  }, [onMessage, onConnectionChange, onError]);

  const subscriptionKey = subscription ? JSON.stringify(subscription) : null;

  const stopHeartbeat = useCallback(() => {
    const state = stateRef.current;
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }, []);

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      const state = stateRef.current;
      stopHeartbeat();
      state.heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: "ping" }));
        }
      }, HEARTBEAT_INTERVAL);
    },
    [stopHeartbeat]
  );

  const clearReconnectTimer = useCallback(() => {
    const state = stateRef.current;
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    const state = stateRef.current;
    stopHeartbeat();
    clearReconnectTimer();
    if (state.ws) {
      const ws = state.ws;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "cleanup");
      }
      state.ws = null;
    }
    state.subscription = null;
  }, [stopHeartbeat, clearReconnectTimer]);

  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    const state = stateRef.current;
    if (!state.isMounted || !subscriptionKey) return;

    const parsedSub = JSON.parse(subscriptionKey) as HyperliquidSubscription;

    if (
      state.ws?.readyState === WebSocket.OPEN &&
      JSON.stringify(state.subscription) === subscriptionKey
    ) {
      return;
    }

    closeWs();

    const ws = new WebSocket(WS_URL);
    state.ws = ws;

    ws.onopen = () => {
      if (!state.isMounted) {
        ws.close();
        return;
      }
      state.reconnectAttempts = 0;
      onConnectionChangeRef.current?.(true);
      startHeartbeat(ws);
      state.subscription = parsedSub;
      ws.send(JSON.stringify({ method: "subscribe", subscription: parsedSub }));
    };

    ws.onmessage = (event) => {
      if (!state.isMounted) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === "pong" || msg.channel === "subscriptionResponse") return;
        onMessageRef.current(msg.data, msg.channel);
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      if (!state.isMounted) return;
      onErrorRef.current?.(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      if (!state.isMounted) return;
      stopHeartbeat();
      onConnectionChangeRef.current?.(false);

      if (state.reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, state.reconnectAttempts),
          RECONNECT_MAX_DELAY
        );
        state.reconnectAttempts++;
        state.reconnectTimer = setTimeout(() => {
          if (state.isMounted) connectRef.current?.();
        }, delay);
      }
    };
  }, [subscriptionKey, closeWs, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const resubscribe = useCallback((newSubscription: HyperliquidSubscription) => {
    const state = stateRef.current;
    if (state.ws?.readyState === WebSocket.OPEN) {
      if (state.subscription) {
        state.ws.send(JSON.stringify({ method: "unsubscribe", subscription: state.subscription }));
      }
      state.subscription = newSubscription;
      state.ws.send(JSON.stringify({ method: "subscribe", subscription: newSubscription }));
    }
  }, []);

  useEffect(() => {
    const state = stateRef.current;

    if (!enabled || !subscriptionKey) {
      closeWs();
      onConnectionChangeRef.current?.(false);
      return;
    }

    // Cancel pending cleanup from React Strict Mode remount
    if (state.cleanupTimer) {
      clearTimeout(state.cleanupTimer);
      state.cleanupTimer = null;
    }

    state.isMounted = true;
    connect();

    return () => {
      // Delay cleanup to survive Strict Mode double-mount
      state.cleanupTimer = setTimeout(() => {
        state.isMounted = false;
        closeWs();
      }, STRICT_MODE_CLEANUP_DELAY);
    };
  }, [enabled, subscriptionKey, connect, closeWs]);

  return { resubscribe };
}
