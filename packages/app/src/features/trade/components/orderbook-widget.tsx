/**
 * @overview Orderbook Widget
 *
 * Renders a real-time L2 orderbook with support for custom tick sizes and depth visualization.
 * Supports row highlighting and cumulative volume calculations on hover.
 *
 * @mechanism
 * - Integrates with L2BookNSigFigsContext for cross-component aggregation sync
 * - Implements client-side grouping when local tick size differs from exchange SigFigs
 *
 * @performance
 * - Memoized OrderRow with stable identity tracking (prevents flash on data updates)
 * - RAF-throttled updates from the underlying hook
 * - Single-pass maxTotal computation (O(1) space, no intermediate arrays)
 * - Threshold-based maxTotal stabilization (eliminates unnecessary re-renders)
 * - CSS transitions on depth bars for smooth visual updates
 * - CSS custom properties for dynamic width values (avoids inline style allocation)
 * - Persistent scroll/resize listeners via refs (no add/remove on every hover)
 * - Debounced popup position calculation via rAF (avoids synchronous layout thrashing)
 */
import { memo, useState, useCallback, useEffect, useRef, useMemo, startTransition } from "react";
import {
  useHyperliquidOrderbook,
  generateTickSizeOptions,
  type TickSizeOption,
} from "@/features/trade/hooks/use-hyperliquid-orderbook";
import { type OrderbookLevel, priceKey } from "@/core/utils/hyperliquid";
import { useOptionalL2BookNSigFigs } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { cn } from "@/core/utils/cn";
import { Loader2 } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface OrderbookWidgetProps {
  symbol: string;
}

interface PopupData {
  price: number;
  size: number;
  total: number;
  side: "bid" | "ask";
  avgPrice?: number;
  cumulativeSize?: number;
}

const ROW_HEIGHT = 28;
const VISIBLE_ROWS = 20;

const DEPTH_BAR_TRANSITION = "width 150ms ease-out";

import { formatPriceWithScaling, formatSize } from "@/core/utils/formatters";

const OrderbookToolbar = memo(
  ({
    priceScaling,
    onPriceScalingChange,
    scalingOptions,
  }: {
    priceScaling: number;
    onPriceScalingChange: (s: number) => void;
    scalingOptions: TickSizeOption[];
  }) => (
    <div className="flex items-center justify-end px-3 py-2 border-b border-border/20 flex-shrink-0 bg-muted/10">
      <NativeSelect
        size="sm"
        value={priceScaling.toString()}
        onChange={(e) => onPriceScalingChange(Number(e.target.value))}
        className="min-h-[44px]"
      >
        {scalingOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value.toString()}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  ),
  (prev, next) => prev.priceScaling === next.priceScaling
);

OrderbookToolbar.displayName = "OrderbookToolbar";

interface FormattedLevel extends OrderbookLevel {
  formattedPrice: string;
  formattedSize: string;
  formattedTotal: string;
}

interface OrderRowProps {
  level: FormattedLevel;
  side: "bid" | "ask";
  index: number;
  isHovered: boolean;
  isInRange: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  maxTotal: number;
  transitionsEnabled: boolean;
}

const ORDER_ROW_STYLE = { height: ROW_HEIGHT };
const DEPTH_BAR_BASE = "absolute top-0 bottom-0 right-0 opacity-20 pointer-events-none";

