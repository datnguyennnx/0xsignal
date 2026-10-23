import { useEffect } from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  createMarketStreamClient,
  type MarketStreamClient,
} from "@/features/trade/lib/market-stream-client";
import { processRawL2Levels, type OrderbookData, type L2BookLevel } from "@/core/utils/hyperliquid";
import type { ChartDataPoint } from "@0xsignal/shared";

// ── Constants ──────────────────────────────────────────────────────

/**
 * Maximum number of orderbook levels to keep per side (bids/asks).
 *
 * Hyperliquid returns at most 20 levels per side on both REST and WS.
 * Must be >= VISIBLE_ROWS (20) to ensure client-side aggregation
 * (aggregateLevels) has enough raw levels to produce 20 visible rows
 * after grouping by price bucket.
 */
const MAX_DEPTH = 20;
const MAX_BUFFERED_CANDLES = 10_000;
const EVICT_TARGET = 5_000;
/** Active candle key + the previously viewed ones (bounded LRU). */
const MAX_CANDLE_KEYS = 4;
/** Bounded orderbook state per symbol (active + recently viewed). */
const MAX_ORDERBOOK_SYMBOLS = 6;

// ── Store interface ──────────────────────────────────────────────────

export interface MarketDataState {
  /** Singleton WS client instance (lazy-initialized). */
  marketStreamClient: MarketStreamClient | null;

  // ── Processed display data ─────────────────────────────────────────
  /** Per-symbol processed orderbook display data. */
  orderbookData: Record<string, OrderbookData>;
  /** Per-coin mid prices. */
  allMids: Record<string, number>;
  /** Per-key candle data (key = "symbol:interval"). */
  candleData: Record<string, ChartDataPoint[]>;

  /** Timestamp of last REST snapshot replacement request per symbol. */
  orderbookReplaceRequested: Record<string, number>;

  // ── Actions ────────────────────────────────────────────────────────

  initializeStreamClient: () => MarketStreamClient;

  /** Apply an L2 book snapshot (replaces all levels for symbol). */
  applyOrderbookSnapshot: (symbol: string, levels: [L2BookLevel[], L2BookLevel[]]) => void;

  /** Apply an L2 book delta (patches existing levels). */
  applyOrderbookDelta: (
    symbol: string,
    changedBids: readonly L2BookLevel[],
    changedAsks: readonly L2BookLevel[],
  ) => void;

  /** Signal that orderbook state should be replaced via REST snapshot. */
  requestOrderbookReplace: (symbol: string) => void;

  /** Bulk-replace all mid prices. */
  setAllMids: (mids: Record<string, number>) => void;

  /** Append candle data for a symbol+interval identity. */
  appendCandles: (key: string, candles: readonly ChartDataPoint[]) => void;

  /** Overwrite candle data (for historical load). */
  setCandleData: (key: string, candles: ChartDataPoint[]) => void;
}

// ── Module-level L2 raw state (Maps for O(1) delta application) ─────
// Kept outside Zustand to avoid serializing Maps through state updates.

const rawOrderbookState = new Map<
  string,
  { bids: Map<string, L2BookLevel>; asks: Map<string, L2BookLevel> }
>();
const dirtySymbols = new Set<string>();
let flushRafId: number | null = null;

/** Bounded LRU order for candle keys and orderbook symbols. */
const candleKeyOrder: string[] = [];
const orderbookSymbolOrder: string[] = [];
/** Symbols with at least one mounted `useOrderbookData` consumer. */
const activeOrderbookSubscribers = new Map<string, number>();

function symbolFromCandleKey(key: string): string {
  const separator = key.indexOf(":");
  return separator === -1 ? key : key.slice(0, separator);
}

function cancelScheduledFlush(): void {
  if (flushRafId === null) return;
  cancelAnimationFrame(flushRafId);
  flushRafId = null;
  dirtySymbols.clear();
}

function evictOrderbookSymbol(symbol: string): void {
  rawOrderbookState.delete(symbol);
  dirtySymbols.delete(symbol);

  const orderIndex = orderbookSymbolOrder.indexOf(symbol);
  if (orderIndex !== -1) orderbookSymbolOrder.splice(orderIndex, 1);

  useMarketDataStore.setState((state) => {
    if (!(symbol in state.orderbookData) && !(symbol in state.orderbookReplaceRequested)) {
      return state;
    }
    const orderbookData = { ...state.orderbookData };
    const orderbookReplaceRequested = { ...state.orderbookReplaceRequested };
    delete orderbookData[symbol];
    delete orderbookReplaceRequested[symbol];
    return { orderbookData, orderbookReplaceRequested };
  });
}

