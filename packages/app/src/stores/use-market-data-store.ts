import { useEffect } from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MarketStreamClient } from "@/features/trade/lib/market-stream-client";
import { createBrowserMarketStreamClient } from "@/features/trade/lib/hl-market-stream";
import { replaceBookLevels } from "@/features/trade/lib/orderbook-book";
import { isPageHidden, onPageVisibilityChange } from "@/lib/page-visibility";
import {
  MAX_BOOK_DEPTH,
  processRawL2Levels,
  type DisplayOrderbookLevel,
  type OrderbookData,
  type L2BookLevel,
} from "@/core/utils/hyperliquid";
import type { ChartDataPoint } from "@0xsignal/shared";

// ── Constants ──────────────────────────────────────────────────────

const MAX_BUFFERED_CANDLES = 10_000;
const EVICT_TARGET = 5_000;
/** Active candle key + the previously viewed ones (bounded LRU). */
const MAX_CANDLE_KEYS = 4;
/** Bounded orderbook state per symbol (active + recently viewed). */
const MAX_ORDERBOOK_SYMBOLS = 6;

/** A level is removed when its parsed size is zero, never by string equality. */
const isZeroLevelSize = (size: string): boolean => Number(size) <= 0;

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

  /** Append live candle data for a symbol+interval identity. */
  appendCandles: (key: string, candles: readonly ChartDataPoint[]) => void;

  /** Merge a history page; existing bars win ties so live frames never regress. */
  mergeHistoryCandles: (key: string, candles: readonly ChartDataPoint[]) => void;
}

// ── Module-level L2 raw state (Maps for O(1) delta application) ─────
// Kept outside Zustand to avoid serializing Maps through state updates.

const rawOrderbookState = new Map<
  string,
  { bids: Map<string, L2BookLevel>; asks: Map<string, L2BookLevel> }
>();
const dirtySymbols = new Set<string>();
let flushRafId: number | null = null;

/** Newest `allMids` frame waiting for the next paint; frames are full snapshots. */
let pendingMids: Record<string, number> | null = null;
let midsRafId: number | null = null;

/** Bounded LRU order for candle keys and orderbook symbols. */
const candleKeyOrder: string[] = [];
const orderbookSymbolOrder: string[] = [];
/** Symbols with at least one mounted `useOrderbookData` consumer. */
const activeOrderbookSubscribers = new Map<string, number>();

/** Ref-count one mounted `useOrderbookData` consumer so eviction skips it. */
function retainOrderbookSubscriber(symbol: string): void {
  activeOrderbookSubscribers.set(symbol, (activeOrderbookSubscribers.get(symbol) ?? 0) + 1);
}

/** Drop one consumer; the last unmount releases the pending orderbook frame. */
function releaseOrderbookSubscriber(symbol: string): void {
  const remaining = (activeOrderbookSubscribers.get(symbol) ?? 1) - 1;
  if (remaining > 0) {
    activeOrderbookSubscribers.set(symbol, remaining);
    return;
  }
  activeOrderbookSubscribers.delete(symbol);
  if (activeOrderbookSubscribers.size === 0) cancelScheduledFlush();
}

/** Internal bookkeeping for tests and diagnostics; not part of the app API. */
export const marketDataStoreInternals = {
  retainOrderbookSubscriber,
  releaseOrderbookSubscriber,
  rawOrderbookSymbolCount: (): number => rawOrderbookState.size,
  trackedOrderbookSymbols: (): string[] => [...orderbookSymbolOrder],
} as const;

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
    if (!(symbol in state.orderbookData)) return state;
    const orderbookData = { ...state.orderbookData };
    delete orderbookData[symbol];
    return { orderbookData };
  });
}

