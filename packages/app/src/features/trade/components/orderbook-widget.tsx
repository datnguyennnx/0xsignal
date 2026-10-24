import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useHyperliquidOrderbook } from "@/features/trade/hooks/use-hyperliquid-orderbook";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";
import { EmptyState } from "@/components/empty-state";
import { type PopupData } from "../utils/orderbook-utils";
import { OrderbookToolbar } from "./orderbook-toolbar";
import { OrderbookColumnHeader, OrderbookDepth, OrderbookPlaceholder } from "./orderbook-depth";
import { useOrderbookPrecision } from "../hooks/use-orderbook-precision";

interface OrderbookWidgetProps {
  symbol: string;
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
      <div className="relative isolate h-full flex flex-col rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface">
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
      className="relative isolate panel-contain h-full flex flex-col rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface gap-[var(--space-3,1.125rem)]"
    >
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