function touchOrderbookSymbol(symbol: string): void {
  const existingIndex = orderbookSymbolOrder.indexOf(symbol);
  if (existingIndex !== -1) orderbookSymbolOrder.splice(existingIndex, 1);
  orderbookSymbolOrder.push(symbol);

  while (orderbookSymbolOrder.length > MAX_ORDERBOOK_SYMBOLS) {
    const victim = orderbookSymbolOrder.find(
      (candidate) => candidate !== symbol && !activeOrderbookSubscribers.has(candidate),
    );
    if (victim === undefined) {
      // Everything still tracked is on screen; drop the oldest bookkeeping entry.
      orderbookSymbolOrder.shift();
      continue;
    }
    evictOrderbookSymbol(victim);
  }
}

function touchCandleKey(key: string): string[] {
  const existingIndex = candleKeyOrder.indexOf(key);
  if (existingIndex !== -1) candleKeyOrder.splice(existingIndex, 1);
  candleKeyOrder.push(key);
  return candleKeyOrder.splice(0, Math.max(0, candleKeyOrder.length - MAX_CANDLE_KEYS));
}

/** Drop orderbook state for symbols whose candle keys were evicted. */
function evictRetiredSymbols(evictedKeys: readonly string[]): void {
  if (evictedKeys.length === 0) return;

  const liveSymbols = new Set(candleKeyOrder.map((key) => symbolFromCandleKey(key)));
  for (const key of evictedKeys) {
    const symbol = symbolFromCandleKey(key);
    if (liveSymbols.has(symbol)) continue;
    if (activeOrderbookSubscribers.has(symbol)) continue;
    evictOrderbookSymbol(symbol);
  }
}

function getOrCreateRawState(symbol: string) {
  let state = rawOrderbookState.get(symbol);
  if (!state) {
    state = { bids: new Map(), asks: new Map() };
    rawOrderbookState.set(symbol, state);
  }
  touchOrderbookSymbol(symbol);
  return state;
}

function scheduleFlush() {
  if (flushRafId !== null) return;
  flushRafId = requestAnimationFrame(() => {
    flushRafId = null;
    if (dirtySymbols.size === 0) return;

    const updates: Record<string, OrderbookData> = {};
    for (const symbol of dirtySymbols) {
      const raw = rawOrderbookState.get(symbol);
      if (raw) {
        const rawBids = Array.from(raw.bids.values());
        const rawAsks = Array.from(raw.asks.values());
        updates[symbol] = processRawL2Levels(rawBids, rawAsks, MAX_DEPTH);
      }
    }
    dirtySymbols.clear();

    // Always propagate dirty symbols to the store. The rAF throttle
    // already limits updates to ~60fps, so additional diffing is
    // unnecessary and risks skipping genuine size changes at the same
    // top-of-book price, causing stale orderbook display.
    useMarketDataStore.setState((state) => {
      const current = state.orderbookData;
      const merged: Record<string, OrderbookData> = {};
      let anyChanged = false;
      for (const [symbol, data] of Object.entries(updates)) {
        const existing = current[symbol];
        if (
          existing === undefined ||
          existing.bids.length !== data.bids.length ||
          existing.asks.length !== data.asks.length ||
          data.bids.length === 0 ||
          data.asks.length === 0 ||
          existing.bids[0]?.price !== data.bids[0]?.price ||
          existing.bids[0]?.size !== data.bids[0]?.size ||
          existing.asks[0]?.price !== data.asks[0]?.price ||
          existing.asks[0]?.size !== data.asks[0]?.size
        ) {
          merged[symbol] = data;
          anyChanged = true;
        }
      }
      return anyChanged ? { orderbookData: { ...current, ...merged } } : state;
    });
  });
}

// ── Store ────────────────────────────────────────────────────────────

