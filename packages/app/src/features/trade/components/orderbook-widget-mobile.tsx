/**
 * @overview Mobile Order Book (Market Depth) - Symmetrical Dual-Pane Layout
 *
 * Renders a real-time L2 orderbook with a symmetrical bid/ask split down the center axis.
 * Bids (buy) populate the left half, Asks (sell) populate the right half.
 * Depth bars anchor at the center seam and expand outward.
 *
 * @mechanism
 * - Integrates with L2BookNSigFigsContext for cross-component aggregation sync
 * - Implements client-side grouping when local tick size differs from exchange SigFigs
 *
 * @performance
 * - Memoized OrderRow to prevent expensive re-renders
 * - RAF-throttled updates from the underlying hook
 * - Single-pass maxTotal computation (O(1) space)
 */
import { memo, useState, useCallback, useEffect, useRef, useMemo, startTransition } from "react";
import {
  useHyperliquidOrderbook,
  generateTickSizeOptions,
} from "@/features/trade/hooks/use-hyperliquid-orderbook";
import {
  groupOrderbookLevels,
  type OrderbookLevel,
  type OrderbookData,
} from "@/core/utils/hyperliquid";
import { useOptionalL2BookNSigFigs } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { cn } from "@/core/utils/cn";
import { Loader2, ChevronDown } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatPriceWithScaling } from "@/core/utils/formatters";

interface OrderbookWidgetProps {
  symbol: string;
}

const ROW_HEIGHT = 24;
const VISIBLE_ROWS = 18;

interface FormattedLevel extends OrderbookLevel {
  formattedPrice: string;
  formattedTotal: string;
}

interface BidRowProps {
  level: FormattedLevel;
  maxTotal: number;
}

const BidRow = memo(
  ({ level, maxTotal }: BidRowProps) => {
    const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;

    return (
      <div
        className="relative flex items-center justify-between px-2 tabular-nums select-none flex-shrink-0"
        style={{ height: ROW_HEIGHT }}
      >
        {level.price > 0 && (
          <div
            className="absolute top-0 bottom-0 right-0 opacity-20 pointer-events-none bg-gain"
            style={{ width: `${Math.min(depthPercent, 100)}%`, transform: "translateZ(0)" }}
          />
        )}
        <span
          className={cn(
            "relative z-10 text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-foreground"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {level.formattedTotal}
        </span>
        <span
          className={cn(
            "relative z-10 text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-gain"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {level.formattedPrice}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.level.price === next.level.price &&
    prev.level.formattedPrice === next.level.formattedPrice &&
    prev.level.formattedTotal === next.level.formattedTotal &&
    prev.maxTotal === next.maxTotal
);

BidRow.displayName = "BidRow";

interface AskRowProps {
  level: FormattedLevel;
  maxTotal: number;
}

const AskRow = memo(
  ({ level, maxTotal }: AskRowProps) => {
    const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;

    return (
      <div
        className="relative flex items-center justify-between px-2 tabular-nums select-none flex-shrink-0"
        style={{ height: ROW_HEIGHT }}
      >
        {level.price > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0 opacity-20 pointer-events-none bg-loss"
            style={{ width: `${Math.min(depthPercent, 100)}%`, transform: "translateZ(0)" }}
          />
        )}
        <span
          className={cn(
            "relative z-10 text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-loss"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {level.formattedPrice}
        </span>
        <span
          className={cn(
            "relative z-10 text-xs font-mono",
            level.price === 0 ? "text-muted-foreground/30" : "text-foreground"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {level.formattedTotal}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.level.price === next.level.price &&
    prev.level.formattedPrice === next.level.formattedPrice &&
    prev.level.formattedTotal === next.level.formattedTotal &&
    prev.maxTotal === next.maxTotal
);

AskRow.displayName = "AskRow";

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
  const widgetRef = useRef<HTMLDivElement>(null);

  const bestPrice = orderbook?.asks[0]?.price || orderbook?.bids[0]?.price || 0;
  const scalingOptions = useMemo(() => generateTickSizeOptions(bestPrice), [bestPrice]);

  const effectivePriceScaling =
    userPriceScaling?.symbol === symbol
      ? userPriceScaling.value
      : scalingOptions.length > 0
        ? scalingOptions[0].value
        : 0;

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

  const currentOption = scalingOptions.find((o) => o.value === effectivePriceScaling);
  const shouldSkipGrouping = currentOption?.nSigFigs === 5;

  const groupedOrderbook = useMemo((): OrderbookData | null => {
    if (!orderbook) return null;
    if (shouldSkipGrouping) return orderbook;
    return {
      ...orderbook,
      asks: groupOrderbookLevels(orderbook.asks, effectivePriceScaling, "asks"),
      bids: groupOrderbookLevels(orderbook.bids, effectivePriceScaling, "bids"),
    };
  }, [orderbook, effectivePriceScaling, shouldSkipGrouping]);

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

    const formatLevel = (level: OrderbookLevel): FormattedLevel => ({
      ...level,
      formattedPrice:
        level.price > 0 ? formatPriceWithScaling(level.price, effectivePriceScaling) : "-",
      formattedTotal: level.price > 0 ? level.total.toFixed(2) : "-",
    });

    return {
      visibleAsks: asks.map(formatLevel),
      visibleBids: bids.map(formatLevel),
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
    <div ref={widgetRef} className="flex flex-col h-full bg-background overscroll-none select-none">
      {/* Header: Tick Size (left) | Asset (right) */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
        <NativeSelect
          size="sm"
          value={effectivePriceScaling.toString()}
          onChange={(e) => handlePriceScalingChange(Number(e.target.value))}
          className="min-h-[28px] bg-transparent border-0 text-sm text-foreground font-mono"
        >
          {scalingOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground border-b border-border/10 flex-shrink-0">
        <div className="flex-1 flex items-center justify-between">
          <span>Total</span>
          <span>Price</span>
        </div>
        <div className="w-px h-3 bg-border/20 mx-1" />
        <div className="flex-1 flex items-center justify-between">
          <span>Price</span>
          <span>Total</span>
        </div>
      </div>

      {/* Order Book Rows */}
      <div className="flex-1 min-h-0 overflow-hidden overscroll-none">
        <div className="flex h-full">
          {/* Left Half - Bids */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border/10">
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col justify-start">
                {visibleBids.map((level) => (
                  <BidRow key={`bid-${level.price}`} level={level} maxTotal={maxTotal} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Half - Asks */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col justify-start">
                {visibleAsks.map((level) => (
                  <AskRow key={`ask-${level.price}`} level={level} maxTotal={maxTotal} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol
);
OrderbookWidget.displayName = "OrderbookWidget";
