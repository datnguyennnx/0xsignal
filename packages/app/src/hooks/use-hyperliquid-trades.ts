import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "wss://api.hyperliquid.xyz/ws";

export interface Trade {
  id: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  time: number;
  isLiquidation: boolean;
}

interface WsTrade {
  coin: string;
  side: "B" | "A";
  px: string;
  sz: string;
  time: number;
  hash: string;
}

interface WsMessage {
  channel: string;
  data: any;
}

const MAX_TRADES = 100;
const UI_TRADES = 50;

export function useHyperliquidTrades(symbol: string, enabled: boolean = true) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Use refs to survive React Strict Mode
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<Trade[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const tradesRef = useRef<Trade[]>([]);
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttled update using requestAnimationFrame
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    const minInterval = 16; // 60fps

    const executeUpdate = () => {
      if (bufferRef.current.length > 0) {
        const newTrades = bufferRef.current;
        bufferRef.current = [];

        tradesRef.current = [...newTrades, ...tradesRef.current]
          .sort((a, b) => b.time - a.time)
          .slice(0, MAX_TRADES);

        setTrades(tradesRef.current.slice(0, UI_TRADES));
        lastUpdateRef.current = performance.now();
      }
      rafRef.current = null;
    };

    if (timeSinceLastUpdate >= minInterval) {
      executeUpdate();
    } else {
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(executeUpdate, minInterval - timeSinceLastUpdate);
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !symbol) return;

    // React Strict Mode fix
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }
    }

    // Idempotent check
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const coin = symbol.toUpperCase().replace(/USDT$/, "");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;

        if (msg.channel === "trades" && Array.isArray(msg.data)) {
          const newTrades: Trade[] = msg.data
            .filter((t: WsTrade) => t.coin === coin)
            .map((t: WsTrade) => ({
              id: t.hash,
              price: parseFloat(t.px),
              size: parseFloat(t.sz),
              side: t.side === "B" ? "buy" : "sell",
              time: t.time,
              isLiquidation: false,
            }));

          if (newTrades.length > 0) {
            bufferRef.current.push(...newTrades);
            scheduleUpdate();
          }
        }
      } catch (err) {
        console.error("WS Parse error", err);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => {
      disconnectTimeoutRef.current = setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }, 0);
    };
  }, [symbol, enabled, scheduleUpdate]);

  return { trades, isConnected };
}
