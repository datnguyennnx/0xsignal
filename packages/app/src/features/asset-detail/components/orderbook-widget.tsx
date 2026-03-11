import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useHyperliquidOrderbook, type OrderbookLevel } from "@/hooks/use-hyperliquid-orderbook";
import { cn } from "@/core/utils/cn";
import { Activity } from "lucide-react";
type ViewMode = "both" | "asks" | "bids";

const PRICE_SCALING_OPTIONS = [
  { value: 0.001, label: "0.001" },
  { value: 0.01, label: "0.01" },
  { value: 0.1, label: "0.1" },
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 100, label: "100" },
];

const OrderbookToolbar = ({
  viewMode,
  onViewModeChange,
  priceScaling,
  onPriceScalingChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  priceScaling: number;
  onPriceScalingChange: (s: number) => void;
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 flex-shrink-0 bg-muted/10">
      <div className="inline-flex items-center p-0.5 bg-muted/40 rounded-lg">
        <ToolbarButton active={viewMode === "both"} onClick={() => onViewModeChange("both")}>
          All
        </ToolbarButton>
        <ToolbarButton
          active={viewMode === "asks"}
          onClick={() => onViewModeChange("asks")}
          activeColor="text-loss"
          hoverColor="hover:text-loss"
        >
          Asks
        </ToolbarButton>
        <ToolbarButton
          active={viewMode === "bids"}
          onClick={() => onViewModeChange("bids")}
          activeColor="text-gain"
          hoverColor="hover:text-gain"
        >
          Bids
        </ToolbarButton>
      </div>

      <select
        value={priceScaling}
        onChange={(e) => onPriceScalingChange(Number(e.target.value))}
        className="bg-transparent text-[11px] font-mono border border-border/30 rounded px-1.5 py-1 h-6 min-w-[60px]"
      >
        {PRICE_SCALING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const ToolbarButton = ({
  children,
  active,
  onClick,
  activeColor = "text-foreground",
  hoverColor = "hover:text-foreground",
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  activeColor?: string;
  hoverColor?: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
      active ? "bg-background shadow-sm" : cn("text-muted-foreground", hoverColor)
    )}
  >
    {children}
  </button>
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

function getDynamicPriceScaling(price: number): number {
  if (price >= 100000) return 10;
  if (price >= 10000) return 1;
  if (price >= 1000) return 1;
  if (price >= 100) return 0.1;
  if (price >= 10) return 0.1;
  if (price >= 1) return 0.01;
  if (price >= 0.01) return 0.001;
  return 0.001;
}

function formatPriceWithScaling(price: number, scaling: number): string {
  const decimals = scaling < 1 ? Math.abs(Math.log10(scaling)) : 0;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
    }, [onHover, level, side, index]);

    const handleMouseLeave = useCallback(() => onHover(null, null), [onHover]);

    return (
      <div
        ref={rowRef}
        className={cn(
          "relative flex items-center px-3 cursor-pointer tabular-nums select-none",
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        )}
        style={{ height: ROW_HEIGHT }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
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
        <span
          className={cn(
            "relative z-10 flex-1 text-xs font-mono font-medium",
            side === "bid" ? "text-gain" : "text-loss"
          )}
        >
          {formatPriceWithScaling(level.price, priceScaling)}
        </span>
        <span className="relative z-10 flex-1 text-right text-xs font-mono text-muted-foreground">
          {formatSize(level.size)}
        </span>
        <span className="relative z-10 flex-1 text-right text-[11px] font-mono text-muted-foreground/70">
          {formatSize(level.total)}
        </span>
      </div>
    );
  }
);

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const { orderbook, isConnected, error } = useHyperliquidOrderbook(symbol);
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [priceScaling, setPriceScaling] = useState<number>(1);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<{ side: "bid" | "ask"; index: number } | null>(
    null
  );
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const widgetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Measure container height
  useEffect(() => {
    const measureHeight = () => {
      if (contentRef.current) {
        setContainerHeight(contentRef.current.clientHeight);
      }
    };
    measureHeight();
    const resizeObserver = new ResizeObserver(measureHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [viewMode]);

  // Calculate max total from ALL data
  const maxTotal = orderbook
    ? Math.max(
        ...orderbook.asks.slice(0, 50).map((a) => a.total),
        ...orderbook.bids.slice(0, 50).map((b) => b.total)
      )
    : 0;

  // Auto-detect price scaling from orderbook data
  useEffect(() => {
    if (orderbook) {
      const bestPrice = orderbook.asks[0]?.price || orderbook.bids[0]?.price || 0;
      if (bestPrice > 0) {
        const detectedScaling = getDynamicPriceScaling(bestPrice);
        setPriceScaling(detectedScaling);
      }
    }
  }, [orderbook]);

  // Calculate row count based on height
  const getRowCount = () => {
    if (containerHeight === 0) return 25;
    if (viewMode === "both") {
      return Math.floor((containerHeight - ROW_HEIGHT) / 2 / ROW_HEIGHT);
    }
    return Math.floor(containerHeight / ROW_HEIGHT);
  };

  const rowCount = getRowCount();

  // Limit data to fill height
  const visibleAsks = orderbook?.asks.slice(0, rowCount) || [];
  const visibleBids = orderbook?.bids.slice(0, rowCount) || [];

  // Calculate cumulative data from best price to hovered row
  const calculateCumulativeData = useCallback(
    (
      side: "bid" | "ask",
      targetPrice: number
    ): { avgPrice: number; cumulativeSize: number } | null => {
      if (!orderbook) return null;

      const levels = side === "ask" ? orderbook.asks : orderbook.bids;
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
    [orderbook]
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
        <Activity className="w-5 h-5 animate-spin" />
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        priceScaling={priceScaling}
        onPriceScalingChange={setPriceScaling}
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
        {viewMode !== "bids" && (
          <div
            className={cn(
              "flex flex-col-reverse relative",
              viewMode === "asks" ? "flex-1 overflow-y-auto" : "flex-1 overflow-hidden"
            )}
          >
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
        )}

        {/* Spread */}
        {viewMode === "both" && (
          <div className="py-1.5 text-center border-y border-border/10 bg-muted/20 flex-shrink-0">
            <span
              className={cn(
                "text-sm font-mono font-bold",
                orderbook.spread > 0 ? "text-gain" : "text-loss"
              )}
            >
              {formatPriceWithScaling(orderbook.spread, priceScaling)}
            </span>
            <span className="text-xs font-mono text-muted-foreground ml-2">
              ({orderbook.spreadPercent.toFixed(2)}%)
            </span>
          </div>
        )}

        {/* Bids - flex-col so best bid (highest price) is at top */}
        {viewMode !== "asks" && (
          <div
            className={cn(
              "flex flex-col relative",
              viewMode === "bids" ? "flex-1 overflow-y-auto" : "flex-1 overflow-hidden"
            )}
          >
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
        )}
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
          <div className="text-xs text-muted-foreground uppercase mb-2">
            {popupData.side === "ask" ? "Ask" : "Bid"}
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
