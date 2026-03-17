import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  useHyperliquidOrderbook,
  generateTickSizeOptions,
  groupLevels,
  type OrderbookLevel,
  type TickSizeOption,
} from "@/hooks/use-hyperliquid-orderbook";
import { cn } from "@/core/utils/cn";
import { Loader2 } from "lucide-react";

const OrderbookToolbar = memo(
  ({
    priceScaling,
    onPriceScalingChange,
    scalingOptions,
  }: {
    priceScaling: number;
    onPriceScalingChange: (s: number) => void;
    scalingOptions: TickSizeOption[];
  }) => {
    return (
      <div className="flex items-center justify-end px-3 py-2 border-b border-border/20 flex-shrink-0 bg-muted/10">
        <select
          value={priceScaling}
          onChange={(e) => onPriceScalingChange(Number(e.target.value))}
          className="bg-transparent text-[11px] font-mono border border-border/30 rounded px-1.5 py-1 h-6 min-w-[60px]"
        >
          {scalingOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
  (prev, next) => {
    return prev.priceScaling === next.priceScaling;
  }
);

interface OrderbookWidgetProps {
  symbol: string;
}

interface OrderRowProps {
  level: OrderbookLevel;
  side: "bid" | "ask";
  index: number;
  isHovered: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  priceScaling: number;
  maxTotal: number;
}

interface PopupData {
  price: number;
  size: number;
  total: number;
  side: "bid" | "ask";
  avgPrice?: number;
  cumulativeSize?: number;
}

const ROW_HEIGHT = 24;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

function formatPriceWithScaling(price: number, scaling: number): string {
  let decimals: number;

  if (scaling >= 1000) {
    decimals = 0;
  } else if (scaling >= 1) {
    decimals = 0;
  } else {
    decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(scaling))));
  }

  return price.toFixed(decimals);
}

