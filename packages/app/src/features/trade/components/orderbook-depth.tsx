import {
  memo,
  useCallback,
  useMemo,
  type MouseEvent,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { type OrderbookData, priceKey } from "@/core/utils/hyperliquid";
import { getDepthStyle, resolveBookDisplayNSigFigs } from "../utils/orderbook-widget-shared";
import { OVERLAY_PANEL_CLASS } from "@/lib/overlay-classes";
import { formatPriceWithNSigFigs, formatSize, formatSignedPercent } from "@/core/utils/formatters";
import {
  type PopupData,
  formatLevel,
  toQuoteDenom,
  ROW_HEIGHT_CLASS,
} from "../utils/orderbook-utils";
import { useOrderbookRows } from "../hooks/use-orderbook-rows";

type BookSide = "bid" | "ask";
interface RowIndex {
  side: BookSide;
  index: number;
}

interface OrderRowProps {
  price: number;
  size: number;
  total: number;
  depthPercent: number;
  side: BookSide;
  index: number;
  isHovered: boolean;
  isPinned: boolean;
  isInRange: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  onActivate: (side: BookSide, index: number) => void;
  nSigFigs: number;
}

const depthPercentOf = (total: number, maxTotal: number): number =>
  maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0;

const OrderRow = memo(
  ({
    price,
    size,
    total,
    depthPercent,
    side,
    index,
    isHovered,
    isPinned,
    isInRange,
    onHover,
    onActivate,
    nSigFigs,
  }: OrderRowProps) => {
    // formatLevel uses module-level cache — stable output for same price+nSigFigs
    const formatted = useMemo(
      () => formatLevel(price, size, total, nSigFigs),
      [price, size, total, nSigFigs],
    );

    const depthStyle = useMemo(() => getDepthStyle(depthPercent, side), [depthPercent, side]);

    // Stable event handlers — created once, never recreated per row
    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
        const dataset = e.currentTarget.dataset;
        if (dataset.price === undefined) return;
        const rowSide = dataset.side;
        if (rowSide !== "bid" && rowSide !== "ask") return;
        onHover(
          {
            price: Number(dataset.price),
            size: Number(dataset.size),
            total: Number(dataset.total),
            side: rowSide,
          },
          e.currentTarget,
          Number(dataset.index),
        );
      },
      [onHover],
    );

    const handleMouseLeave = useCallback(() => {
      onHover(null, null);
    }, [onHover]);

    const rowAriaLabel =
      price > 0
        ? `${side} level, price ${formatted.formattedPrice}, size ${formatted.formattedSize}, total ${formatted.formattedTotal}`
        : undefined;

    return (
      <button
        type="button"
        disabled={price <= 0}
        aria-pressed={price > 0 ? isPinned : undefined}
        data-orderbook-row
        data-price={price}
        data-size={size}
        data-total={total}
        data-side={side}
        data-index={index}
        onMouseEnter={price > 0 ? handleMouseEnter : undefined}
        onMouseLeave={price > 0 ? handleMouseLeave : undefined}
        onFocus={price > 0 ? handleMouseEnter : undefined}
        onBlur={price > 0 ? handleMouseLeave : undefined}
        onClick={
          price > 0
            ? () => {
                onActivate(side, index);
              }
            : undefined
        }
        className={`${ROW_HEIGHT_CLASS} relative flex w-full items-center px-[var(--space-2,0.75rem)] gap-[var(--space-1,0.3125rem)] cursor-pointer text-left tabular-nums select-none shrink-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset bg-transparent border-0 ${
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        }`}
        aria-label={rowAriaLabel}
        aria-describedby={price > 0 && isHovered ? "orderbook-depth-details" : undefined}
      >
        {isInRange && (
          <div className="absolute inset-0 z-[5] pointer-events-none bg-foreground/5 dark:bg-foreground/10" />
        )}
        {price > 0 && (
          <div
            className={`absolute inset-y-0 right-0 z-0 opacity-20 pointer-events-none ${
              side === "bid" ? "bg-gain" : "bg-loss"
            }`}
            style={depthStyle}
          />
        )}
        <span
          className={`relative z-10 flex-1 text-[length:var(--text-micro)] font-mono font-medium ${
            price === 0 ? "text-muted-foreground" : side === "bid" ? "text-gain" : "text-loss"
          }`}
        >
          {formatted.formattedPrice}
        </span>
        <span className="relative z-10 flex-1 text-right text-[length:var(--text-micro)] font-mono text-muted-foreground">
          {formatted.formattedSize}
        </span>
        <span className="relative z-10 flex-1 text-right text-[length:var(--text-micro)] font-mono text-muted-foreground">
          {formatted.formattedTotal}
        </span>
      </button>
    );
  },
  (prev, next) =>
    prev.price === next.price &&
    prev.size === next.size &&
    prev.total === next.total &&
    prev.depthPercent === next.depthPercent &&
    prev.side === next.side &&
    prev.index === next.index &&
    prev.isHovered === next.isHovered &&
    prev.isPinned === next.isPinned &&
    prev.isInRange === next.isInRange &&
    prev.nSigFigs === next.nSigFigs &&
    prev.onHover === next.onHover &&
    prev.onActivate === next.onActivate,
);