const OrderRow = memo(
  ({
    level,
    side,
    index,
    isHovered,
    isInRange,
    onHover,
    maxTotal,
    transitionsEnabled,
  }: OrderRowProps) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;

    const handleMouseEnter = useCallback(() => {
      onHover(
        { price: level.price, size: level.size, total: level.total, side },
        rowRef.current,
        index
      );
    }, [onHover, level.price, level.size, level.total, side, index]);

    const handleMouseLeave = useCallback(() => onHover(null, null), [onHover]);

    return (
      <div
        ref={rowRef}
        className={cn(
          "relative flex items-center px-3 cursor-pointer tabular-nums select-none flex-shrink-0",
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        )}
        style={ORDER_ROW_STYLE}
        onMouseEnter={level.price > 0 ? handleMouseEnter : undefined}
        onMouseLeave={level.price > 0 ? handleMouseLeave : undefined}
      >
        {isInRange && (
          <div
            className={cn(
              "absolute inset-0 z-[5] pointer-events-none",
              "bg-foreground/5 dark:bg-foreground/10",
              isHovered && side === "ask" && "border-b border-dashed border-foreground/30",
              isHovered && side === "bid" && "border-t border-dashed border-foreground/30"
            )}
          />
        )}
        {level.price > 0 && (
          <div
            className={cn(DEPTH_BAR_BASE, side === "bid" ? "bg-gain" : "bg-loss")}
            style={
              {
                "--depth-width": `${Math.min(depthPercent, 100)}%`,
                width: `var(--depth-width)`,
                transform: "translateZ(0)",
                willChange: "width",
                transition: transitionsEnabled ? DEPTH_BAR_TRANSITION : "none",
              } as React.CSSProperties
            }
          />
        )}
        <span
          className={cn(
            "relative z-10 flex-1 text-xs font-mono font-medium",
            level.price === 0
              ? "text-muted-foreground/30"
              : side === "bid"
                ? "text-gain"
                : "text-loss"
          )}
        >
          {level.formattedPrice}
        </span>
        <span
          className={cn(
            "relative z-10 flex-1 text-right text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground"
          )}
        >
          {level.formattedSize}
        </span>
        <span
          className={cn(
            "relative z-10 flex-1 text-right text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground/70"
          )}
        >
          {level.formattedTotal}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.level.price === next.level.price &&
    prev.level.formattedPrice === next.level.formattedPrice &&
    prev.level.formattedSize === next.level.formattedSize &&
    prev.level.formattedTotal === next.level.formattedTotal &&
    prev.side === next.side &&
    prev.isHovered === next.isHovered &&
    prev.isInRange === next.isInRange &&
    prev.transitionsEnabled === next.transitionsEnabled
);

OrderRow.displayName = "OrderRow";

function formatLevel(level: OrderbookLevel, scaling: number): FormattedLevel {
  return {
    ...level,
    formattedPrice: level.price > 0 ? formatPriceWithScaling(level.price, scaling) : "-",
    formattedSize: level.price > 0 ? formatSize(level.size) : "-",
    formattedTotal: level.price > 0 ? formatSize(level.total) : "-",
  };
}

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const l2BookSig = useOptionalL2BookNSigFigs();
  const l2BookSigRef = useRef(l2BookSig);
  useEffect(() => {
    l2BookSigRef.current = l2BookSig;
  }, [l2BookSig]);

  const orderbookHookOptions = useMemo(() => {
    if (l2BookSig != null) {
      return { controlledNSigFigs: l2BookSig.nSigFigs, adaptiveNSigFigs: false as const };
    }
    return {};
  }, [l2BookSig]);

  const { orderbook, isConnected, error, resubscribe } = useHyperliquidOrderbook(
    symbol,
    true,
    orderbookHookOptions
  );

  const [userPriceScaling, setUserPriceScaling] = useState<{
    symbol: string;
    value: number;
  } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{
    side: "bid" | "ask";
    price: number;
    size: number;
    total: number;
  } | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<{ side: "bid" | "ask"; index: number } | null>(
    null
  );
  const widgetRef = useRef<HTMLDivElement>(null);
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      setTransitionsEnabled(false);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setTransitionsEnabled(true));
      });
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Debounced popup position via rAF to avoid synchronous layout thrashing
  const popupRafRef = useRef(0);
  const schedulePopupPosition = useCallback(
    (
      rowElement: HTMLElement,
      side: "bid" | "ask",
      price: number,
      size: number,
      total: number,
      index: number
    ) => {
      if (popupRafRef.current) cancelAnimationFrame(popupRafRef.current);
      popupRafRef.current = requestAnimationFrame(() => {
        const rect = rowElement.getBoundingClientRect();
        const widgetRect = widgetRef.current?.getBoundingClientRect();
        if (widgetRect) {
          const top = rect.top + rect.height / 2;
          const viewportWidth = window.innerWidth;
          if (viewportWidth - widgetRect.right > 220) {
            setPopupPosition({ top, left: widgetRect.right + 8 });
          } else if (widgetRect.left > 220) {
            setPopupPosition({ top, right: viewportWidth - widgetRect.left + 8 });
          } else {
            setPopupPosition({ top, left: widgetRect.right - 200 });
          }
        }
        popupRafRef.current = 0;
      });

      setHoverTarget({ side, price, size, total });
      setHoveredIndex({ side, index });
    },
    []
  );

  const clearPopup = useCallback(() => {
    setHoverTarget(null);
    setPopupPosition(null);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", clearPopup, { passive: true, capture: true });
    window.addEventListener("resize", clearPopup);
    return () => {
      window.removeEventListener("scroll", clearPopup, { capture: true });
      window.removeEventListener("resize", clearPopup);
    };
  }, [clearPopup]);

  const bestAskPrice = orderbook?.asks[0]?.price;
  const bestBidPrice = orderbook?.bids[0]?.price;
  const bestPrice = bestAskPrice ?? bestBidPrice ?? 0;

  const scalingOptions = useMemo(() => generateTickSizeOptions(bestPrice), [bestPrice]);

  const effectivePriceScaling = useMemo(
    () =>
      userPriceScaling?.symbol === symbol
        ? userPriceScaling.value
        : scalingOptions.length > 0
          ? scalingOptions[0].value
          : 0,
    [userPriceScaling, symbol, scalingOptions]
  );

  // Sync initial nSigFigs when orderbook data arrives
  useEffect(() => {
    if (orderbook && scalingOptions.length > 0 && userPriceScaling?.symbol !== symbol) {
      const first = scalingOptions[0];
      if (l2BookSigRef.current) {
        l2BookSigRef.current.setNSigFigs(first.nSigFigs ?? 5);
      }
    }
  }, [orderbook, scalingOptions, symbol, userPriceScaling]);

  const handlePriceScalingChange = useCallback(
    (newScale: number) => {
      const opt = scalingOptions.find((o) => o.value === newScale);
      const nextSig = opt?.nSigFigs ?? 5;

      startTransition(() => {
        setUserPriceScaling({ symbol, value: newScale });
      });

      if (l2BookSigRef.current) {
        l2BookSigRef.current.setNSigFigs(nextSig);
      } else {
        resubscribe(nextSig);
      }
    },
    [scalingOptions, resubscribe, symbol]
  );

  // No client-side grouping needed — server already aggregates at the requested nSigFigs.
  // Applying groupOrderbookLevels on top of server-aggregated data double-collapses levels,
  // reducing the visible row count (e.g., 20 server levels → 8 after client grouping).
  const groupedOrderbook = orderbook;

  const { visibleAsks, visibleBids, maxTotal } = useMemo((): {
    visibleAsks: FormattedLevel[];
    visibleBids: FormattedLevel[];
    maxTotal: number;
  } => {
    if (!groupedOrderbook) return { visibleAsks: [], visibleBids: [], maxTotal: 0 };
    const asks = groupedOrderbook.asks.slice(0, VISIBLE_ROWS);
    const bids = groupedOrderbook.bids.slice(0, VISIBLE_ROWS);
    let mt = 0;
    for (let i = 0; i < asks.length; i++) mt = Math.max(mt, asks[i].total);
    for (let i = 0; i < bids.length; i++) mt = Math.max(mt, bids[i].total);

    return {
      visibleAsks: asks.map((l) => formatLevel(l, effectivePriceScaling)),
      visibleBids: bids.map((l) => formatLevel(l, effectivePriceScaling)),
      maxTotal: mt,
    };
  }, [groupedOrderbook, effectivePriceScaling]);

  const { spread, spreadPercent } = useMemo(() => {
    if (
      !groupedOrderbook ||
      groupedOrderbook.asks.length === 0 ||
      groupedOrderbook.bids.length === 0
    ) {
      return { spread: 0, spreadPercent: 0 };
    }
    const bestAsk = groupedOrderbook.asks[0]?.price || 0;
    const bestBid = groupedOrderbook.bids[0]?.price || 0;
    const s = bestAsk - bestBid;
    const sp = bestBid > 0 ? (s / bestBid) * 100 : 0;
    return { spread: s, spreadPercent: sp };
  }, [groupedOrderbook]);

  const popupData = useMemo((): PopupData | null => {
    if (!hoverTarget || !groupedOrderbook) return null;
    const levels = hoverTarget.side === "ask" ? groupedOrderbook.asks : groupedOrderbook.bids;
    const targetIndex = levels.findIndex((l) => Math.abs(l.price - hoverTarget.price) < 1e-8);
    if (targetIndex === -1) return { ...hoverTarget };

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
  }, [hoverTarget, groupedOrderbook]);

  const handleHover = useCallback(
    (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => {
      if (!data || !rowElement || index === undefined) {
        setHoverTarget(null);
        setPopupPosition(null);
        setHoveredIndex(null);
        return;
      }

      schedulePopupPosition(rowElement, data.side, data.price, data.size, data.total, index);
    },
    [schedulePopupPosition]
  );

  const isRowHovered = useCallback(
    (side: "bid" | "ask", index: number) =>
      hoveredIndex?.side === side && hoveredIndex?.index === index,
    [hoveredIndex]
  );

  const isRowInHighlightRange = useCallback(
    (side: "bid" | "ask", index: number) => {
      if (!hoveredIndex || hoveredIndex.side !== side) return false;
      return index <= hoveredIndex.index;
    },
    [hoveredIndex]
  );

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (!isConnected || !orderbook) {
    return (
      <div className="h-full flex items-center justify-center opacity-50">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      className="flex flex-col bg-card border-border/30 rounded-xl overflow-hidden p-2"
    >
      <OrderbookToolbar
        priceScaling={effectivePriceScaling}
        onPriceScalingChange={handlePriceScalingChange}
        scalingOptions={scalingOptions}
      />

      <div className="flex items-center px-3 py-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border/20 flex-shrink-0">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Size</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      <div className="flex flex-col min-h-0 overflow-hidden overscroll-none">
        <div className="flex flex-col-reverse relative overflow-hidden overscroll-none">
          {visibleAsks.map((level, index) => (
            <OrderRow
              key={priceKey("ask", level.price)}
              level={level}
              side="ask"
              index={index}
              isHovered={isRowHovered("ask", index)}
              isInRange={isRowInHighlightRange("ask", index)}
              onHover={handleHover}
              maxTotal={maxTotal}
              transitionsEnabled={transitionsEnabled}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 py-1.5 border-y border-border/10 bg-muted/20 flex-shrink-0">
          <span className="text-xs font-mono font-medium text-muted-foreground/80">Spread</span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {formatPriceWithScaling(spread, effectivePriceScaling)}
          </span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {spreadPercent.toFixed(3)}%
          </span>
        </div>

        <div className="flex flex-col relative overflow-hidden overscroll-none">
          {visibleBids.map((level, index) => (
            <OrderRow
              key={priceKey("bid", level.price)}
              level={level}
              side="bid"
              index={index}
              isHovered={isRowHovered("bid", index)}
              isInRange={isRowInHighlightRange("bid", index)}
              onHover={handleHover}
              maxTotal={maxTotal}
              transitionsEnabled={transitionsEnabled}
            />
          ))}
        </div>
      </div>

      {popupData && popupPosition && (
        <div
          className="fixed bg-card/95 border border-border/30 rounded-xl p-3 shadow-xl z-50 w-64 pointer-events-none"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            right: popupPosition.right,
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase">
              {popupData.side === "ask" ? "Ask" : "Bid"}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{symbol.toUpperCase()}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Price</span>
              <span className="text-base font-mono font-medium">
                {formatPriceWithScaling(popupData.price, effectivePriceScaling)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Size</span>
              <span className="text-sm font-mono">{formatSize(popupData.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-mono font-medium">{formatSize(popupData.total)}</span>
            </div>
            {popupData.cumulativeSize && popupData.cumulativeSize > popupData.size && (
              <>
                <div className="border-t border-border/20 my-2" />
                <div className="text-[10px] text-muted-foreground uppercase mb-1">
                  To Best Price
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Avg Price</span>
                  <span className="text-sm font-mono font-medium">
                    {popupData.avgPrice
                      ? formatPriceWithScaling(popupData.avgPrice, effectivePriceScaling)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Total Size</span>
                  <span className="text-sm font-mono text-gain">
                    {formatSize(popupData.cumulativeSize)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol
);
OrderbookWidget.displayName = "OrderbookWidget";
