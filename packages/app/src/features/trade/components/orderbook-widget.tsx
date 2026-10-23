import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useHyperliquidOrderbook } from "@/features/trade/hooks/use-hyperliquid-orderbook";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { LiquidGlass } from "@/components/glass";
import { type PopupData, ROW_HEIGHT_CLASS, VISIBLE_ROWS } from "../utils/orderbook-utils";
import { OrderbookToolbar } from "./orderbook-toolbar";
import { OrderbookDepth, OrderbookSpreadRow } from "./orderbook-depth";
import { useOrderbookPrecision } from "../hooks/use-orderbook-precision";

interface OrderbookWidgetProps {
  symbol: string;
}

function OrderbookColumnHeader({ pairFocus }: { pairFocus: string }) {
  return (
    <div
      className={`${ROW_HEIGHT_CLASS} flex items-center text-[length:var(--text-micro)] font-mono uppercase text-muted-foreground shrink-0`}
    >
      <span className="flex-1">Price</span>
      <span className="flex-1 text-right">{pairFocus === "quote" ? "Value" : "Size"}</span>
      <span className="flex-1 text-right">{pairFocus === "quote" ? "Total Val" : "Total"}</span>
    </div>
  );
}

function OrderbookPlaceholderRows() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {Array.from({ length: VISIBLE_ROWS }, (_, index) => (
        <div key={index} className={`${ROW_HEIGHT_CLASS} flex items-center gap-2 shrink-0`}>
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** Reserves the loaded book's box: toolbar + column header + both depth halves + spread. */
function OrderbookPlaceholder({ pairFocus }: { pairFocus: string }) {
  return (
    <div className="relative isolate h-full flex flex-col rounded-xl p-3.5 bg-transparent gap-2">
      <LiquidGlass borderRadius="inherit" refraction tint="var(--material-raised-tint)" />
      <div className="flex items-center justify-between gap-[clamp(0.375rem,0.6vw,0.625rem)] shrink-0">
        <Skeleton className="h-7 w-[4.5rem]" />
        <Skeleton className="h-7 w-20" />
      </div>
      <OrderbookColumnHeader pairFocus={pairFocus} />
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <OrderbookPlaceholderRows />
        <OrderbookSpreadRow>
          <span className="text-[length:var(--text-micro)] font-medium text-muted-foreground">
            Spread
          </span>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </OrderbookSpreadRow>
        <OrderbookPlaceholderRows />
      </div>
    </div>
  );
}

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const nSigFigs = useTradeUIStore((s) => s.nSigFigs);

  // Base/quote denomination toggle. Resets on mount via key={symbol} in parent.
  const [pairFocus, setPairFocus] = useState("base");

  const orderbookHookOptions = useMemo(() => ({ controlledNSigFigs: nSigFigs }), [nSigFigs]);

  const { orderbook } = useHyperliquidOrderbook(symbol, true, orderbookHookOptions);

  const { effectiveNSigFigs, scalingOptions, handleNSigFigsChange } = useOrderbookPrecision(
    symbol,
    orderbook,
  );

  const [hoverTarget, setHoverTarget] = useState<PopupData | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<{ side: "bid" | "ask"; index: number } | null>(
    null,
  );
  const [pinnedIndex, setPinnedIndex] = useState<{ side: "bid" | "ask"; index: number } | null>(
    null,
  );
  const widgetRef = useRef<HTMLDivElement>(null);

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
    setPinnedIndex(null);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", clearPopup, { passive: true, capture: true });
    window.addEventListener("resize", clearPopup);
    return () => {
      window.removeEventListener("scroll", clearPopup, { capture: true });
      window.removeEventListener("resize", clearPopup);
    };
  }, [clearPopup]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pinnedIndex && event.key === "Escape") clearPopup();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!pinnedIndex) return;
      if (event.target instanceof Element && event.target.closest("[data-orderbook-row]")) return;
      clearPopup();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [pinnedIndex, clearPopup]);

  const handleHover = useCallback(
    (data: PopupData | null, rowElement?: HTMLElement | null, index?: number) => {
      if (!data || !rowElement || index === undefined) {
        // A pinned row keeps its detail visible after pointer/focus leaves.
        if (pinnedIndex) return;
        setHoverTarget(null);
        setPopupPosition(null);
        setHoveredIndex(null);
        return;
      }
      schedulePopupPosition(rowElement, data.side, data.price, data.size, data.total, index);
    },
    [schedulePopupPosition, pinnedIndex],
  );

  const handleActivate = useCallback((side: "bid" | "ask", index: number) => {
    setPinnedIndex((prev) =>
      prev?.side === side && prev.index === index ? null : { side, index },
    );
  }, []);

  const hasBookData = !!orderbook && orderbook.asks.length > 0 && orderbook.bids.length > 0;

  if (!orderbook) {
    return <OrderbookPlaceholder pairFocus={pairFocus} />;
  }

  if (!hasBookData) {
    return (
      <div className="relative isolate h-full flex flex-col rounded-xl p-3.5 bg-transparent">
        <LiquidGlass borderRadius="inherit" refraction tint="var(--material-raised-tint)" />
        <EmptyState
          variant="panel"
          title="No order book data"
          description="Waiting for the book to populate."
        />
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      className="relative isolate panel-contain h-full flex flex-col rounded-xl p-3.5 bg-transparent gap-2"
    >
      <LiquidGlass borderRadius="inherit" refraction tint="var(--material-raised-tint)" />
      <OrderbookToolbar
        symbol={symbol}
        pairFocus={pairFocus}
        onPairFocusChange={setPairFocus}
        currentNSigFigs={effectiveNSigFigs}
        onNSigFigsChange={handleNSigFigsChange}
        scalingOptions={scalingOptions}
      />

      <OrderbookColumnHeader pairFocus={pairFocus} />

      <OrderbookDepth
        symbol={symbol}
        orderbook={orderbook}
        pairFocus={pairFocus}
        effectiveNSigFigs={effectiveNSigFigs}
        hoveredIndex={hoveredIndex}
        pinnedIndex={pinnedIndex}
        hoverTarget={hoverTarget}
        popupPosition={popupPosition}
        onHover={handleHover}
        onActivate={handleActivate}
      />
    </div>
  );
};

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol,
);