OrderRow.displayName = "OrderRow";

/** The spread strip's box, shared with the loading placeholder so both reserve one height. */
function OrderbookSpreadRow({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${ROW_HEIGHT_CLASS} flex items-center justify-center gap-[var(--space-2,0.75rem)] shrink-0`}
    >
      {children}
    </div>
  );
}

export function OrderbookColumnHeader({ pairFocus }: { pairFocus: string }) {
  return (
    <div
      className={`${ROW_HEIGHT_CLASS} flex items-center px-[var(--space-2,0.75rem)] text-[length:var(--text-micro)] font-mono uppercase text-muted-foreground shrink-0`}
    >
      <span className="flex-1">Price</span>
      <span className="flex-1 text-right">{pairFocus === "quote" ? "Value" : "Size"}</span>
      <span className="flex-1 text-right">{pairFocus === "quote" ? "Total Val" : "Total"}</span>
    </div>
  );
}

function OrderbookPlaceholderRows({ count }: { count: number }) {
  return (
    <div className="flex-none overflow-hidden flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`${ROW_HEIGHT_CLASS} flex items-center gap-[var(--space-2,0.75rem)] shrink-0`}
        >
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** Reserves the loaded book's box: toolbar + column header + both depth halves + spread. */
export function OrderbookPlaceholder({ pairFocus }: { pairFocus: string }) {
  const { bodyRef, rowsPerHalf } = useOrderbookRows();
  const visibleRows = rowsPerHalf;

  return (
    <div className="relative isolate h-full flex flex-col rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface gap-[var(--space-3,1.125rem)]">
      <div className="flex items-center justify-between gap-[clamp(0.375rem,0.6vw,0.625rem)] shrink-0">
        <Skeleton className="h-7 w-[4.5rem]" />
        <Skeleton className="h-7 w-20" />
      </div>
      <OrderbookColumnHeader pairFocus={pairFocus} />
      <div ref={bodyRef} className="flex flex-col flex-1 min-h-0 overflow-hidden justify-center">
        <OrderbookPlaceholderRows count={visibleRows} />
        <OrderbookSpreadRow>
          <span className="text-[length:var(--text-micro)] font-medium text-muted-foreground">
            Spread
          </span>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </OrderbookSpreadRow>
        <OrderbookPlaceholderRows count={visibleRows} />
      </div>
    </div>
  );
}

interface OrderbookDepthProps {
  symbol: string;
  orderbook: OrderbookData;
  pairFocus: string;
  effectiveNSigFigs: number | null;
  hoveredIndex: RowIndex | null;
  pinnedIndex: RowIndex | null;
  hoverTarget: PopupData | null;
  popupPosition: { top: number; left?: number; right?: number } | null;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  onActivate: (side: BookSide, index: number) => void;
}

export function OrderbookDepth({
  symbol,
  orderbook,
  pairFocus,
  effectiveNSigFigs,
  hoveredIndex,
  pinnedIndex,
  hoverTarget,
  popupPosition,
  onHover,
  onActivate,
}: OrderbookDepthProps) {
  const { bodyRef, rowsPerHalf, rowHeightPx } = useOrderbookRows();
  const visibleRows = rowsPerHalf;
  const displayNSigFigs = resolveBookDisplayNSigFigs(effectiveNSigFigs);
  // Capping each half at the measured rows keeps a stale measurement from clipping a row mid-height.
  const halfMaxHeightPx = visibleRows * rowHeightPx;

  // nSigFigs controls price display precision, not level grouping.
  // Levels arrive pre-aggregated from the server (Hyperliquid's own
  // nSigFigs grouping over the full deep orderbook). No client-side
  // aggregation needed — just slice to the visible window.
  const { visibleAsks, visibleBids, maxTotal } = useMemo(() => {
    const rawAsks = orderbook.asks.slice(0, visibleRows);
    const rawBids = orderbook.bids.slice(0, visibleRows);

    const convAsks = pairFocus === "quote" ? rawAsks.map((level) => toQuoteDenom(level)) : rawAsks;
    const convBids = pairFocus === "quote" ? rawBids.map((level) => toQuoteDenom(level)) : rawBids;

    let peakTotal = 0;
    for (let i = 0; i < convAsks.length; i++) peakTotal = Math.max(peakTotal, convAsks[i].total);
    for (let i = 0; i < convBids.length; i++) peakTotal = Math.max(peakTotal, convBids[i].total);
    peakTotal = Math.round(peakTotal * 100) / 100;

    return { visibleAsks: convAsks, visibleBids: convBids, maxTotal: peakTotal };
  }, [orderbook, pairFocus, visibleRows]);

  const { spread, spreadPercent } = useMemo(() => {
    if (orderbook.asks.length === 0 || orderbook.bids.length === 0) {
      return { spread: 0, spreadPercent: 0 };
    }
    const bestAsk = orderbook.asks[0]?.price || 0;
    const bestBid = orderbook.bids[0]?.price || 0;
    const spreadValue = bestAsk - bestBid;
    const spreadPercentValue = bestBid > 0 ? (spreadValue / bestBid) * 100 : 0;
    return { spread: spreadValue, spreadPercent: spreadPercentValue };
  }, [orderbook]);

  const popupData = useMemo((): PopupData | null => {
    if (!hoverTarget) return null;
    const rawLevels = hoverTarget.side === "ask" ? orderbook.asks : orderbook.bids;
    const targetIndex = rawLevels.findIndex((l) => Math.abs(l.price - hoverTarget.price) < 1e-8);
    if (targetIndex === -1) return { ...hoverTarget };

    const levels =
      pairFocus === "quote" ? rawLevels.map((level) => toQuoteDenom(level)) : rawLevels;

    let totalSize = 0;
    let weightedPriceSum = 0;
    for (let i = 0; i <= targetIndex; i++) {
      totalSize += levels[i].size;
      weightedPriceSum += levels[i].price * levels[i].size;
    }

    return {
      ...hoverTarget,
      avgPrice: totalSize > 0 ? weightedPriceSum / totalSize : 0,
      cumulativeSize: totalSize,
    };
  }, [hoverTarget, orderbook, pairFocus]);

  const isRowHovered = (side: BookSide, index: number) =>
    hoveredIndex?.side === side && hoveredIndex?.index === index;

  const isRowInHighlightRange = (side: BookSide, index: number) => {
    if (!hoveredIndex || hoveredIndex.side !== side) return false;
    return index <= hoveredIndex.index;
  };

  return (
    <>
      <div ref={bodyRef} className="flex flex-col flex-1 min-h-0 overflow-hidden justify-center">
        <div
          className="flex-none overflow-hidden flex flex-col-reverse"
          style={{ maxHeight: halfMaxHeightPx > 0 ? halfMaxHeightPx : undefined }}
        >
          {visibleAsks.map((level, index) => (
            <OrderRow
              key={priceKey("ask", level.price)}
              price={level.price}
              size={level.size}
              total={level.total}
              depthPercent={depthPercentOf(level.total, maxTotal)}
              side="ask"
              index={index}
              isHovered={isRowHovered("ask", index)}
              isPinned={pinnedIndex?.side === "ask" && pinnedIndex.index === index}
              isInRange={isRowInHighlightRange("ask", index)}
              onHover={onHover}
              onActivate={onActivate}
              nSigFigs={displayNSigFigs}
            />
          ))}
        </div>

        <OrderbookSpreadRow>
          <span className="px-[var(--space-2,0.75rem)] text-[length:var(--text-micro)] font-medium text-muted-foreground">
            Spread
          </span>
          <span className="px-[var(--space-2,0.75rem)] text-[length:var(--text-micro)] font-mono text-muted-foreground">
            {formatPriceWithNSigFigs(spread, displayNSigFigs)}
          </span>
          <span className="px-[var(--space-2,0.75rem)] text-[length:var(--text-micro)] font-mono text-muted-foreground">
            {formatSignedPercent(spreadPercent)}
          </span>
        </OrderbookSpreadRow>

        <div
          className="flex-none overflow-hidden flex flex-col relative"
          style={{ maxHeight: halfMaxHeightPx > 0 ? halfMaxHeightPx : undefined }}
        >
          {visibleBids.map((level, index) => (
            <OrderRow
              key={priceKey("bid", level.price)}
              price={level.price}
              size={level.size}
              total={level.total}
              depthPercent={depthPercentOf(level.total, maxTotal)}
              side="bid"
              index={index}
              isHovered={isRowHovered("bid", index)}
              isPinned={pinnedIndex?.side === "bid" && pinnedIndex.index === index}
              isInRange={isRowInHighlightRange("bid", index)}
              onHover={onHover}
              onActivate={onActivate}
              nSigFigs={displayNSigFigs}
            />
          ))}
        </div>
      </div>

      {popupData &&
        popupPosition &&
        createPortal(
          <div
            id="orderbook-depth-details"
            className={`${OVERLAY_PANEL_CLASS} fixed p-3 z-50 w-64 pointer-events-none flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)] -translate-y-1/2`}
            style={{
              top: popupPosition.top,
              left: popupPosition.left,
              right: popupPosition.right,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase">
                {popupData.side === "ask" ? "Ask" : "Bid"}
              </span>
              <span className="text-xs text-muted-foreground">{symbol.toUpperCase()}</span>
            </div>
            <div className="space-y-[var(--space-2,0.75rem)]">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Price</span>
                <span className="text-base font-mono font-medium">
                  {formatPriceWithNSigFigs(popupData.price, displayNSigFigs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  {pairFocus === "quote" ? "Value" : "Size"}
                </span>
                <span className="text-sm font-mono">{formatSize(popupData.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  {pairFocus === "quote" ? "Total Val" : "Total"}
                </span>
                <span className="text-sm font-mono font-medium">{formatSize(popupData.total)}</span>
              </div>
              {popupData.cumulativeSize !== undefined &&
                popupData.cumulativeSize > popupData.size && (
                  <>
                    <div className="text-[length:var(--text-data)] text-muted-foreground uppercase">
                      To Best Price
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Avg Price</span>
                      <span className="text-sm font-mono font-medium">
                        {popupData.avgPrice !== undefined && popupData.avgPrice !== 0
                          ? formatPriceWithNSigFigs(popupData.avgPrice, displayNSigFigs)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Total Size</span>
                      <span className="text-sm font-mono">
                        {formatSize(popupData.cumulativeSize)}
                      </span>
                    </div>
                  </>
                )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
