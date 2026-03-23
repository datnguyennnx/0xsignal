/**
 * @overview Depth Chart Canonical Frame Hook
 *
 * Implements a "stable frame" logic for market depth visualization.
 * It manages the reconciliation of live orderbook snapshots into a renderable, stable window (viewport).
 *
 * @mechanism
 * - filters and buckets raw L2 levels based on centerPrice and halfSpan.
 * - ensures that the "canonical" representation of the book persists even as individual ticks change.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type OrderbookData,
  useHyperliquidOrderbook,
} from "@/features/perp/hooks/use-hyperliquid-orderbook";
import { useOptionalL2BookNSigFigs } from "@/features/perp/contexts/l2-book-nsig-figs-context";
import { type DepthLevel, type DepthRenderableBounds } from "../constants";
import { getDepthMaxTotal } from "../lib/depth-canvas-mapping";
import { getMinHalfSpanValue } from "../lib/depth-visible-range";
import { resolveDepthChartCoverage } from "./use-depth-chart-coverage";
import { materializeDepthFrame } from "./use-depth-chart-materialization";

export interface UseDepthChartCanonicalFrameProps {
  symbol: string;
  enabled?: boolean;
  stableCenterPrice: number | null;
  desiredHalfSpan: number | null;
  committedHalfSpan: number | null;
  viewportWidth: number;
}

export interface DepthChartCanonicalFrame {
  centerPrice: number | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
  bounds: DepthRenderableBounds | null;
  liveMidPrice: number | null;
  bestBid: number;
  bestAsk: number;
  committedHalfSpan: number | null;
  defaultHalfSpan: number | null;
  minHalfSpan: number | null;
  maxHalfSpan: number | null;
  tickSize: number;
  spread: number;
  spreadPercent: number;
  dataSource: "micro" | "none";
  hasRenderableFrame: boolean;
  isInitialLoading: boolean;
  isStale: boolean;
  isCoveragePending: boolean;
  coverageReady: boolean;
  desiredHalfSpan: number | null;
  actualRenderableHalfSpan: number | null;
  canCommitDesiredSpan: boolean;
  maxTotal: number;
  renderVersion: number;
  activeSigFigs: number;
  isConnected: boolean;
  error: string | null;
}

interface StableFrameCache {
  lastRenderableFrame: DepthChartCanonicalFrame | null;
  lastBucketStep: number | null;
  renderVersion: number;
}

const MIN_STEP_FALLBACK = getMinHalfSpanValue();

function createEmptyFrame(): DepthChartCanonicalFrame {
  return {
    centerPrice: null,
    bids: [],
    asks: [],
    bounds: null,
    liveMidPrice: null,
    bestBid: 0,
    bestAsk: 0,
    committedHalfSpan: null,
    defaultHalfSpan: null,
    minHalfSpan: null,
    maxHalfSpan: null,
    tickSize: MIN_STEP_FALLBACK,
    spread: 0,
    spreadPercent: 0,
    dataSource: "none",
    hasRenderableFrame: false,
    isInitialLoading: true,
    isStale: false,
    isCoveragePending: false,
    coverageReady: false,
    desiredHalfSpan: null,
    actualRenderableHalfSpan: null,
    canCommitDesiredSpan: false,
    maxTotal: 1,
    renderVersion: 0,
    activeSigFigs: 5,
    isConnected: false,
    error: null,
  };
}

function createEmptyStableCache(): StableFrameCache {
  return { lastRenderableFrame: null, lastBucketStep: null, renderVersion: 0 };
}

function rebuildDepthLevels(
  levels: Array<{ price: number; size: number }>,
  side: "bids" | "asks"
): DepthLevel[] {
  const sorted = [...levels].sort((a, b) =>
    side === "bids" ? b.price - a.price : a.price - b.price
  );
  let total = 0;
  return sorted.map((level) => ({
    price: level.price,
    size: level.size,
    total: (total += level.size),
  }));
}

function resolveStableMaxTotal(previousMaxTotal: number, incomingMaxTotal: number): number {
  if (!Number.isFinite(previousMaxTotal) || previousMaxTotal <= 0) {
    return Math.max(1, incomingMaxTotal);
  }
  if (!Number.isFinite(incomingMaxTotal) || incomingMaxTotal <= 0) {
    return Math.max(1, previousMaxTotal);
  }
  if (incomingMaxTotal >= previousMaxTotal) {
    return incomingMaxTotal;
  }
  // Keep Y-scale stable when updates only change near levels.
  return Math.max(incomingMaxTotal, previousMaxTotal * 0.95);
}

function buildFallbackFrame(
  fallbackFrame: DepthChartCanonicalFrame | null,
  marketBook?: OrderbookData | null,
  overrides?: Partial<DepthChartCanonicalFrame>
): DepthChartCanonicalFrame {
  if (!fallbackFrame) {
    return {
      ...createEmptyFrame(),
      centerPrice: marketBook?.midPrice ?? null,
      liveMidPrice: marketBook?.midPrice ?? null,
      bestBid: marketBook?.bids[0]?.price ?? 0,
      bestAsk: marketBook?.asks[0]?.price ?? 0,
      spread: marketBook?.spread ?? 0,
      spreadPercent: marketBook?.spreadPercent ?? 0,
      ...overrides,
    };
  }

  const hasRenderableFallback =
    fallbackFrame.bids.length > 0 && fallbackFrame.asks.length > 0 && fallbackFrame.bounds !== null;

  return {
    ...fallbackFrame,
    centerPrice: marketBook?.midPrice ?? fallbackFrame.centerPrice,
    liveMidPrice: marketBook?.midPrice ?? fallbackFrame.liveMidPrice,
    bestBid: marketBook?.bids[0]?.price ?? fallbackFrame.bestBid,
    bestAsk: marketBook?.asks[0]?.price ?? fallbackFrame.bestAsk,
    spread: marketBook?.spread ?? fallbackFrame.spread,
    spreadPercent: marketBook?.spreadPercent ?? fallbackFrame.spreadPercent,
    hasRenderableFrame: hasRenderableFallback,
    isInitialLoading: !hasRenderableFallback,
    ...overrides,
  };
}

function computeCoverageHalfSpan(book: OrderbookData | null, centerPrice: number): number {
  if (
    !book ||
    !book.bids.length ||
    !book.asks.length ||
    !Number.isFinite(centerPrice) ||
    centerPrice <= 0
  ) {
    return 0;
  }
  const farBid = book.bids[book.bids.length - 1]?.price ?? centerPrice;
  const farAsk = book.asks[book.asks.length - 1]?.price ?? centerPrice;
  return Math.max(0, Math.min(centerPrice - farBid, farAsk - centerPrice));
}

function toBandKey(price: number, step: number): number {
  return Math.round(price / Math.max(step, MIN_STEP_FALLBACK));
}

function mergeVisibleLevels({
  previous,
  incoming,
  side,
  centerPrice,
  halfSpan,
  spread,
  step,
}: {
  previous: DepthLevel[];
  incoming: DepthLevel[];
  side: "bids" | "asks";
  centerPrice: number;
  halfSpan: number;
  spread: number;
  step: number;
}): DepthLevel[] {
  const previousByBand = new Map<number, DepthLevel>();
  const incomingByBand = new Map<number, DepthLevel>();
  for (const level of previous) {
    previousByBand.set(toBandKey(level.price, step), level);
  }
  for (const level of incoming) {
    incomingByBand.set(toBandKey(level.price, step), level);
  }

  const nearDistance = Math.max(spread * 12, halfSpan * 0.14, step * 2);
  const midDistance = Math.max(spread * 42, halfSpan * 0.56, nearDistance * 2);
  const keys = new Set<number>([...previousByBand.keys(), ...incomingByBand.keys()]);
  const merged: Array<{ price: number; size: number }> = [];

  for (const key of keys) {
    const prev = previousByBand.get(key) ?? null;
    const next = incomingByBand.get(key) ?? null;
    const price = next?.price ?? prev?.price;
    if (!price) {
      continue;
    }
    const distance = Math.abs(price - centerPrice);
    const zone = distance <= nearDistance ? "near" : distance <= midDistance ? "mid" : "far";
    let selected: DepthLevel | null = null;

    if (zone === "near") {
      selected = next ?? prev;
    } else if (zone === "mid") {
      if (!prev) {
        selected = next;
      } else if (!next) {
        selected = prev;
      } else {
        const relativeSizeDiff = Math.abs(next.size - prev.size) / Math.max(prev.size, 1e-9);
        selected = relativeSizeDiff >= 0.32 ? next : prev;
      }
    } else {
      selected = prev ?? next;
    }

    if (!selected || selected.size <= 0) {
      continue;
    }
    merged.push({ price: selected.price, size: selected.size });
  }

  return rebuildDepthLevels(merged, side);
}

function sanitizeMergedSideLevels({
  levels,
  side,
  bestBid,
  bestAsk,
  minPrice,
  maxPrice,
}: {
  levels: DepthLevel[];
  side: "bids" | "asks";
  bestBid: number;
  bestAsk: number;
  minPrice: number;
  maxPrice: number;
}): DepthLevel[] {
  const filtered = levels.filter((level) => {
    if (!Number.isFinite(level.price) || !Number.isFinite(level.size) || level.size <= 0) {
      return false;
    }
    if (level.price < minPrice || level.price > maxPrice) {
      return false;
    }
    if (side === "bids") {
      if (bestBid > 0 && level.price > bestBid) {
        return false;
      }
      if (bestAsk > 0 && level.price >= bestAsk) {
        return false;
      }
      return true;
    }
    if (bestAsk > 0 && level.price < bestAsk) {
      return false;
    }
    if (bestBid > 0 && level.price <= bestBid) {
      return false;
    }
    return true;
  });

  return rebuildDepthLevels(
    filtered.map((level) => ({ price: level.price, size: level.size })),
    side
  );
}

export function useDepthChartCanonicalFrame({
  symbol,
  stableCenterPrice,
  desiredHalfSpan,
  committedHalfSpan,
  viewportWidth,
  enabled = true,
}: UseDepthChartCanonicalFrameProps): DepthChartCanonicalFrame {
  const targetHalfSpan = desiredHalfSpan ?? committedHalfSpan ?? null;
  const l2BookSig = useOptionalL2BookNSigFigs();
  const orderbookOptions = useMemo(() => {
    if (l2BookSig != null) {
      return {
        adaptiveNSigFigs: false as const,
        controlledNSigFigs: l2BookSig.nSigFigs,
      };
    }
    return {
      adaptiveNSigFigs: true as const,
      targetHalfSpan,
      centerPrice: stableCenterPrice,
    };
  }, [l2BookSig, targetHalfSpan, stableCenterPrice]);

  const { fineBook, coarseBookBySigFigs, orderbook, isConnected, error, activeSigFigs } =
    useHyperliquidOrderbook(symbol, enabled, orderbookOptions);
  const stableCacheRef = useRef<StableFrameCache>(createEmptyStableCache());
  const [frameState, setFrameState] = useState<DepthChartCanonicalFrame>(() => createEmptyFrame());

  useEffect(() => {
    stableCacheRef.current = createEmptyStableCache();
    setFrameState(createEmptyFrame());
  }, [symbol]);

  useEffect(() => {
    const stableCache = stableCacheRef.current;
    const marketBook = fineBook ?? orderbook;
    const liveMidPrice =
      marketBook?.midPrice ?? stableCache.lastRenderableFrame?.liveMidPrice ?? null;

    if (!marketBook || !liveMidPrice || !Number.isFinite(liveMidPrice) || liveMidPrice <= 0) {
      setFrameState(
        buildFallbackFrame(stableCache.lastRenderableFrame, marketBook, {
          isStale: true,
          isCoveragePending: false,
          coverageReady: false,
          desiredHalfSpan,
          canCommitDesiredSpan: false,
          actualRenderableHalfSpan:
            stableCache.lastRenderableFrame?.actualRenderableHalfSpan ?? null,
          isConnected,
          activeSigFigs,
          error,
        })
      );
      return;
    }

    const renderCenterPrice = stableCenterPrice ?? liveMidPrice;
    const previousCommitted =
      committedHalfSpan ??
      stableCache.lastRenderableFrame?.actualRenderableHalfSpan ??
      stableCache.lastRenderableFrame?.defaultHalfSpan;
    const inferredDesired =
      desiredHalfSpan ??
      previousCommitted ??
      Math.max(marketBook.spread * 3, renderCenterPrice * 0.00018, MIN_STEP_FALLBACK);
    const coverage = resolveDepthChartCoverage({
      centerPrice: renderCenterPrice,
      requestedHalfSpan: inferredDesired,
      microBook: fineBook,
      defaultSourceBook: marketBook,
    });
    const coarseEntries = Object.entries(coarseBookBySigFigs)
      .map(([sig, book]) => ({ sigFigs: Number(sig), book }))
      .filter(
        (entry) =>
          Number.isFinite(entry.sigFigs) && entry.book.bids.length > 0 && entry.book.asks.length > 0
      )
      .sort((a, b) => b.sigFigs - a.sigFigs);
    const fineCoverage = computeCoverageHalfSpan(fineBook, renderCenterPrice);
    const bestCoarseForDesired =
      coarseEntries.find(
        (entry) => computeCoverageHalfSpan(entry.book, renderCenterPrice) >= inferredDesired
      ) ?? null;
    const bestCoverageSpan = Math.max(
      fineCoverage,
      ...coarseEntries.map((entry) => computeCoverageHalfSpan(entry.book, renderCenterPrice))
    );
    const coverageReady = fineCoverage >= inferredDesired || Boolean(bestCoarseForDesired);
    const selectedBook =
      fineCoverage >= inferredDesired
        ? fineBook
        : (bestCoarseForDesired?.book ?? fineBook ?? marketBook);

    if (!selectedBook) {
      setFrameState(
        buildFallbackFrame(stableCache.lastRenderableFrame, marketBook, {
          isStale: true,
          isCoveragePending: false,
          coverageReady: false,
          desiredHalfSpan: inferredDesired,
          canCommitDesiredSpan: false,
          isConnected,
          activeSigFigs,
          error,
        })
      );
      return;
    }

    const minHalfSpan = coverage.minHalfSpan;
    const maxHalfSpan =
      Math.max(coverage.maxHalfSpan ?? 0, bestCoverageSpan || 0) || coverage.maxHalfSpan;
    const defaultHalfSpan = coverage.defaultHalfSpan;
    const tickSize = coverage.tickSize;

    if (minHalfSpan === null || maxHalfSpan === null || defaultHalfSpan === null) {
      setFrameState(
        buildFallbackFrame(stableCache.lastRenderableFrame, marketBook, {
          isStale: true,
          isCoveragePending: false,
          coverageReady: false,
          desiredHalfSpan: inferredDesired,
          canCommitDesiredSpan: false,
          isConnected,
          activeSigFigs,
          error,
        })
      );
      return;
    }

    const clampedDesired = Math.min(Math.max(inferredDesired, minHalfSpan), maxHalfSpan);
    const safeCommitted = Math.min(
      Math.max(previousCommitted ?? defaultHalfSpan, minHalfSpan),
      maxHalfSpan
    );
    const renderHalfSpan = coverageReady ? clampedDesired : safeCommitted;
    const canCommitDesiredSpan = coverageReady && Math.abs(renderHalfSpan - clampedDesired) <= 1e-9;

    const materialized = materializeDepthFrame({
      book: selectedBook,
      centerPrice: renderCenterPrice,
      halfSpan: renderHalfSpan,
      viewportWidth,
      bestBid: marketBook.bids[0]?.price || coverage.bestBid || 0,
      bestAsk: marketBook.asks[0]?.price || coverage.bestAsk || 0,
      tickSize,
      previousBucketStep: stableCache.lastBucketStep,
    });

    if (!materialized.hasRenderableFrame || !materialized.bounds) {
      setFrameState(
        buildFallbackFrame(stableCache.lastRenderableFrame, marketBook, {
          isStale: true,
          isCoveragePending: !coverageReady,
          coverageReady,
          desiredHalfSpan: clampedDesired,
          actualRenderableHalfSpan: renderHalfSpan,
          canCommitDesiredSpan: false,
          isConnected,
          activeSigFigs,
          error,
        })
      );
      return;
    }

    const previousFrame = stableCache.lastRenderableFrame;

    const mergedBids = previousFrame?.bounds
      ? mergeVisibleLevels({
          previous: previousFrame.bids,
          incoming: materialized.bids,
          side: "bids",
          centerPrice: renderCenterPrice,
          halfSpan: renderHalfSpan,
          spread: marketBook.spread,
          step: materialized.bucketStep,
        })
      : materialized.bids;
    const mergedAsks = previousFrame?.bounds
      ? mergeVisibleLevels({
          previous: previousFrame.asks,
          incoming: materialized.asks,
          side: "asks",
          centerPrice: renderCenterPrice,
          halfSpan: renderHalfSpan,
          spread: marketBook.spread,
          step: materialized.bucketStep,
        })
      : materialized.asks;
    const bestBid = marketBook.bids[0]?.price || coverage.bestBid || 0;
    const bestAsk = marketBook.asks[0]?.price || coverage.bestAsk || 0;
    const sanitizedBids = sanitizeMergedSideLevels({
      levels: mergedBids,
      side: "bids",
      bestBid,
      bestAsk,
      minPrice: materialized.bounds.minPrice,
      maxPrice: materialized.bounds.maxPrice,
    });
    const sanitizedAsks = sanitizeMergedSideLevels({
      levels: mergedAsks,
      side: "asks",
      bestBid,
      bestAsk,
      minPrice: materialized.bounds.minPrice,
      maxPrice: materialized.bounds.maxPrice,
    });
    const stableBids = sanitizedBids.length > 0 ? sanitizedBids : materialized.bids;
    const stableAsks = sanitizedAsks.length > 0 ? sanitizedAsks : materialized.asks;
    const mergedMaxTotal = getDepthMaxTotal(stableBids, stableAsks);
    const stableMaxTotal = resolveStableMaxTotal(
      previousFrame?.maxTotal ?? mergedMaxTotal,
      mergedMaxTotal
    );

    const sameAsPrevious =
      previousFrame &&
      previousFrame.bounds?.minPrice === materialized.bounds.minPrice &&
      previousFrame.bounds?.maxPrice === materialized.bounds.maxPrice &&
      previousFrame.bids.length === stableBids.length &&
      previousFrame.asks.length === stableAsks.length &&
      previousFrame.bids.every(
        (level, index) =>
          level.price === stableBids[index]?.price && level.size === stableBids[index]?.size
      ) &&
      previousFrame.asks.every(
        (level, index) =>
          level.price === stableAsks[index]?.price && level.size === stableAsks[index]?.size
      );
    const renderVersion = sameAsPrevious
      ? stableCache.renderVersion
      : stableCache.renderVersion + 1;

    const nextFrame: DepthChartCanonicalFrame = {
      centerPrice: renderCenterPrice,
      bids: stableBids,
      asks: stableAsks,
      bounds: materialized.bounds,
      liveMidPrice,
      bestBid,
      bestAsk,
      committedHalfSpan: safeCommitted,
      defaultHalfSpan,
      minHalfSpan,
      maxHalfSpan,
      tickSize,
      spread: marketBook.spread,
      spreadPercent: marketBook.spreadPercent,
      dataSource: fineCoverage >= inferredDesired ? "micro" : coverage.dataSource,
      hasRenderableFrame: true,
      isInitialLoading: false,
      isStale: Boolean(error) || !isConnected,
      isCoveragePending: !coverageReady,
      coverageReady,
      desiredHalfSpan: clampedDesired,
      actualRenderableHalfSpan: renderHalfSpan,
      canCommitDesiredSpan,
      maxTotal: stableMaxTotal,
      renderVersion,
      activeSigFigs,
      isConnected,
      error,
    };

    stableCacheRef.current.lastRenderableFrame = nextFrame;
    stableCacheRef.current.lastBucketStep = materialized.bucketStep;
    stableCacheRef.current.renderVersion = renderVersion;
    setFrameState(nextFrame);
  }, [
    activeSigFigs,
    coarseBookBySigFigs,
    committedHalfSpan,
    desiredHalfSpan,
    error,
    fineBook,
    isConnected,
    orderbook,
    stableCenterPrice,
    viewportWidth,
  ]);

  return useMemo(() => frameState, [frameState]);
}
