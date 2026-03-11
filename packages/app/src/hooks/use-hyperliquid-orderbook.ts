import { useEffect, useRef, useState, useCallback } from "react";

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
  depth: number;
}

export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  spreadPercent: number;
}

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const MAX_LEVELS = 20; // Giảm xuống để performance tốt hơn
const SIG_FIGS = 5;

interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

interface WsMessage {
  channel: string;
  data: {
    coin: string;
    time: number;
    levels: [L2BookLevel[], L2BookLevel[]];
  };
}

export function useHyperliquidOrderbook(symbol: string, enabled: boolean = true) {
  const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const dataRef = useRef<OrderbookData | null>(null); // Store latest data
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Xử lý orderbook data - KHÔNG aggregate vì data đã aggregate từ Hyperliquid
  const processData = useCallback((levels: [L2BookLevel[], L2BookLevel[]]): OrderbookData => {
    const [rawBids, rawAsks] = levels;

    // Process bids - sort descending by price
    let bidTotal = 0;
    const bids: OrderbookLevel[] = rawBids
      .sort((a, b) => parseFloat(b.px) - parseFloat(a.px))
      .map((level) => {
        const price = parseFloat(level.px);
        const size = parseFloat(level.sz);
        bidTotal += size;
        return { price, size, total: bidTotal, depth: 0 };
      });

    // Process asks - sort ascending by price
    let askTotal = 0;
    const asks: OrderbookLevel[] = rawAsks
      .sort((a, b) => parseFloat(a.px) - parseFloat(b.px))
      .map((level) => {
        const price = parseFloat(level.px);
        const size = parseFloat(level.sz);
        askTotal += size;
        return { price, size, total: askTotal, depth: 0 };
      });

    // Calculate depth percentages
    const maxTotal = Math.max(bidTotal, askTotal, 1);
    bids.forEach((b) => (b.depth = (b.total / maxTotal) * 100));
    asks.forEach((a) => (a.depth = (a.total / maxTotal) * 100));

    // Calculate spread
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

    return { bids, asks, spread, spreadPercent };
  }, []);

  // Throttled update - dùng dataRef để tránh duplicate updates
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    const minInterval = 33; // ~30fps cho orderbook

    const executeUpdate = () => {
      if (dataRef.current) {
        setOrderbook(dataRef.current);
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

    // Strict Mode fix: clear pending disconnect
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return; // Connection exists, reuse it
      }
    }

    // Idempotent: avoid duplicate connections
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
      setError(null);
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: {
            type: "l2Book",
            coin: coin,
            nLevels: MAX_LEVELS,
            nSigFigs: SIG_FIGS,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        if (msg.channel === "l2Book" && msg.data?.levels) {
          // Update dataRef và schedule render
          dataRef.current = processData(msg.data.levels);
          scheduleUpdate();
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onerror = () => {
      setError("Connection failed");
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      disconnectTimeoutRef.current = setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        wsRef.current = null;
        dataRef.current = null;
      }, 0);
    };
  }, [symbol, enabled, processData, scheduleUpdate]);

  return { orderbook, isConnected, error };
}
