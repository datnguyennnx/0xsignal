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
import {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  startTransition,
  type MouseEvent,
  type FocusEvent,
} from "react";
import {
  useHyperliquidOrderbook,
  generateTickSizeOptions,
  type TickSizeOption,
} from "@/features/trade/hooks/use-hyperliquid-orderbook";
import {
  getEffectivePriceScaling,
  shouldApplyInitialPrecisionSync,
  type PriceScalingState,
} from "./orderbook-widget.shared";
import { type OrderbookLevel, priceKey } from "@/core/utils/hyperliquid";
import { useOptionalL2BookNSigFigs } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { parseSymbol } from "@0xsignal/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatPriceWithScaling, formatSize } from "@/core/utils/formatters";

const EMPTY_ORDERBOOK_OPTIONS = {} as const;

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
const ROW_STYLE = { height: ROW_HEIGHT };
const VISIBLE_ROWS = 20;

const PRECISION_RESUBSCRIBE_DEBOUNCE_MS = 160;

const OrderbookToolbar = memo(
  ({
    symbol,
    coinOptions,
    onSymbolChange,
    priceScaling,
    onPriceScalingChange,
    scalingOptions,
  }: {
    symbol: string;
    coinOptions: Array<{ value: string; label: string }>;
    onSymbolChange: (s: string) => void;
    priceScaling: number;
    onPriceScalingChange: (s: number) => void;
    scalingOptions: TickSizeOption[];
  }) => (
    <div className="flex items-center justify-between gap-[clamp(0.375rem,0.6vw,0.625rem)] shrink-0">
      <NativeSelect
        size="sm"
        aria-label="Coin"
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        wrapperClassName="min-w-[4rem] max-w-[6rem]"
        className="h-7 w-full min-w-0 border-border/50 bg-background/70 text-[clamp(0.625rem,0.65rem+0.35vw,0.75rem)] font-mono font-semibold tracking-[0.01em]"
      >
        {coinOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label="Price precision"
        value={priceScaling.toString()}
        onChange={(e) => onPriceScalingChange(Number(e.target.value))}
        wrapperClassName="min-w-fit"
        className="h-7 w-full min-w-0 border-border/50 bg-background/70 text-[clamp(0.625rem,0.65rem+0.35vw,0.75rem)] tracking-[0.01em] hover:bg-muted/40 focus-visible:ring-[2px] focus-visible:ring-ring/40"
      >
        {scalingOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value.toString()}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  ),
  (prev, next) => prev.symbol === next.symbol && prev.priceScaling === next.priceScaling
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
    const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
    // Round to 1 decimal to avoid false cache busts from floating point drift
    const stableDepthPercent = Math.round(depthPercent * 10) / 10;

    const depthStyle = useMemo(
      () => ({
        width: "100%",
        transform: `scaleX(${Math.min(stableDepthPercent, 100) / 100})`,
        transformOrigin: "right center",
        willChange: stableDepthPercent < 100 ? "transform" : "auto",
        transition: transitionsEnabled ? "transform 150ms ease-out" : "none",
      }),
      [stableDepthPercent, transitionsEnabled]
    );

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
        const dataset = e.currentTarget.dataset;
        if (dataset.price === undefined) return;
        onHover(
          {
            price: Number(dataset.price),
            size: Number(dataset.size),
            total: Number(dataset.total),
            side: dataset.side as "bid" | "ask",
          },
          e.currentTarget,
          Number(dataset.index)
        );
      },
      [onHover]
    );

    const handleMouseLeave = useCallback(() => onHover(null, null), [onHover]);

    return (
      <div
        data-price={level.price}
        data-size={level.size}
        data-total={level.total}
        data-side={side}
        data-index={index}
        onMouseEnter={level.price > 0 ? handleMouseEnter : undefined}
        onMouseLeave={level.price > 0 ? handleMouseLeave : undefined}
        onFocus={level.price > 0 ? handleMouseEnter : undefined}
        onBlur={level.price > 0 ? handleMouseLeave : undefined}
        className={`relative flex items-center cursor-pointer tabular-nums select-none shrink-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset ${
          isHovered ? "bg-muted/50" : "hover:bg-muted/30"
        }`}
        style={ROW_STYLE}
        tabIndex={level.price > 0 ? 0 : -1}
        aria-label={
          level.price > 0
            ? `${side} level, price ${level.formattedPrice}, size ${level.formattedSize}, total ${level.formattedTotal}`
            : undefined
        }
        aria-describedby={level.price > 0 && isHovered ? "orderbook-depth-details" : undefined}
      >
        {isInRange && (
          <div
            className={`absolute inset-0 z-[5] pointer-events-none bg-foreground/5 dark:bg-foreground/10 ${
              isHovered && side === "ask" ? "border-b border-dashed border-foreground/30" : ""
            } ${isHovered && side === "bid" ? "border-t border-dashed border-foreground/30" : ""}`}
          />
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
          className={`relative z-10 flex-1 text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono font-medium ${
            level.price === 0
              ? "text-muted-foreground/30"
              : side === "bid"
                ? "text-gain"
                : "text-loss"
          }`}
        >
          {level.formattedPrice}
        </span>
        <span
          className={`relative z-10 flex-1 text-right text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono ${
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground"
          }`}
        >
          {level.formattedSize}
        </span>
        <span
          className={`relative z-10 flex-1 text-right text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono ${
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground/70"
          }`}
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

/** Convert size/total to quote denomination. Rounds to 2 decimals to prevent float jitter. */
function toQuoteDenom(level: OrderbookLevel): OrderbookLevel {
  const size = Math.round(level.price * level.size * 100) / 100;
  const total = Math.round(level.price * level.total * 100) / 100;
  return { ...level, size, total };
}

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const l2BookSig = useOptionalL2BookNSigFigs();
  const l2BookSigRef = useRef(l2BookSig);
  useEffect(() => {
    l2BookSigRef.current = l2BookSig;
  }, [l2BookSig]);

  // Base/quote denomination toggle. Resets on mount via key={symbol} in parent.
  const [pairFocus, setPairFocus] = useState("base");

  const pairOptions = useMemo(() => {
    const parsed = parseSymbol(symbol);
    const base = parsed.coin.toUpperCase();
    const quote = parsed.kind === "spot" ? (parsed.quote ?? "USDC") : "USDC";
    return [
      { value: "base", label: base },
      { value: "quote", label: quote },
    ];
  }, [symbol]);

  const orderbookHookOptions = useMemo(() => {
    if (l2BookSig != null) {
      return { controlledNSigFigs: l2BookSig.nSigFigs, adaptiveNSigFigs: false as const };
    }
    return EMPTY_ORDERBOOK_OPTIONS;
  }, [l2BookSig]);

  const { orderbook, resubscribe } = useHyperliquidOrderbook(symbol, true, orderbookHookOptions);

  const [userPriceScaling, setUserPriceScaling] = useState<PriceScalingState | null>(null);
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
  const initialSyncedSymbolsRef = useRef<Set<string>>(new Set());
  const userInteractedSymbolsRef = useRef<Set<string>>(new Set());
  const precisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (precisionTimerRef.current) {
        clearTimeout(precisionTimerRef.current);
        precisionTimerRef.current = null;
      }
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
    () => getEffectivePriceScaling(userPriceScaling, symbol, scalingOptions),
    [userPriceScaling, symbol, scalingOptions]
  );

  // Sync initial nSigFigs when orderbook data arrives
  useEffect(() => {
    if (!orderbook || scalingOptions.length === 0) {
      return;
    }

    if (
      !shouldApplyInitialPrecisionSync({
        symbol,
        userPriceScaling,
        hasSyncedForSymbol: initialSyncedSymbolsRef.current.has(symbol),
        userInteracted: userInteractedSymbolsRef.current.has(symbol),
      })
    ) {
      return;
    }

    const first = scalingOptions[0];
    if (l2BookSigRef.current) {
      l2BookSigRef.current.setNSigFigs(first.nSigFigs ?? 5);
    }
    initialSyncedSymbolsRef.current.add(symbol);
  }, [orderbook, scalingOptions, symbol, userPriceScaling]);

  const handlePriceScalingChange = useCallback(
    (newScale: number) => {
      const opt = scalingOptions.find((o) => o.value === newScale);
      const nextSig = opt?.nSigFigs ?? 5;

      startTransition(() => {
        setUserPriceScaling({ symbol, value: newScale });
      });

      userInteractedSymbolsRef.current.add(symbol);

      if (precisionTimerRef.current) {
        clearTimeout(precisionTimerRef.current);
      }

      precisionTimerRef.current = setTimeout(() => {
        if (l2BookSigRef.current) {
          l2BookSigRef.current.setNSigFigs(nextSig);
        } else {
          resubscribe(nextSig);
        }
        precisionTimerRef.current = null;
      }, PRECISION_RESUBSCRIBE_DEBOUNCE_MS);
    },
    [scalingOptions, resubscribe, symbol]
  );

  // Convert to selected denomination, format, and compute maxTotal.
  const { visibleAsks, visibleBids, maxTotal } = useMemo(() => {
    if (!orderbook)
      return {
        visibleAsks: [] as FormattedLevel[],
        visibleBids: [] as FormattedLevel[],
        maxTotal: 0,
      };

    const convert = pairFocus === "quote" ? toQuoteDenom : (l: OrderbookLevel) => l;
    const convAsks = orderbook.asks.slice(0, VISIBLE_ROWS).map(convert);
    const convBids = orderbook.bids.slice(0, VISIBLE_ROWS).map(convert);

    let maxTotal = 0;
    for (let i = 0; i < convAsks.length; i++) maxTotal = Math.max(maxTotal, convAsks[i].total);
    for (let i = 0; i < convBids.length; i++) maxTotal = Math.max(maxTotal, convBids[i].total);
    maxTotal = Math.round(maxTotal * 100) / 100; // stabilize depth bars

    return {
      visibleAsks: convAsks.map((l) => formatLevel(l, effectivePriceScaling)),
      visibleBids: convBids.map((l) => formatLevel(l, effectivePriceScaling)),
      maxTotal,
    };
  }, [orderbook, effectivePriceScaling, pairFocus]);

  const { spread, spreadPercent } = useMemo(() => {
    if (!orderbook || orderbook.asks.length === 0 || orderbook.bids.length === 0) {
      return { spread: 0, spreadPercent: 0 };
    }
    const bestAsk = orderbook.asks[0]?.price || 0;
    const bestBid = orderbook.bids[0]?.price || 0;
    const s = bestAsk - bestBid;
    const sp = bestBid > 0 ? (s / bestBid) * 100 : 0;
    return { spread: s, spreadPercent: sp };
  }, [orderbook]);

  const popupData = useMemo((): PopupData | null => {
    if (!hoverTarget || !orderbook) return null;
    const rawLevels = hoverTarget.side === "ask" ? orderbook.asks : orderbook.bids;
    const targetIndex = rawLevels.findIndex((l) => Math.abs(l.price - hoverTarget.price) < 1e-8);
    if (targetIndex === -1) return { ...hoverTarget };

    const levels = pairFocus === "quote" ? rawLevels.map(toQuoteDenom) : rawLevels;

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

  const hasBookData = !!orderbook && orderbook.asks.length > 0 && orderbook.bids.length > 0;

  if (!hasBookData) {
    return <Skeleton className="h-full w-full rounded-xl" />;
  }

  return (
    <div
      ref={widgetRef}
      className="h-full flex flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]"
    >
      <OrderbookToolbar
        symbol={pairFocus}
        coinOptions={pairOptions}
        onSymbolChange={setPairFocus}
        priceScaling={effectivePriceScaling}
        onPriceScalingChange={handlePriceScalingChange}
        scalingOptions={scalingOptions}
      />

      <div className="flex items-center text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono uppercase text-muted-foreground shrink-0">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">{pairFocus === "quote" ? "Value" : "Size"}</span>
        <span className="flex-1 text-right">{pairFocus === "quote" ? "Total Val" : "Total"}</span>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col-reverse">
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

        <div className="flex items-center justify-center gap-[clamp(1.25rem,3vw,2.5rem)] py-4 shrink-0">
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-mono font-medium text-muted-foreground">
            Spread
          </span>
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-mono text-muted-foreground">
            {formatPriceWithScaling(spread, effectivePriceScaling)}
          </span>
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-mono text-muted-foreground">
            {spreadPercent.toFixed(3)}%
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
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
          id="orderbook-depth-details"
          className="fixed bg-card/95 border border-border/30 rounded-xl p-3 shadow-xl z-50 w-64 pointer-events-none flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            right: popupPosition.right,
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex items-center justify-between">
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
            {popupData.cumulativeSize && popupData.cumulativeSize > popupData.size && (
              <>
                <div className="text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] text-muted-foreground uppercase">
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
                  <span className="text-sm font-mono">{formatSize(popupData.cumulativeSize)}</span>
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