function touchOrderbookSymbol(symbol: string): void {
  const existingIndex = orderbookSymbolOrder.indexOf(symbol);
  if (existingIndex !== -1) orderbookSymbolOrder.splice(existingIndex, 1);
  orderbookSymbolOrder.push(symbol);

  while (orderbookSymbolOrder.length > MAX_ORDERBOOK_SYMBOLS) {
    // Oldest first, never the key just touched and never a live consumer.
    const victim = orderbookSymbolOrder.find(
      (candidate) => candidate !== symbol && !activeOrderbookSubscribers.has(candidate),
    );
    if (victim !== undefined) {
      evictOrderbookSymbol(victim);
      continue;
    }
    // Every tracked book is on screen. Dropping the newcomer keeps the tracked
    // set and `rawOrderbookState` in lockstep; shifting bookkeeping without
    // deleting state is what orphaned raw books past the cap.
    if (!activeOrderbookSubscribers.has(symbol)) evictOrderbookSymbol(symbol);
    break;
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
    if (symbol === "" || liveSymbols.has(symbol)) continue;
    // Orderbook state is keyed `${symbol}:${precision}`, so a bare symbol never
    // matches; sweep every precision tracked for the retired symbol.
    const prefix = `${symbol}:`;
    const retired = orderbookSymbolOrder.filter((candidate) => candidate.startsWith(prefix));
    for (const orderbookKey of retired) {
      if (activeOrderbookSubscribers.has(orderbookKey)) continue;
      evictOrderbookSymbol(orderbookKey);
    }
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

/**
 * Compares the visible window level by level. A top-of-book-only check misses
 * frames that move deeper levels, and those frames are never replayed.
 */
function sameLevels(
  a: readonly DisplayOrderbookLevel[],
  b: readonly DisplayOrderbookLevel[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.price !== b[i]?.price || a[i]?.size !== b[i]?.size) return false;
  }
  return true;
}

/** Commit every dirty symbol in one store write; shared by rAF and the visible flush. */
function flushDirtySymbols(): void {
  if (dirtySymbols.size === 0) return;

  const updates: Record<string, OrderbookData> = {};
  for (const symbol of dirtySymbols) {
    const raw = rawOrderbookState.get(symbol);
    if (raw) {
      const rawBids = Array.from(raw.bids.values());
      const rawAsks = Array.from(raw.asks.values());
      updates[symbol] = processRawL2Levels(rawBids, rawAsks, MAX_BOOK_DEPTH);
    }
  }
  dirtySymbols.clear();

  // The full-window comparison keeps the rAF conflation useful: a dirty
  // symbol is only written when its visible book actually moved, so
  // consumers skip re-renders on frames that produce identical data.
  useMarketDataStore.setState((state) => {
    const current = state.orderbookData;
    const merged: Record<string, OrderbookData> = {};
    let anyChanged = false;
    for (const [symbol, data] of Object.entries(updates)) {
      const existing = current[symbol];
      if (
        existing !== undefined &&
        sameLevels(existing.bids, data.bids) &&
        sameLevels(existing.asks, data.asks)
      ) {
        continue;
      }
      merged[symbol] = data;
      anyChanged = true;
    }
    return anyChanged ? { orderbookData: { ...current, ...merged } } : state;
  });
}

function scheduleFlush() {
  ensureVisibilityWatcher();
  // A hidden tab does not paint, so scheduling is deferred to the visible flush.
  if (isPageHidden()) return;
  if (flushRafId !== null) return;
  flushRafId = requestAnimationFrame(() => {
    flushRafId = null;
    flushDirtySymbols();
  });
}

/**
 * O(n) merge of two time-sorted arrays, emitting each timestamp once. `preferExisting`
 * keeps the bar already stored on a tie; otherwise the incoming bar wins.
 */
function mergeSortedBars(
  existing: readonly ChartDataPoint[],
  incoming: readonly ChartDataPoint[],
  preferExisting: boolean,
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  const push = (item: ChartDataPoint): void => {
    const previous = result.at(-1);
    if (previous !== undefined && previous.time === item.time) {
      if (!preferExisting) result[result.length - 1] = item;
      return;
    }
    result.push(item);
  };

  let i = 0;
  let j = 0;
  while (i < existing.length && j < incoming.length) {
    const left = existing[i];
    const right = incoming[j];
    if (left.time < right.time) {
      push(left);
      i++;
    } else if (left.time > right.time) {
      push(right);
      j++;
    } else {
      push(preferExisting ? left : right);
      i++;
      j++;
    }
  }
  while (i < existing.length) push(existing[i++]);
  while (j < incoming.length) push(incoming[j++]);
  return result;
}

/**
 * Apply the newest mid map, skipping the write when no value or key changed.
 * Every `allMids` frame is a full snapshot, so the latest frame wins.
 */
function applyAllMids(mids: Record<string, number>): void {
  useMarketDataStore.setState((state) => {
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
    }
    return { allMids: mids };
  });
}

/** Apply the newest pending mid snapshot, if any. */
function commitPendingMids(): void {
  const next = pendingMids;
  pendingMids = null;
  if (next !== null) applyAllMids(next);
}

/** Coalesce every `allMids` write in one frame into a single store commit. */
function scheduleAllMids(mids: Record<string, number>): void {
  pendingMids = mids;
  ensureVisibilityWatcher();
  // Hidden tabs keep only the newest snapshot and commit it on visible.
  if (isPageHidden()) return;
  if (typeof requestAnimationFrame !== "function") {
    commitPendingMids();
    return;
  }
  if (midsRafId !== null) return;
  midsRafId = requestAnimationFrame(() => {
    midsRafId = null;
    commitPendingMids();
  });
}

