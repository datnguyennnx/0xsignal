import { useEffect, useRef, useState } from "react";
import type { ChartDataPoint } from "@/domain/chart/types";

interface UseChartWebSocketOptions {
  symbol: string;
  enabled?: boolean;
}

interface WebSocketMessage {
  type: "connected" | "subscribed" | "unsubscribed" | "data" | "pong";
  symbol?: string;
  data?: ChartDataPoint;
  timestamp?: number;
  clientId?: string;
}

export function useChartWebSocket({ symbol, enabled = true }: UseChartWebSocketOptions) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const isCleanedUpRef = useRef(false);

  useEffect(() => {
    if (!enabled || !symbol) return;

    isCleanedUpRef.current = false;

    const connect = () => {
      if (isCleanedUpRef.current) return;

      try {
        const wsUrl =
          import.meta.env.MODE === "production"
            ? `wss://${window.location.host}/ws/chart`
            : "ws://localhost:9006/ws/chart";

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCleanedUpRef.current) {
            ws.close();
            return;
          }

          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          ws.send(JSON.stringify({ type: "subscribe", symbol: symbol.toUpperCase() }));
        };

        ws.onmessage = (event) => {
          if (isCleanedUpRef.current) return;

          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            if (message.type === "data" && message.data) {
              setData((prev) => {
                const newPoint = message.data!;
                const existingIndex = prev.findIndex((p) => p.time === newPoint.time);

                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = newPoint;
                  return updated;
                } else {
                  return [...prev, newPoint].slice(-500);
                }
              });
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          if (!isCleanedUpRef.current) {
            setError("Connection error");
          }
        };

        ws.onclose = () => {
          if (isCleanedUpRef.current) return;

          setIsConnected(false);
          wsRef.current = null;

          if (enabled && reconnectAttemptsRef.current < 10) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current += 1;

            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isCleanedUpRef.current) {
                connect();
              }
            }, delay);
          }
        };
      } catch {
        if (!isCleanedUpRef.current) {
          setError("Failed to connect");
        }
      }
    };

    connect();

    return () => {
      isCleanedUpRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        const readyState = ws.readyState;
        wsRef.current = null;

        if (readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "unsubscribe" }));
          } catch {
            // Ignore send errors during cleanup
          }
          setTimeout(() => {
            try {
              ws.close();
            } catch {
              // Ignore close errors during cleanup
            }
          }, 250);
        } else if (readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }

      setData([]);
      setIsConnected(false);
    };
  }, [symbol, enabled]);

  return {
    data,
    isConnected,
    error,
  };
}
