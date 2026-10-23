import {
  memo,
  useCallback,
  useMemo,
  type MouseEvent,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  type DisplayOrderbookLevel as OrderbookLevel,
  type OrderbookData,
  priceKey,
} from "@/core/utils/hyperliquid";
import { getDepthStyle } from "../utils/orderbook-widget-shared";
import { OVERLAY_PANEL_CLASS } from "@/lib/overlay-classes";
import { cn } from "cn";
import { formatPriceWithNSigFigs, formatSize, formatSignedPercent } from "@/core/utils/formatters";
import {
  type PopupData,
  formatLevel,
  toQuoteDenom,
  VISIBLE_ROWS,
  ROW_HEIGHT_CLASS,
} from "../utils/orderbook-utils";

type BookSide = "bid" | "ask";
interface RowIndex {
  side: BookSide;
  index: number;
}

interface OrderRowProps {
  level: OrderbookLevel;
  side: BookSide;
  index: number;
  isHovered: boolean;
  isPinned: boolean;
  isInRange: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  onActivate: (side: BookSide, index: number) => void;
  maxTotal: number;
  nSigFigs: number;
}

const OrderRow = memo(
  ({
    level,
    side,
    index,
    isHovered,
    isPinned,
    isInRange,
    onHover,
    onActivate,
    maxTotal,
    nSigFigs,
  }: OrderRowProps) => {
    // formatLevel uses module-level cache — stable output for same price+nSigFigs
    const formatted = useMemo(() => formatLevel(level, nSigFigs), [level, nSigFigs]);

    // Depth bar — stabilised to prevent jitter from float drift
    const depthStyle = useMemo(() => {
      const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
      const stable = Math.round(depthPercent * 10) / 10;
      return getDepthStyle(stable, side);
    }, [level.total, maxTotal, side]);

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
      level.price > 0
        ? `${side} level, price ${formatted.formattedPrice}, size ${formatted.formattedSize}, total ${formatted.formattedTotal}`
        : undefined;

    return (
      <button
        type="button"
        disabled={level.price <= 0}
        aria-pressed={level.price > 0 ? isPinned : undefined}
        data-orderbook-row
        data-price={level.price}
        data-size={level.size}
        data-total={level.total}
        data-side={side}
        data-index={index}
        onMouseEnter={level.price > 0 ? handleMouseEnter : undefined}
        onMouseLeave={level.price > 0 ? handleMouseLeave : undefined}
        onFocus={level.price > 0 ? handleMouseEnter : undefined}
        onBlur={level.price > 0 ? handleMouseLeave : undefined}
        onClick={
          level.price > 0
            ? () => {
                onActivate(side, index);
              }
            : undefined
        }
        className={`${ROW_HEIGHT_CLASS} relative flex w-full items-center cursor-pointer text-left tabular-nums select-none shrink-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset bg-transparent border-0 ${
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        }`}
        aria-label={rowAriaLabel}
        aria-describedby={level.price > 0 && isHovered ? "orderbook-depth-details" : undefined}
      >
        {isInRange && (
          <div className="absolute inset-0 z-[5] pointer-events-none bg-foreground/5 dark:bg-foreground/10" />
        )}
        {level.price > 0 && (
          <div
            className={`absolute inset-y-0 right-0 z-0 opacity-20 pointer-events-none ${
              side === "bid" ? "bg-gain" : "bg-loss"
            }`}
            style={depthStyle}
          />
        )}
        <span
          className={`relative z-10 flex-1 text-[length:var(--text-micro)] font-mono font-medium ${
            level.price === 0 ? "text-muted-foreground" : side === "bid" ? "text-gain" : "text-loss"
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
    prev.level.price === next.level.price &&
    prev.level.size === next.level.size &&
    prev.level.total === next.level.total &&
    prev.side === next.side &&
    prev.isHovered === next.isHovered &&
    prev.isPinned === next.isPinned &&
    prev.isInRange === next.isInRange &&
    prev.nSigFigs === next.nSigFigs &&
    prev.maxTotal === next.maxTotal,
);

OrderRow.displayName = "OrderRow";

/** The spread strip's box, shared with the loading placeholder so both reserve one height. */
export function OrderbookSpreadRow({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${ROW_HEIGHT_CLASS} flex items-center justify-center gap-[clamp(1.25rem,3vw,2.5rem)] shrink-0`}
    >
      {children}
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
  // nSigFigs controls price display precision, not level grouping.
  // Levels arrive pre-aggregated from the server (Hyperliquid's own
  // nSigFigs grouping over the full deep orderbook). No client-side
  // aggregation needed — just slice to the visible window.
  const { visibleAsks, visibleBids, maxTotal } = useMemo(() => {
    const rawAsks = orderbook.asks.slice(0, VISIBLE_ROWS);
    const rawBids = orderbook.bids.slice(0, VISIBLE_ROWS);

    const convAsks = pairFocus === "quote" ? rawAsks.map((level) => toQuoteDenom(level)) : rawAsks;
    const convBids = pairFocus === "quote" ? rawBids.map((level) => toQuoteDenom(level)) : rawBids;

    let peakTotal = 0;
    for (let i = 0; i < convAsks.length; i++) peakTotal = Math.max(peakTotal, convAsks[i].total);
    for (let i = 0; i < convBids.length; i++) peakTotal = Math.max(peakTotal, convBids[i].total);
    peakTotal = Math.round(peakTotal * 100) / 100;

    return { visibleAsks: convAsks, visibleBids: convBids, maxTotal: peakTotal };
  }, [orderbook, pairFocus]);

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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse">
          {visibleAsks.map((level, index) => (
            <OrderRow
              key={priceKey("ask", level.price)}
              level={level}
              side="ask"
              index={index}
              isHovered={isRowHovered("ask", index)}
              isPinned={pinnedIndex?.side === "ask" && pinnedIndex.index === index}
              isInRange={isRowInHighlightRange("ask", index)}
              onHover={onHover}
              onActivate={onActivate}
              maxTotal={maxTotal}
              nSigFigs={effectiveNSigFigs ?? 5}
            />
          ))}
        </div>

        <OrderbookSpreadRow>
          <span className="text-[length:var(--text-micro)] font-medium text-muted-foreground">
            Spread
          </span>
          <span className="text-[length:var(--text-micro)] font-mono text-muted-foreground">
            {formatPriceWithNSigFigs(spread, effectiveNSigFigs ?? 5)}
          </span>
          <span className="text-[length:var(--text-micro)] font-mono text-muted-foreground">
            {formatSignedPercent(spreadPercent)}
          </span>
        </OrderbookSpreadRow>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative">
          {visibleBids.map((level, index) => (
            <OrderRow
              key={priceKey("bid", level.price)}
              level={level}
              side="bid"
              index={index}
              isHovered={isRowHovered("bid", index)}
              isPinned={pinnedIndex?.side === "bid" && pinnedIndex.index === index}
              isInRange={isRowInHighlightRange("bid", index)}
              onHover={onHover}
              onActivate={onActivate}
              maxTotal={maxTotal}
              nSigFigs={effectiveNSigFigs ?? 5}
            />
          ))}
        </div>
      </div>

      {popupData &&
        popupPosition &&
        createPortal(
          <div
            id="orderbook-depth-details"
            className={cn(
              OVERLAY_PANEL_CLASS,
              "fixed p-3 z-50 w-64 pointer-events-none flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)] -translate-y-1/2",
            )}
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
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Price</span>
                <span className="text-base font-mono font-medium">
                  {formatPriceWithNSigFigs(popupData.price, effectiveNSigFigs ?? 5)}
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
                          ? formatPriceWithNSigFigs(popupData.avgPrice, effectiveNSigFigs ?? 5)
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