function formatSize(size: number): string {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(2)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(2)}K`;
  return size.toFixed(size < 1 ? 4 : 2);
}

const OrderRow = memo(
  ({ level, side, index, isHovered, onHover, priceScaling, maxTotal }: OrderRowProps) => {
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
          "relative flex items-center px-3 cursor-pointer tabular-nums select-none",
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        )}
        style={{ height: ROW_HEIGHT }}
        onMouseEnter={level.price > 0 ? handleMouseEnter : undefined}
        onMouseLeave={level.price > 0 ? handleMouseLeave : undefined}
      >
        {level.price > 0 && (
          <div
            className={cn(
              "absolute top-0 bottom-0 right-0 opacity-20 pointer-events-none",
              side === "bid" ? "bg-gain" : "bg-loss"
            )}
            style={{
              width: `${Math.min(depthPercent, 100)}%`,
              transform: "translateZ(0)",
            }}
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
          {level.price > 0 ? formatPriceWithScaling(level.price, priceScaling) : "-"}
        </span>
        <span
          className={cn(
            "relative z-10 flex-1 text-right text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground"
          )}
        >
          {level.price > 0 ? formatSize(level.size) : "-"}
        </span>
        <span
          className={cn(
            "relative z-10 flex-1 text-right text-[11px] font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground/70"
          )}
        >
          {level.price > 0 ? formatSize(level.total) : "-"}
        </span>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.level.price === next.level.price &&
      prev.level.size === next.level.size &&
      prev.level.total === next.level.total &&
      prev.side === next.side &&
      prev.isHovered === next.isHovered &&
      prev.priceScaling === next.priceScaling &&
      prev.maxTotal === next.maxTotal
    );
  }
);

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const { orderbook, isConnected, error, resubscribe } = useHyperliquidOrderbook(symbol);
  const [priceScaling, setPriceScaling] = useState<number>(0);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<{ side: "bid" | "ask"; index: number } | null>(
    null
  );
  const widgetRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isFirstRender = useRef(true);

  const bestPrice = orderbook?.asks[0]?.price || orderbook?.bids[0]?.price || 0;
  const scalingOptions = useMemo(() => generateTickSizeOptions(bestPrice), [bestPrice]);

  // Set initial default to most granular option on first render or when symbol changes
  useEffect(() => {
    if (scalingOptions.length === 0) return;

    const shouldReset = isFirstRender.current || priceScaling === 0;
    isFirstRender.current = false;

    if (shouldReset) {
      const defaultValue = scalingOptions[0].value;
      setPriceScaling(defaultValue);
    }
  }, [symbol, scalingOptions, priceScaling]);

  // When tick size changes, send server-side nSigFigs
  const handlePriceScalingChange = useCallback(
    (newScale: number) => {
      setPriceScaling(newScale);
      const opt = scalingOptions.find((o) => o.value === newScale);
      if (opt?.nSigFigs != null) {
        resubscribe(opt.nSigFigs);
      } else {
        resubscribe(5);
      }
    },
    [scalingOptions, resubscribe]
  );

  // Get current option to determine if server-side aggregation is being used
  const currentOption = scalingOptions.find((o) => o.value === priceScaling);

  // Client-side grouping:
  // - Skip grouping when using mantissa (server already provides most detailed data)
  // - Only do client-side grouping when nSigFigs is coarse (3, 2) or when using step-based grouping
  const shouldSkipGrouping = currentOption?.mantissa === 5;

  const groupedOrderbook = useMemo(() => {
    if (!orderbook) return null;

    // When using mantissa option (nSigFigs=5 with mantissa=5), server already provides
    // the most detailed aggregation, skip client-side grouping to avoid double aggregation
    if (shouldSkipGrouping) {
      return orderbook;
    }

    // Client-side grouping for coarser levels
    return {
      asks: groupLevels(orderbook.asks, priceScaling, "asks"),
      bids: groupLevels(orderbook.bids, priceScaling, "bids"),
    };
  }, [orderbook, priceScaling, shouldSkipGrouping]);

  const visibleAsks = useMemo(() => {
    return groupedOrderbook?.asks.slice(0, 100) || [];
  }, [groupedOrderbook]);

  const visibleBids = useMemo(() => {
    return groupedOrderbook?.bids.slice(0, 100) || [];
  }, [groupedOrderbook]);

  // Calculate max total from ALL data (use grouped orderbook)
  const maxTotal = groupedOrderbook
    ? Math.max(
        ...groupedOrderbook.asks.slice(0, 100).map((a) => a.total),
        ...groupedOrderbook.bids.slice(0, 100).map((b) => b.total)
      )
    : 0;

  // Calculate spread from grouped orderbook
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

  // Calculate cumulative data from best price to hovered row
  const calculateCumulativeData = useCallback(
    (
      side: "bid" | "ask",
      targetPrice: number
    ): { avgPrice: number; cumulativeSize: number } | null => {
      if (!groupedOrderbook) return null;

      const levels = side === "ask" ? groupedOrderbook.asks : groupedOrderbook.bids;
      const targetIndex = levels.findIndex((l) => l.price === targetPrice);
      if (targetIndex === -1) return null;

      // Calculate from index 0 (best price) to targetIndex
      let totalSize = 0;
      let weightedPriceSum = 0;

      for (let i = 0; i <= targetIndex; i++) {
        const level = levels[i];
        totalSize += level.size;
        weightedPriceSum += level.price * level.size;
      }

      const avgPrice = totalSize > 0 ? weightedPriceSum / totalSize : 0;

      return {
        avgPrice,
        cumulativeSize: totalSize,
      };
    },
    [groupedOrderbook]
  );

  const handleHover = useCallback(
    (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => {
      if (!data || !rowElement || isMobile) {
        setPopupData(null);
        setPopupPosition(null);
        setHoveredIndex(null);
        return;
      }

      // Calculate cumulative data
      const cumulativeData = calculateCumulativeData(data.side, data.price);

      const enrichedData: PopupData = {
        ...data,
        avgPrice: cumulativeData?.avgPrice,
        cumulativeSize: cumulativeData?.cumulativeSize,
      };

      setPopupData(enrichedData);

      // Update hovered index directly from the passed index
      if (index !== undefined) {
        setHoveredIndex({ side: data.side, index });
      }

      const rect = rowElement.getBoundingClientRect();
      const widgetRect = widgetRef.current?.getBoundingClientRect();
      if (widgetRect) {
        const viewportWidth = window.innerWidth;
        const top = rect.top + rect.height / 2;
        if (viewportWidth - widgetRect.right > 220) {
          setPopupPosition({ top, left: widgetRect.right + 8 });
        } else if (widgetRect.left > 220) {
          setPopupPosition({ top, right: viewportWidth - widgetRect.left + 8 });
        } else {
          setPopupPosition({ top, left: widgetRect.right - 200 });
        }
      }
    },
    [isMobile, calculateCumulativeData]
  );

  useEffect(() => {
    if (!popupData || !popupPosition) return;
    const handleUpdate = () => {
      setPopupData(null);
      setPopupPosition(null);
    };
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [popupData, popupPosition]);

  if (error)
    return (
      <div className="h-full flex items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  if (!isConnected || !orderbook)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );

  const isRowHovered = (side: "bid" | "ask", index: number) =>
    hoveredIndex?.side === side && hoveredIndex?.index === index;

  // Check if row is in highlight range (from best price to hovered row)
  const isRowInHighlightRange = (side: "bid" | "ask", index: number): boolean => {
    if (!hoveredIndex || hoveredIndex.side !== side) return false;

    // Both asks and bids are sorted Best -> Worst
    // We want to highlight from Best (0) to Hovered (index)
    return index <= hoveredIndex.index;
  };

  return (
    <div
      ref={widgetRef}
      className="h-full flex flex-col bg-card border rounded-lg overflow-hidden p-2"
    >
      <OrderbookToolbar
        priceScaling={priceScaling}
        onPriceScalingChange={handlePriceScalingChange}
        scalingOptions={scalingOptions}
      />

      {/* Header */}
      <div className="flex items-center px-3 py-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border/20 flex-shrink-0">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Size</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Asks - flex-col-reverse so best ask (lowest price) is at bottom */}
        <div className="flex flex-col-reverse relative flex-1 overflow-hidden">
          {visibleAsks.map((level, index) => (
            <div key={level.price} data-row className="flex-shrink-0 relative">
              {/* Overlay highlight range */}
              {isRowInHighlightRange("ask", index) && (
                <div
                  className={cn(
                    "absolute inset-0 z-[5] pointer-events-none",
                    "bg-foreground/5 dark:bg-foreground/10", // Màu gray trung tính
                    // Dashed border at hover row
                    isRowHovered("ask", index) && "border-b border-dashed border-foreground/30"
                  )}
                />
              )}
              <OrderRow
                level={level}
                side="ask"
                index={index}
                isHovered={isRowHovered("ask", index)}
                onHover={handleHover}
                priceScaling={priceScaling}
                maxTotal={maxTotal}
              />
            </div>
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-6 py-1.5 border-y border-border/10 bg-muted/20 flex-shrink-0">
          <span className="text-xs font-mono font-medium text-muted-foreground/80">Spread</span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {formatPriceWithScaling(spread, priceScaling)}
          </span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {spreadPercent.toFixed(3)}%
          </span>
        </div>

        {/* Bids - flex-col so best bid (highest price) is at top */}
        <div className="flex flex-col relative flex-1 overflow-hidden">
          {visibleBids.map((level, index) => (
            <div key={level.price} data-row className="flex-shrink-0 relative">
              {/* Overlay highlight range */}
              {isRowInHighlightRange("bid", index) && (
                <div
                  className={cn(
                    "absolute inset-0 z-[5] pointer-events-none",
                    "bg-foreground/5 dark:bg-foreground/10", // Màu gray trung tính
                    // Dashed border at hover row
                    isRowHovered("bid", index) && "border-t border-dashed border-foreground/30"
                  )}
                />
              )}
              <OrderRow
                level={level}
                side="bid"
                index={index}
                isHovered={isRowHovered("bid", index)}
                onHover={handleHover}
                priceScaling={priceScaling}
                maxTotal={maxTotal}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Popup */}
      {popupData && popupPosition && !isMobile && (
        <div
          className="fixed bg-card/95 border border-border/30 rounded-lg p-3 shadow-xl z-[100] w-64 pointer-events-none"
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
            <span className="text-xs font-mono text-muted-foreground">USDC</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Price</span>
              <span className="text-base font-mono font-medium">
                {formatPriceWithScaling(popupData.price, priceScaling)}
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

            {/* Cumulative Data Section */}
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
                      ? formatPriceWithScaling(popupData.avgPrice, priceScaling)
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

export const OrderbookWidget = memo(OrderbookWidgetComponent, (prev, next) => {
  return prev.symbol === next.symbol;
});
