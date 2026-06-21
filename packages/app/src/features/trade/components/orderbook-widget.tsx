import {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type MouseEvent,
  type FocusEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  useHyperliquidOrderbook,
  generateTickSizeOptions,
  type TickSizeOption,
} from "@/features/trade/hooks/use-hyperliquid-orderbook";
import {
  getEffectiveNSigFigs,
  shouldApplyInitialPrecisionSync,
  getDepthStyle,
  type PriceScalingState,
} from "../utils/orderbook-widget-shared";
import { type DisplayOrderbookLevel as OrderbookLevel, priceKey } from "@/core/utils/hyperliquid";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";
import { parseSymbol } from "@0xsignal/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatPriceWithNSigFigs, formatSize } from "@/core/utils/formatters";
import {
  type PopupData,
  formatLevel,
  toQuoteDenom,
  VISIBLE_ROWS,
  ROW_STYLE,
} from "../utils/orderbook-utils";

interface OrderbookWidgetProps {
  symbol: string;
}

const OrderbookToolbar = memo(
  ({
    symbol,
    coinOptions,
    onSymbolChange,
    currentNSigFigs,
    onNSigFigsChange,
    scalingOptions,
  }: {
    symbol: string;
    coinOptions: Array<{ value: string; label: string }>;
    onSymbolChange: (s: string) => void;
    currentNSigFigs: number | null;
    onNSigFigsChange: (s: number) => void;
    scalingOptions: TickSizeOption[];
  }) => (
    <div className="flex items-center justify-between gap-[clamp(0.375rem,0.6vw,0.625rem)] shrink-0">
      <NativeSelect
        size="sm"
        aria-label="Coin"
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        wrapperClassName="min-w-[4rem] max-w-[6rem]"
        className="h-7 w-full min-w-0 border-border/50 bg-background/70 text-[clamp(0.625rem,0.65rem+0.35vw,0.75rem)] font-semibold tracking-[0.01em]"
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
        value={String(currentNSigFigs ?? 0)}
        onChange={(e) => onNSigFigsChange(Number(e.target.value))}
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
  (prev, next) => prev.symbol === next.symbol && prev.currentNSigFigs === next.currentNSigFigs,
);

interface OrderRowProps {
  level: OrderbookLevel;
  side: "bid" | "ask";
  index: number;
  isHovered: boolean;
  isInRange: boolean;
  onHover: (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => void;
  maxTotal: number;
  nSigFigs: number;
}

const OrderRow = memo(
  ({ level, side, index, isHovered, isInRange, onHover, maxTotal, nSigFigs }: OrderRowProps) => {
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
          Number(dataset.index),
        );
      },
      [onHover],
    );

    const handleMouseLeave = useCallback(() => onHover(null, null), [onHover]);

    const rowAriaLabel =
      level.price > 0
        ? `${side} level, price ${formatted.formattedPrice}, size ${formatted.formattedSize}, total ${formatted.formattedTotal}`
        : undefined;

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
        aria-label={rowAriaLabel}
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
          {formatted.formattedPrice}
        </span>
        <span
          className={`relative z-10 flex-1 text-right text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono ${
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground"
          }`}
        >
          {formatted.formattedSize}
        </span>
        <span
          className={`relative z-10 flex-1 text-right text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono ${
            level.price === 0 ? "text-muted-foreground/30" : "text-muted-foreground/70"
          }`}
        >
          {formatted.formattedTotal}
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
    prev.nSigFigs === next.nSigFigs &&
    prev.maxTotal === next.maxTotal,
);

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const nSigFigs = useTradeUIStore((s) => s.nSigFigs);
  const setNSigFigs = useTradeUIStore((s) => s.setNSigFigs);

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

  const orderbookHookOptions = useMemo(() => ({ controlledNSigFigs: nSigFigs }), [nSigFigs]);

  const { orderbook } = useHyperliquidOrderbook(symbol, true, orderbookHookOptions);

  const [selectedNSigFigs, setSelectedNSigFigs] = useState<PriceScalingState | null>(null);
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
    null,
  );
  const widgetRef = useRef<HTMLDivElement>(null);
  const initialSyncedSymbolsRef = useRef<Set<string>>(new Set());
  const userInteractedSymbolsRef = useRef<Set<string>>(new Set());

  // Debounced popup position via rAF to avoid synchronous layout thrashing
  const popupRafRef = useRef(0);
  const schedulePopupPosition = useCallback(
    (
      rowElement: HTMLElement,
      side: "bid" | "ask",
      price: number,
      size: number,
      total: number,
      index: number,
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
    [],
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

  const effectiveNSigFigs = useMemo(
    () => getEffectiveNSigFigs(selectedNSigFigs, symbol, scalingOptions),
    [selectedNSigFigs, symbol, scalingOptions],
  );

  useEffect(() => {
    if (!orderbook || scalingOptions.length === 0) return;

    if (
      !shouldApplyInitialPrecisionSync({
        symbol,
        userPriceScaling: selectedNSigFigs,
        hasSyncedForSymbol: initialSyncedSymbolsRef.current.has(symbol),
        userInteracted: userInteractedSymbolsRef.current.has(symbol),
      })
    ) {
      return;
    }

    const first = scalingOptions[0];
    setNSigFigs(first.nSigFigs ?? 5);
    initialSyncedSymbolsRef.current.add(symbol);
  }, [orderbook, scalingOptions, symbol, selectedNSigFigs, setNSigFigs]);

  const handleNSigFigsChange = useCallback(
    (newValue: number) => {
      const opt = scalingOptions.find((o) => o.value === newValue);
      const nextSig = opt?.nSigFigs ?? null;

      setSelectedNSigFigs({ symbol, value: newValue });
      userInteractedSymbolsRef.current.add(symbol);
      setNSigFigs(nextSig);
    },
    [scalingOptions, symbol, setNSigFigs],
  );

  // nSigFigs controls price display precision, not level grouping.
  // Levels arrive pre-aggregated from the server (Hyperliquid's own
  // nSigFigs grouping over the full deep orderbook). No client-side
  // aggregation needed — just slice to the visible window.
  const { visibleAsks, visibleBids, maxTotal } = useMemo(() => {
    if (!orderbook)
      return {
        visibleAsks: [] as OrderbookLevel[],
        visibleBids: [] as OrderbookLevel[],
        maxTotal: 0,
      };

    const rawAsks = orderbook.asks.slice(0, VISIBLE_ROWS);
    const rawBids = orderbook.bids.slice(0, VISIBLE_ROWS);

    const convAsks = pairFocus === "quote" ? rawAsks.map(toQuoteDenom) : rawAsks;
    const convBids = pairFocus === "quote" ? rawBids.map(toQuoteDenom) : rawBids;

    let maxTotal = 0;
    for (let i = 0; i < convAsks.length; i++) maxTotal = Math.max(maxTotal, convAsks[i].total);
    for (let i = 0; i < convBids.length; i++) maxTotal = Math.max(maxTotal, convBids[i].total);
    maxTotal = Math.round(maxTotal * 100) / 100;

    return { visibleAsks: convAsks, visibleBids: convBids, maxTotal };
  }, [orderbook, pairFocus]);

  const { spread, spreadPercent } = useMemo(() => {
    if (!orderbook || orderbook.asks.length === 0 || orderbook.bids.length === 0) {
      return { spread: 0, spreadPercent: 0 };
    }
    const bestAsk = orderbook.asks[0]?.price || 0;
    const bestBid = orderbook.bids[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    return { spread, spreadPercent };
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
    [schedulePopupPosition],
  );

  const isRowHovered = useCallback(
    (side: "bid" | "ask", index: number) =>
      hoveredIndex?.side === side && hoveredIndex?.index === index,
    [hoveredIndex],
  );

  const isRowInHighlightRange = useCallback(
    (side: "bid" | "ask", index: number) => {
      if (!hoveredIndex || hoveredIndex.side !== side) return false;
      return index <= hoveredIndex.index;
    },
    [hoveredIndex],
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
        currentNSigFigs={effectiveNSigFigs}
        onNSigFigsChange={handleNSigFigsChange}
        scalingOptions={scalingOptions}
      />

      <div className="flex items-center text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-mono uppercase text-muted-foreground shrink-0">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">{pairFocus === "quote" ? "Value" : "Size"}</span>
        <span className="flex-1 text-right">{pairFocus === "quote" ? "Total Val" : "Total"}</span>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse">
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
              nSigFigs={effectiveNSigFigs ?? 5}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-[clamp(1.25rem,3vw,2.5rem)] py-4 shrink-0">
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-medium text-muted-foreground">
            Spread
          </span>
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-mono text-muted-foreground">
            {formatPriceWithNSigFigs(spread, effectiveNSigFigs ?? 5)}
          </span>
          <span className="text-[clamp(0.625rem,0.5rem+0.2vw,0.6875rem)] font-mono text-muted-foreground">
            {spreadPercent.toFixed(3)}%
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative">
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
              {popupData.cumulativeSize && popupData.cumulativeSize > popupData.size && (
                <>
                  <div className="text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] text-muted-foreground uppercase">
                    To Best Price
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Avg Price</span>
                    <span className="text-sm font-mono font-medium">
                      {popupData.avgPrice
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
    </div>
  );
};

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol,
);