/** Cancel a queued `allMids` frame and drop the pending snapshot (idempotent). */
export function cancelMidsFlush(): void {
  if (midsRafId !== null) {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(midsRafId);
    midsRafId = null;
  }
  pendingMids = null;
}

/** One flush of everything that accumulated while the tab was hidden. */
function flushPendingOnVisible(): void {
  flushDirtySymbols();
  if (midsRafId !== null) {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(midsRafId);
    midsRafId = null;
  }
  commitPendingMids();
}

let visibilityWatcherAttached = false;
let visibilityHidden = isPageHidden();

/**
 * One module-lifetime listener, never per render. Hiding cancels scheduled
 * work; becoming visible flushes the accumulated state exactly once. Repeated
 * notifications for the same state are ignored so pending frames survive.
 */
function ensureVisibilityWatcher(): void {
  if (visibilityWatcherAttached) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  visibilityWatcherAttached = true;
  visibilityHidden = isPageHidden();
  onPageVisibilityChange((hidden) => {
    if (hidden === visibilityHidden) return;
    visibilityHidden = hidden;
    if (hidden) {
      cancelScheduledFlush();
      cancelMidsFlush();
      return;
    }
    flushPendingOnVisible();
  });
}

// One module-level listener: registering per render would leak a handler per mount.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", cancelMidsFlush);
}

/** Write one key and apply the candle LRU eviction, bounding the buffer. */
function writeCandleKey(
  current: Record<string, ChartDataPoint[]>,
  key: string,
  bars: ChartDataPoint[],
  evictedKeys: readonly string[],
): Record<string, ChartDataPoint[]> {
  const bounded =
    bars.length > MAX_BUFFERED_CANDLES ? bars.slice(bars.length - EVICT_TARGET) : bars;
  const candleData = { ...current, [key]: bounded };
  for (const evictedKey of evictedKeys) delete candleData[evictedKey];
  return candleData;
}

// ── Store ────────────────────────────────────────────────────────────

export const useMarketDataStore = create<MarketDataState>()(
  subscribeWithSelector((set, get) => ({
    marketStreamClient: null,
    orderbookData: {},
    allMids: {},
    candleData: {},

    // ── Initialize WS client singleton ──────────────────────────
    initializeStreamClient: () => {
      const existing = get().marketStreamClient;
      if (existing) return existing;
      const client = createBrowserMarketStreamClient();
      set({ marketStreamClient: client });
      return client;
    },

    // ── L2 Snapshot ─────────────────────────────────────────────
    applyOrderbookSnapshot: (symbol, levels) => {
      const raw = getOrCreateRawState(symbol);
      replaceBookLevels(raw.bids, levels[0] ?? []);
      replaceBookLevels(raw.asks, levels[1] ?? []);
      dirtySymbols.add(symbol);
      scheduleFlush();
    },

    // ── L2 Delta ────────────────────────────────────────────────
    applyOrderbookDelta: (symbol, changedBids, changedAsks) => {
      const raw = getOrCreateRawState(symbol);
      let changed = false;

      for (const change of changedBids) {
        if (isZeroLevelSize(change.sz)) {
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
        if (isZeroLevelSize(change.sz)) {
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
    },

    // ── All mids ────────────────────────────────────────────────
    setAllMids: (mids) => {
      scheduleAllMids(mids);
    },

    // ── Candle append (O(n) merge of time-sorted arrays) ────────
    appendCandles: (key, candles) => {
      const evictedKeys = touchCandleKey(key);
      set((state) => ({
        candleData: writeCandleKey(
          state.candleData,
          key,
          mergeSortedBars(state.candleData[key] ?? [], candles, false),
          evictedKeys,
        ),
      }));
      evictRetiredSymbols(evictedKeys);
    },

    // ── History merge: stored bars win ties, live frames are never regressed ──
    mergeHistoryCandles: (key, candles) => {
      const evictedKeys = touchCandleKey(key);
      set((state) => ({
        candleData: writeCandleKey(
          state.candleData,
          key,
          mergeSortedBars(state.candleData[key] ?? [], candles, true),
          evictedKeys,
        ),
      }));
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
    retainOrderbookSubscriber(symbol);
    return () => {
      releaseOrderbookSubscriber(symbol);
    };
  }, [symbol]);

  return data;
};

/** Subscribe to one coin's mid; a tick for another coin never re-renders the caller. */
export const useMidPrice = (coin: string): number | undefined =>
  useMarketDataStore((s) => (coin === "" ? undefined : s.allMids[coin]));

/** Subscribe to candle data for a given key (e.g. "BTC:1m"). */
export const useCandleData = (key: string): ChartDataPoint[] | undefined =>
  useMarketDataStore((s) => s.candleData[key]);
