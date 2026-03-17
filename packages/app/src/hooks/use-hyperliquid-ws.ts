import { useEffect, useRef, useCallback, useState } from "react";

export const WS_URL = "wss://api.hyperliquid.xyz/ws";
export const API_INFO_URL = "https://api-ui.hyperliquid.xyz/info";

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;

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
  currentSubscription: HyperliquidSubscription | null;
  pendingSubscription: HyperliquidSubscription | null;
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
  const [isConnected, setIsConnected] = useState(false);

  const stateRef = useRef<WsState>({
    ws: null,
    heartbeatTimer: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    isMounted: true,
    currentSubscription: null,
    pendingSubscription: null,
  });

  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
  }, [onMessage, onConnectionChange, onError]);

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
    state.currentSubscription = null;
    setIsConnected(false);
  }, [stopHeartbeat, clearReconnectTimer]);

  const subscribe = useCallback((ws: WebSocket, sub: HyperliquidSubscription) => {
    ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
  }, []);

  const unsubscribe = useCallback((ws: WebSocket, sub: HyperliquidSubscription) => {
    ws.send(JSON.stringify({ method: "unsubscribe", subscription: sub }));
  }, []);

  const subscriptionKey = subscription ? JSON.stringify(subscription) : null;

  const connect = useCallback(() => {
    const state = stateRef.current;
    if (!state.isMounted || !subscriptionKey) return;

    const parsedSub = JSON.parse(subscriptionKey) as HyperliquidSubscription;

    if (
      state.ws?.readyState === WebSocket.OPEN &&
      JSON.stringify(state.currentSubscription) === subscriptionKey
    ) {
      return;
    }

    const ws = state.ws;
    const needsNewConnection = !ws || ws.readyState !== WebSocket.OPEN;

    if (needsNewConnection) {
      if (ws) {
        ws.close();
      }

      const newWs = new WebSocket(WS_URL);
      state.ws = newWs;

      newWs.onopen = () => {
        if (!state.isMounted) {
          newWs.close();
          return;
        }
        state.reconnectAttempts = 0;
        setIsConnected(true);
        onConnectionChangeRef.current?.(true);
        startHeartbeat(newWs);
        state.currentSubscription = parsedSub;
        subscribe(newWs, parsedSub);
      };

      newWs.onmessage = (event) => {
        if (!state.isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.channel === "pong" || msg.channel === "subscriptionResponse") return;
          onMessageRef.current(msg.data, msg.channel);
        } catch {
          /* ignore parse errors */
        }
      };

      newWs.onerror = () => {
        if (!state.isMounted) return;
        onErrorRef.current?.(new Error("WebSocket connection error"));
      };

      newWs.onclose = () => {
        if (!state.isMounted) return;
        stopHeartbeat();
        setIsConnected(false);
        onConnectionChangeRef.current?.(false);

        if (state.reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_BASE_DELAY * Math.pow(2, state.reconnectAttempts),
            RECONNECT_MAX_DELAY
          );
          state.reconnectAttempts++;
          state.reconnectTimer = setTimeout(() => {
            if (state.isMounted && state.pendingSubscription) {
              connect();
            }
          }, delay);
        }
      };
    } else {
      const prevSub = state.currentSubscription;
      if (prevSub) {
        unsubscribe(ws, prevSub);
      }
      state.currentSubscription = parsedSub;
      subscribe(ws, parsedSub);
    }
  }, [subscriptionKey, subscribe, unsubscribe, startHeartbeat, stopHeartbeat]);

  const resubscribe = useCallback(
    (newSubscription: HyperliquidSubscription) => {
      const state = stateRef.current;
      state.pendingSubscription = newSubscription;

      if (state.ws?.readyState === WebSocket.OPEN) {
        const prevSub = state.currentSubscription;
        if (prevSub) {
          unsubscribe(state.ws, prevSub);
        }
        state.currentSubscription = newSubscription;
        subscribe(state.ws, newSubscription);
      }
    },
    [subscribe, unsubscribe]
  );

  useEffect(() => {
    const state = stateRef.current;
    if (!enabled || !subscriptionKey) {
      closeWs();
      return;
    }

    state.isMounted = true;
    connect();

    return () => {
      state.isMounted = false;
    };
  }, [enabled, subscriptionKey]);

  return {
    resubscribe,
    isConnected,
    subscription: subscription ? { ...subscription } : null,
  };
}
