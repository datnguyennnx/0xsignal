import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { useHyperliquidOrderbook } from "@/features/trade/hooks/use-hyperliquid-orderbook";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Surface } from "@/components/surface/surface";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type PopupData } from "../utils/orderbook-utils";
import { OrderbookToolbar } from "./orderbook-toolbar";
import { OrderbookColumnHeader, OrderbookDepth, OrderbookPlaceholder } from "./orderbook-depth";
import { OrderbookTrades } from "./orderbook-trades";
import { useOrderbookPrecision } from "../hooks/use-orderbook-precision";
import { hasRenderableBook, resolveBookDisplayNSigFigs } from "../utils/orderbook-widget-shared";

interface OrderbookWidgetProps {
  symbol: string;
}

const ORDERBOOK_VIEW_OPTIONS = [
  { value: "book", label: "Order Book" },
  { value: "trades", label: "Trades" },
] as const;

function OrderbookError({ description, onRetry }: { description: string; onRetry: () => void }) {
  return (
    <Surface
      tier="content"
      radius="panel"
      className="relative isolate h-full flex flex-col p-panel"
    >
      <div role="alert" className="flex flex-1 min-h-0 items-center justify-center">
        <ErrorState
          title="Couldn't load order book"
          description={description}
          retryAction={onRetry}
          className="py-6"
        />
      </div>
    </Surface>
  );
}

const OrderbookWidgetComponent = ({ symbol }: OrderbookWidgetProps) => {
  const nSigFigs = useTradeUIStore((s) => s.nSigFigs);
  const orderbookView = useTradeUIStore((s) => s.orderbookView);
  const setOrderbookView = useTradeUIStore((s) => s.setOrderbookView);

  // Base/quote denomination toggle. Resets on mount via key={symbol} in parent.
  const [pairFocus, setPairFocus] = useState("base");

  const orderbookHookOptions = useMemo(() => ({ controlledNSigFigs: nSigFigs }), [nSigFigs]);

  const { orderbook, error, retry } = useHyperliquidOrderbook(symbol, true, orderbookHookOptions);

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

  // Popup is anchored to the pointer carried by the hover event, so it needs no
  // post-paint measurement.
  const positionPopup = useCallback((clientX: number, clientY: number) => {
    const viewportWidth = window.innerWidth;
    if (viewportWidth - clientX > 264) {
      setPopupPosition({ top: clientY, left: clientX + 8 });
    } else {
      setPopupPosition({ top: clientY, right: viewportWidth - clientX + 8 });
    }
  }, []);

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
    (data: PopupData | null, index?: number, point?: { clientX: number; clientY: number }) => {
      if (!data || index === undefined || point === undefined) {
        // A pinned row keeps its detail visible after pointer/focus leaves.
        if (pinnedIndex) return;
        setHoverTarget(null);
        setPopupPosition(null);
        setHoveredIndex(null);
        return;
      }
      setHoverTarget({ side: data.side, price: data.price, size: data.size, total: data.total });
      setHoveredIndex({ side: data.side, index });
      positionPopup(point.clientX, point.clientY);
    },
    [positionPopup, pinnedIndex],
  );

  const handleActivate = useCallback((side: "bid" | "ask", index: number) => {
    setPinnedIndex((prev) =>
      prev?.side === side && prev.index === index ? null : { side, index },
    );
  }, []);

  const hasBookData = hasRenderableBook(orderbook);
  const displayNSigFigs = resolveBookDisplayNSigFigs(effectiveNSigFigs);

  // A rejected subscription is an error whichever side of the first frame it lands.
  if (error !== null && (!orderbook || !hasBookData)) {
    return <OrderbookError description={error} onRetry={retry} />;
  }

  // No first frame yet: pending, not an empty book.
  if (!orderbook) {
    return <OrderbookPlaceholder pairFocus={pairFocus} />;
  }

  // A frame arrived with no levels: that is genuinely empty, not a pending read.
  if (!hasBookData) {
    return (
      <Surface
        tier="content"
        radius="panel"
        className="relative isolate h-full flex flex-col p-panel"
      >
        <EmptyState
          variant="panel"
          title="No order book data"
          description="Waiting for the book to populate."
        />
      </Surface>
    );
  }

  return (
    <Surface
      tier="content"
      radius="panel"
      className="orderbook-widget relative isolate panel-contain h-full flex flex-col p-panel gap-inline"
    >
      <Tabs
        value={orderbookView}
        onValueChange={(value: unknown) => {
          if (value === "book" || value === "trades") setOrderbookView(value);
        }}
        className="shrink-0"
      >
        <TabsList aria-label="Order book view" className="w-full">
          {ORDERBOOK_VIEW_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value} className="flex-1">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orderbookView === "book" && (
        <OrderbookToolbar
          symbol={symbol}
          pairFocus={pairFocus}
          onPairFocusChange={setPairFocus}
          currentNSigFigs={effectiveNSigFigs}
          onNSigFigsChange={handleNSigFigsChange}
          scalingOptions={scalingOptions}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {orderbookView === "book" ? (
          <>
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
          </>
        ) : (
          <OrderbookTrades symbol={symbol} displayNSigFigs={displayNSigFigs} />
        )}
      </div>
    </Surface>
  );
};

export const OrderbookWidget = memo(
  OrderbookWidgetComponent,
  (prev, next) => prev.symbol === next.symbol,
);
