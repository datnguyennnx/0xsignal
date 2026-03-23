/**
 * @overview Depth Chart Coverage Resolver
 *
 * It determines which L2 data source (e.g., micro book) should be used based on the requested zoom level (half-span).
 * It calculates the renderable boundaries to ensure the depth chart doesn't try to draw outside available data.
 *
 * @mechanism
 * - computes symmetric boundaries based on the center price.
 * - provides "min" and "default" zoom levels based on current market spread and tick size.
 * - implements source selection (micro vs none) to optimize performance.
 */
import type {
  OrderbookData,
  OrderbookLevel,
} from "@/features/perp/hooks/use-hyperliquid-orderbook";
import { getMinHalfSpanValue } from "../lib/depth-visible-range";

const FLOAT_EPSILON = 0.000000001;
const MIN_HALF_SPAN_RATIO = 0.00016;
const DEFAULT_HALF_SPAN_RATIO = 0.00048;
const OUTER_PAD_RATIO = 0.00014;

interface UseDepthChartCoverageOptions {
  centerPrice: number;
  requestedHalfSpan: number;
  microBook: OrderbookData | null;
  defaultSourceBook: OrderbookData | null;
}

export interface SymmetricCoverageBounds {
  farthestRenderableBid: number;
  farthestRenderableAsk: number;
  maxHalfSpan: number;
}

export interface DepthChartCoverageResult {
  selectedBook: OrderbookData | null;
  dataSource: "micro" | "none";
  coverageReady: boolean;
  minHalfSpan: number | null;
  maxHalfSpan: number | null;
  defaultHalfSpan: number | null;
  tickSize: number;
  bestBid: number;
  bestAsk: number;
}

export function inferMinStep(levels: OrderbookLevel[]): number {
  if (levels.length < 2) {
    return getMinHalfSpanValue();
  }

  let minStep = Number.POSITIVE_INFINITY;
  for (let index = 1; index < levels.length; index++) {
    const diff = Math.abs(levels[index].price - levels[index - 1].price);
    if (diff > FLOAT_EPSILON && diff < minStep) {
      minStep = diff;
    }
  }

  return Number.isFinite(minStep) ? minStep : getMinHalfSpanValue();
}

export function computeSymmetricCoverageBounds(
  centerPrice: number,
  book: OrderbookData | null
): SymmetricCoverageBounds | null {
  if (
    !book?.bids.length ||
    !book.asks.length ||
    !Number.isFinite(centerPrice) ||
    centerPrice <= 0
  ) {
    return null;
  }

  const farthestRenderableBid = book.bids[book.bids.length - 1]?.price ?? centerPrice;
  const farthestRenderableAsk = book.asks[book.asks.length - 1]?.price ?? centerPrice;
  const maxHalfSpan = Math.max(
    Math.min(centerPrice - farthestRenderableBid, farthestRenderableAsk - centerPrice),
    getMinHalfSpanValue()
  );

  return {
    farthestRenderableBid,
    farthestRenderableAsk,
    maxHalfSpan,
  };
}

export function computeMinHalfSpan(book: OrderbookData, centerPrice: number): number {
  const spread = Math.max(book.spread, getMinHalfSpanValue());
  const tickSize = Math.min(inferMinStep(book.bids), inferMinStep(book.asks));
  // Formula tuned for Binance-like depth feel:
  // keep a wider minimum domain so micro spread noise does not cause aggressive chart jumps.
  return Math.max(spread * 4.2, tickSize * 14, centerPrice * MIN_HALF_SPAN_RATIO);
}

export function computeDefaultHalfSpan(book: OrderbookData, centerPrice: number): number {
  const bestBid = book.bids[0]?.price ?? centerPrice;
  const bestAsk = book.asks[0]?.price ?? centerPrice;
  const spread = Math.max(bestAsk - bestBid, getMinHalfSpanValue());
  const tickSize = Math.min(inferMinStep(book.bids), inferMinStep(book.asks));
  const bidAnchor = book.bids[Math.min(book.bids.length - 1, 6)]?.price ?? bestBid;
  const askAnchor = book.asks[Math.min(book.asks.length - 1, 6)]?.price ?? bestAsk;
  const innerHalfSpan = Math.max(
    bestBid - bidAnchor,
    askAnchor - bestAsk,
    spread * 16,
    tickSize * 56,
    centerPrice * DEFAULT_HALF_SPAN_RATIO
  );
  const outerPad = Math.min(
    Math.max(spread * 4.8, tickSize * 24, centerPrice * OUTER_PAD_RATIO),
    innerHalfSpan * 0.42
  );

  return innerHalfSpan + outerPad;
}

export function getBestPrices(book: OrderbookData | null): { bestBid: number; bestAsk: number } {
  return {
    bestBid: book?.bids[0]?.price ?? 0,
    bestAsk: book?.asks[0]?.price ?? 0,
  };
}

export function selectCoverageBook(
  requestedHalfSpan: number,
  centerPrice: number,
  microBook: OrderbookData | null
) {
  const microBounds = computeSymmetricCoverageBounds(centerPrice, microBook);

  if (microBook && microBounds && requestedHalfSpan <= microBounds.maxHalfSpan + FLOAT_EPSILON) {
    return {
      book: microBook,
      dataSource: "micro" as const,
      coverageReady: true,
      maxHalfSpan: microBounds.maxHalfSpan,
    };
  }

  if (microBook && microBounds) {
    return {
      book: microBook,
      dataSource: "micro" as const,
      coverageReady: requestedHalfSpan <= microBounds.maxHalfSpan + FLOAT_EPSILON,
      maxHalfSpan: microBounds.maxHalfSpan,
    };
  }

  return {
    book: null,
    dataSource: "none" as const,
    coverageReady: false,
    maxHalfSpan: null,
  };
}

export function resolveDepthChartCoverage({
  centerPrice,
  requestedHalfSpan,
  microBook,
  defaultSourceBook,
}: UseDepthChartCoverageOptions): DepthChartCoverageResult {
  const selection = selectCoverageBook(requestedHalfSpan, centerPrice, microBook);
  const sourceBook = defaultSourceBook ?? selection.book;
  const bestPrices = getBestPrices(sourceBook);
  const tickSize = sourceBook
    ? Math.min(inferMinStep(sourceBook.bids), inferMinStep(sourceBook.asks))
    : getMinHalfSpanValue();
  const minHalfSpan = sourceBook ? computeMinHalfSpan(sourceBook, centerPrice) : null;
  const defaultHalfSpan = sourceBook ? computeDefaultHalfSpan(sourceBook, centerPrice) : null;
  const maxHalfSpan =
    minHalfSpan === null || selection.maxHalfSpan === null
      ? selection.maxHalfSpan
      : Math.max(selection.maxHalfSpan, minHalfSpan);

  return {
    selectedBook: selection.book,
    dataSource: selection.dataSource,
    coverageReady: selection.coverageReady,
    minHalfSpan,
    maxHalfSpan,
    defaultHalfSpan:
      defaultHalfSpan !== null && minHalfSpan !== null && maxHalfSpan !== null
        ? Math.min(Math.max(defaultHalfSpan, minHalfSpan), maxHalfSpan)
        : null,
    tickSize,
    bestBid: bestPrices.bestBid,
    bestAsk: bestPrices.bestAsk,
  };
}