export const useMarketDataStore = create<MarketDataState>()(
  subscribeWithSelector((set, get) => ({
    marketStreamClient: null,
    orderbookData: {},
    allMids: {},
    candleData: {},
    orderbookReplaceRequested: {},

    // ── Initialize WS client singleton ──────────────────────────
    initializeStreamClient: () => {
      const existing = get().marketStreamClient;
      if (existing) return existing;
      const client = createMarketStreamClient();
      set({ marketStreamClient: client });
      return client;
    },

    // ── L2 Snapshot ─────────────────────────────────────────────
    applyOrderbookSnapshot: (symbol, levels) => {
      const raw = getOrCreateRawState(symbol);
      raw.bids.clear();
      raw.asks.clear();
      for (const l of levels[0] ?? []) raw.bids.set(l.px, l);
      for (const l of levels[1] ?? []) raw.asks.set(l.px, l);
      dirtySymbols.add(symbol);
      scheduleFlush();
    },

    // ── L2 Delta ────────────────────────────────────────────────
    applyOrderbookDelta: (symbol, changedBids, changedAsks) => {
      const raw = getOrCreateRawState(symbol);
      let changed = false;

      for (const change of changedBids) {
        if (change.sz === "0" || change.sz === "0.0") {
          if (raw.bids.delete(change.px)) changed = true;
        } else {
          // Skip update if size hasn't changed — avoids unnecessary flushes
          const old = raw.bids.get(change.px);
          if (old?.sz !== change.sz) {
            raw.bids.set(change.px, change);
            changed = true;
          }
        }
      }

      for (const change of changedAsks) {
        if (change.sz === "0" || change.sz === "0.0") {
          if (raw.asks.delete(change.px)) changed = true;
        } else {
          const old = raw.asks.get(change.px);
          if (old?.sz !== change.sz) {
            raw.asks.set(change.px, change);
            changed = true;
          }
        }
      }

      if (!changed) return;

      dirtySymbols.add(symbol);
      scheduleFlush();
    },

    // ── Request replace ─────────────────────────────────────────
    requestOrderbookReplace: (symbol) => {
      touchOrderbookSymbol(symbol);
      set((state) => ({
        orderbookReplaceRequested: {
          ...state.orderbookReplaceRequested,
          [symbol]: Date.now(),
        },
      }));
    },

    // ── All mids ────────────────────────────────────────────────
    setAllMids: (mids) => {
      set((state) => {
        // Shallow diff: only update if values actually changed.
        // Prevents unnecessary re-renders when allMids ticks with same prices.
        const current = state.allMids;
        const keys = Object.keys(mids);
        if (keys.length === Object.keys(current).length) {
          let changed = false;
          for (let i = 0; i < keys.length; i++) {
            if (current[keys[i]] !== mids[keys[i]]) {
              changed = true;
              break;
            }
          }
          if (!changed) return state;
        } else {
          // Key set differs — definitely changed
          return { allMids: mids };
        }
        return { allMids: mids };
      });
    },

    // ── Candle append (O(n) merge of time-sorted arrays) ────────
    appendCandles: (key, candles) => {
      const evictedKeys = touchCandleKey(key);
      set((state) => {
        const existing = state.candleData[key] ?? [];
        const result: ChartDataPoint[] = [];
        let i = 0;
        let j = 0;
        while (i < existing.length && j < candles.length) {
          if (existing[i].time < candles[j].time) {
            result.push(existing[i]);
            i++;
          } else if (existing[i].time > candles[j].time) {
            result.push(candles[j]);
            j++;
          } else {
            // Same timestamp — new data wins
            result.push(candles[j]);
            i++;
            j++;
          }
        }
        const lastTime = () => result.at(-1)?.time;
        while (i < existing.length && existing[i].time !== lastTime()) result.push(existing[i++]);
        while (j < candles.length && candles[j].time !== lastTime()) result.push(candles[j++]);

        // Evict oldest if beyond MAX_BUFFERED_CANDLES
        const evicted =
          result.length > MAX_BUFFERED_CANDLES
            ? result.slice(result.length - EVICT_TARGET)
            : result;

        const candleData = { ...state.candleData, [key]: evicted };
        for (const evictedKey of evictedKeys) delete candleData[evictedKey];
        return { candleData };
      });
      evictRetiredSymbols(evictedKeys);
    },

    // ── Set candle data (for historical loads) ──────────────────
    setCandleData: (key, candles) => {
      const evictedKeys = touchCandleKey(key);
      set((state) => {
        const candleData = { ...state.candleData, [key]: candles };
        for (const evictedKey of evictedKeys) delete candleData[evictedKey];
        return { candleData };
      });
      evictRetiredSymbols(evictedKeys);
    },
  })),
);

// ── Field-scoped selector hooks ──────────────────────────────────────
// Components subscribe to only the slice they render.

/** Subscribe to processed orderbook data for a single symbol. */
export const useOrderbookData = (symbol: string): OrderbookData | undefined => {
  const data = useMarketDataStore((s) => s.orderbookData[symbol]);

  useEffect(() => {
    activeOrderbookSubscribers.set(symbol, (activeOrderbookSubscribers.get(symbol) ?? 0) + 1);
    return () => {
      const remaining = (activeOrderbookSubscribers.get(symbol) ?? 1) - 1;
      if (remaining > 0) {
        activeOrderbookSubscribers.set(symbol, remaining);
        return;
      }
      activeOrderbookSubscribers.delete(symbol);
      if (activeOrderbookSubscribers.size === 0) cancelScheduledFlush();
    };
  }, [symbol]);

  return data;
};

/** Subscribe to all mid prices. */
export const useAllMidsData = (): Record<string, number> => useMarketDataStore((s) => s.allMids);

/** Subscribe to candle data for a given key (e.g. "BTC:1m"). */
export const useCandleData = (key: string): ChartDataPoint[] | undefined =>
  useMarketDataStore((s) => s.candleData[key]);

/** Check if a given symbol has requested a REST snapshot replacement. */
export const useOrderbookReplaceRequested = (symbol: string): number | undefined =>
  useMarketDataStore((s) => s.orderbookReplaceRequested[symbol]);
