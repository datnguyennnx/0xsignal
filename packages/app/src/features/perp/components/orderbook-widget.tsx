/** @fileoverview Orderbook widget with virtualization for performance */
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

const ROW_HEIGHT = 24;
const VISIBLE_ROWS = 20;

function formatPriceWithScaling(price: number, scaling: number): string {
  let decimals: number;
  if (scaling >= 1000) decimals = 0;
  else if (scaling >= 1) decimals = 0;
  else decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(scaling))));
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

interface OrderRowProps {
  level: OrderbookLevel;
  side: "bid" | "ask";
  index: number;
  isHovered: boolean;
  isInRange: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  priceScaling: number;
  maxTotal: number;
}

const OrderRow = memo(
  ({
    level,
    side,
    index,
    isHovered,
    isInRange,
    onHover,
    priceScaling,
    maxTotal,
  }: OrderRowProps) => {
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
            className={cn(
              "absolute top-0 bottom-0 right-0 opacity-20 pointer-events-none",
              side === "bid" ? "bg-gain" : "bg-loss"
            )}
            style={{ width: `${Math.min(depthPercent, 100)}%`, transform: "translateZ(0)" }}
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
  (prev, next) =>
    prev.level.price === next.level.price &&
    prev.level.size === next.level.size &&
    prev.level.total === next.level.total &&
    prev.side === next.side &&
    prev.isHovered === next.isHovered &&
    prev.isInRange === next.isInRange &&
    prev.priceScaling === next.priceScaling &&
    prev.maxTotal === next.maxTotal
);

OrderRow.displayName = "OrderRow";

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
  const prevSymbolRef = useRef<string | null>(null);

  const bestPrice = orderbook?.asks[0]?.price || orderbook?.bids[0]?.price || 0;
  const scalingOptions = useMemo(() => generateTickSizeOptions(bestPrice), [bestPrice]);

  useEffect(() => {
    if (prevSymbolRef.current !== null && prevSymbolRef.current !== symbol) {
      setPriceScaling(0);
    }
    prevSymbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    if (!orderbook) {
      return;
    }
    if (scalingOptions.length > 0 && priceScaling === 0) {
      setPriceScaling(scalingOptions[0].value);
    }
  }, [orderbook, scalingOptions, priceScaling]);

  const handlePriceScalingChange = useCallback(
    (newScale: number) => {
      setPriceScaling(newScale);
      const opt = scalingOptions.find((o) => o.value === newScale);
      resubscribe(opt?.nSigFigs ?? 5);
    },
    [scalingOptions, resubscribe]
  );

  const currentOption = scalingOptions.find((o) => o.value === priceScaling);
  const shouldSkipGrouping = currentOption?.mantissa === 5;

  const groupedOrderbook = useMemo(() => {
    if (!orderbook) return null;
    if (shouldSkipGrouping) return orderbook;
    return {
      asks: groupLevels(orderbook.asks, priceScaling, "asks"),
      bids: groupLevels(orderbook.bids, priceScaling, "bids"),
    };
  }, [orderbook, priceScaling, shouldSkipGrouping]);

  const { visibleAsks, visibleBids, maxTotal } = useMemo(() => {
    if (!groupedOrderbook) return { visibleAsks: [], visibleBids: [], maxTotal: 0 };
    const asks = groupedOrderbook.asks.slice(0, VISIBLE_ROWS);
    const bids = groupedOrderbook.bids.slice(0, VISIBLE_ROWS);
    const maxTotal = Math.max(...asks.map((a) => a.total), ...bids.map((b) => b.total));
    return { visibleAsks: asks, visibleBids: bids, maxTotal };
  }, [groupedOrderbook]);

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

  const calculateCumulativeData = useCallback(
    (
      side: "bid" | "ask",
      targetPrice: number
    ): { avgPrice: number; cumulativeSize: number } | null => {
      if (!groupedOrderbook) return null;
      const levels = side === "ask" ? groupedOrderbook.asks : groupedOrderbook.bids;
      const targetIndex = levels.findIndex((l) => l.price === targetPrice);
      if (targetIndex === -1) return null;

      let totalSize = 0;
      let weightedPriceSum = 0;
      for (let i = 0; i <= targetIndex; i++) {
        totalSize += levels[i].size;
        weightedPriceSum += levels[i].price * levels[i].size;
      }

      return {
        avgPrice: totalSize > 0 ? weightedPriceSum / totalSize : 0,
        cumulativeSize: totalSize,
      };
    },
    [groupedOrderbook]
  );

  const handleHover = useCallback(
    (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => {
      if (!data || !rowElement) {
        setPopupData(null);
        setPopupPosition(null);
        setHoveredIndex(null);
        return;
      }

      const cumulativeData = calculateCumulativeData(data.side, data.price);
      setPopupData({ ...data, ...cumulativeData });

      if (index !== undefined) setHoveredIndex({ side: data.side, index });

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
    },
    [calculateCumulativeData]
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
      className="h-full flex flex-col bg-card border-border/30 rounded-xl overflow-hidden p-2"
    >
      <OrderbookToolbar
        priceScaling={priceScaling}
        onPriceScalingChange={handlePriceScalingChange}
        scalingOptions={scalingOptions}
      />

      <div className="flex items-center px-3 py-1.5 text-[10px] font-mono uppercase text-muted-foreground border-b border-border/20 flex-shrink-0">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Size</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden overscroll-none">
        <div className="flex flex-col-reverse relative flex-1 overflow-hidden overscroll-none">
          {visibleAsks.map((level, index) => (
            <div key={level.price} data-row className="flex-shrink-0 relative">
              <OrderRow
                level={level}
                side="ask"
                index={index}
                isHovered={isRowHovered("ask", index)}
                isInRange={isRowInHighlightRange("ask", index)}
                onHover={handleHover}
                priceScaling={priceScaling}
                maxTotal={maxTotal}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 py-1.5 border-y border-border/10 bg-muted/20 flex-shrink-0">
          <span className="text-xs font-mono font-medium text-muted-foreground/80">Spread</span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {formatPriceWithScaling(spread, priceScaling)}
          </span>
          <span className="text-xs font-mono text-muted-foreground/80">
            {spreadPercent.toFixed(3)}%
          </span>
        </div>

        <div className="flex flex-col relative flex-1 overflow-hidden overscroll-none">
          {visibleBids.map((level, index) => (
            <div key={level.price} data-row className="flex-shrink-0 relative">
              <OrderRow
                level={level}
                side="bid"
                index={index}
                isHovered={isRowHovered("bid", index)}
                isInRange={isRowInHighlightRange("bid", index)}
                onHover={handleHover}
                priceScaling={priceScaling}
                maxTotal={maxTotal}
              />
            </div>
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

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol
);
OrderbookWidget.displayName = "OrderbookWidget";
